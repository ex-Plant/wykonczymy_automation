'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDebouncedSave } from '@/components/kosztorys/editor/hooks/use-debounced-save'
import {
  coalesceFieldChanges,
  coalesceStageChanges,
  type FieldChangeT,
  type StageChangeT,
} from '@/lib/kosztorys/undo-coalesce'
import type { UndoRedoApiT } from '@/components/kosztorys/editor/hooks/use-undo-redo'
import { useColumnWidths } from '@/components/kosztorys/editor/hooks/use-column-widths'
import { useHiddenColumns } from '@/components/kosztorys/editor/hooks/use-hidden-columns'
import { useLayer } from '@/components/kosztorys/editor/hooks/use-layer'
import { useMoneyAxis } from '@/components/kosztorys/editor/hooks/use-money-axis'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import {
  settlementModeToGridAxis,
  type SettlementModeT,
} from '@/lib/kosztorys/settlement-mode'
import { usePriceView } from '@/components/kosztorys/editor/hooks/use-price-view'
import { useProgressDisplay } from '@/components/kosztorys/editor/hooks/use-progress-display'
import { useElementHeight } from '@/hooks/use-element-height'
import { toastMessage } from '@/lib/utils/toast'
import { buildV2Grid } from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import { type V2SortStateT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { diffRow, inverseGlobalCoeffPatch, treeToRows } from '@/lib/kosztorys/v2-rows'
import {
  applyAddItem,
  applyInsertItem,
  applyInsertSectionRow,
  applyRemoveItem,
  applyRestoreItem,
  buildBlankRow,
  insertDisplayOrder,
  neighborSectionId,
  revertField,
  sectionNeighbor,
  swapItemInSection,
  swapSectionBlock,
} from '@/lib/kosztorys/row-ops'
import {
  planItemRemoval,
  planItemRemovalFromCounts,
  sectionItemCounts,
  type ItemRemovalPlanT,
} from '@/lib/kosztorys/delete-policy'
import {
  clientTotalsFromSubtotals,
  emptySectionIds,
  rowRemainingForView,
  sectionSubtotalsForView,
  stageTotalsForView,
  subcontractorDueByPlane,
} from '@/lib/kosztorys/settlement'
import { filterRows, sortRows, type SortDirT } from '@/lib/kosztorys/row-view'
import { columnSortValue, reconcileSort } from '@/lib/kosztorys/sort-value'
import { NEW_SECTION_DEFAULTS } from '@/lib/kosztorys/constants'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import {
  stageKey,
  stageValueGrossKey,
  stageValueNetKey,
  stageValuePercentKey,
} from '@/lib/kosztorys/stage-keys'
import { isGlobalDiscountActive, toGross } from '@/lib/kosztorys/calc'
import {
  addItemAction,
  addSectionAction,
  addStageAction,
  applyPercentRabatToAllItemsAction,
  insertItemAction,
  insertSectionAction,
  removeItemAction,
  removeSectionAction,
  removeStageAction,
  setStageProgressAction,
  swapItemOrderAction,
  swapSectionOrderAction,
  updateInvestmentCoeffsAction,
  updateInvestmentGlobalDiscountAction,
  updateInvestmentSettlementModeAction,
  updateInvestmentVatAction,
  updateItemFieldAction,
  updateSectionFieldAction,
  updateStageAction,
} from '@/lib/actions/kosztorys'
import type {
  GlobalDiscountT,
  ItemPatchT,
  KosztorysStageT,
  KosztorysTreeT,
  KosztorysV2RowT,
  ToolPlaneT,
} from '@/lib/kosztorys/types'

type ArgsT = {
  investmentId: number
  tree: KosztorysTreeT
  clientView?: boolean
  undoRedo: UndoRedoApiT
}

// A reorder command records the two rows' ids and pre-swap orders. FieldChangeT/StageChangeT (the
// per-field / per-stage before+after a grid batch records) live with the burst-coalescing reducer.
type OrderRefT = { id: number; order: number }

// Grace period after the last keystroke before a grid edit burst becomes one undo entry. Longer
// than the debounced save (500ms) so a command is captured only once the writes for the burst have
// been scheduled — never mid-typing.
const UNDO_COALESCE_MS = 700

// All editor state, derived data, and handlers for the in-app kosztorys grid. Kept out of the
// component so the component is only composition + markup. Handlers never fire an action from
// inside a setRows updater — that would move the Router during render.
export function useKosztorysEditor({ investmentId, tree, clientView = false, undoRedo }: ArgsT) {
  const router = useRouter()
  const { save, runNow } = useDebouncedSave(500)
  // Per-mount undo/redo stack, owned by the shell (KosztorysEditorV2) and passed in. Capture pushes
  // here; the toolbar + keyboard call undo/redo (re-exported below).
  const { push, undo, redo, canUndo, canRedo, pruneByIds } = undoRedo
  const [gridRef, gridHeight] = useElementHeight()
  const [rows, setRows] = useState<KosztorysV2RowT[]>(() => treeToRows(tree))
  // Stages live in local state (like `rows`): add/remove optimistically add/drop a column.
  const [stages, setStages] = useState<KosztorysStageT[]>(tree.stages)
  // Global discount in local state (like `rows`/`stages`): the toggle patches it optimistically so
  // the derived total, column visibility, and per-item suppression all move in one render. Reading
  // `tree.globalDiscount` instead would leave the total + columns lagging the row flag until
  // router.refresh() lands — the transient the "never disagree" invariant below forbids.
  const [globalDiscount, setGlobalDiscount] = useState<GlobalDiscountT>(tree.globalDiscount)
  const globalDiscountActive = isGlobalDiscountActive(globalDiscount)
  const [persistedView, setView] = usePriceView(investmentId)
  // clientView pins the price plane to 'client'. The public page ships the full tree (coefficients
  // included), so an un-pinned view would let a client set localStorage['kosztorys-view:<id>'] to a
  // subcontractor view and make the allowlisted price/net/gross columns render the contractor's cost
  // basis. This is the render-side half of the disclosure lock the deleted toClientView used to hold.
  const view = clientView ? 'client' : persistedView
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<V2SortStateT>(null)
  // Which sections are folded shut under their band — the single description of what the grid shows,
  // driven both by a band's own chevron and by the „Sekcje" menu (unticking folds rather than
  // filtering the rows away, so a hidden section still announces itself and its total). Deliberately
  // NOT persisted: a fold is a reading gesture for the current session, and a remembered one would
  // greet the next visit with rows the user can't see and doesn't remember hiding.
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  )
  // Column widths: persisted in localStorage, committed on handle release (not per pointermove —
  // that would be a write per pixel). During the drag we only show a vertical guide
  // (guideX = cursor X), without touching the grid.
  const { widths, setWidth, dropWidth } = useColumnWidths()
  const { isHidden, toggleColumn, setAllColumns } = useHiddenColumns()
  const [moneyAxis, setMoneyAxis] = useMoneyAxis()
  // Subcontractor views (Z narzędziami / Bez narzędzi) are paid without VAT (EX-558), so brutto is
  // meaningless there — lock the axis to net regardless of the persisted value, matching the hidden
  // Kwoty control. clientView ignores the persisted axis entirely: the client reads the plane the
  // investment is settled on, so its grid can't disagree with the Podsumowanie panel beside it. That
  // guarantee is client-side only — the owner's „Kwoty" pick deliberately stays a per-person column
  // preference, so an owner can read netto in the grid while the panel shows brutto.
  const effectiveMoneyAxis: MoneyAxisT = clientView
    ? settlementModeToGridAxis(tree.settlementMode)
    : view !== 'client'
      ? 'net'
      : moneyAxis === 'none'
        ? 'both'
        : moneyAxis
  const [progressDisplay, setProgressDisplay] = useProgressDisplay()
  const [layer, setLayer] = useLayer()
  const [guideX, setGuideX] = useState<number | null>(null)
  // Snapshot of the previous rows for diffing (keyed by item id) — the full dataset, not the view.
  // It also serves as the "fresh dataset" read by structural event handlers (section count):
  // kept in sync on every add/remove/edit, so no separate ref for rows is needed.
  const prevById = useRef(new Map(rows.map((r) => [r.id, r])))
  // "Latest value" ref: the fresh `rows` (display order) read during an event-time reorder, since
  // firing an action inside the setRows updater would update the Router during render (a React
  // error). Writing a ref during render is the well-known, safe "latest value" pattern.
  // NOTE (EX-422): these two refs were introduced to dodge a mount-frozen column closure, which no
  // longer exists — the grid is on the reactive `DynamicDataSheetGrid` export as of `ee497cb`, so
  // its closures are rebuilt each render. Kept deliberately as the rollback path; whether they are
  // still load-bearing is EX-422's own follow-up, not a freebie to delete alongside it.
  const rowsRef = useRef(rows)
  // eslint-disable-next-line react-hooks/refs
  rowsRef.current = rows
  // Persisted display_order per section, seeded at mount like `rows` and kept current on
  // add/append/move. The grid rows carry no section order (the array's block sequence IS the order),
  // so a section move needs this to know which two numbers to exchange in the DB.
  const sectionOrderRef = useRef(new Map(tree.sections.map((s) => [s.id, s.displayOrder])))
  // Same, for the stage-rename handler's no-op guard (compares against the fresh label).
  const stagesRef = useRef(stages)
  // eslint-disable-next-line react-hooks/refs
  stagesRef.current = stages

  // Grid edit burst awaiting a coalesced undo entry (see UNDO_COALESCE_MS). onChange appends each
  // keystroke's changes here; the flush timer collapses them into a single command once typing stops.
  const pendingFields = useRef<FieldChangeT[]>([])
  const pendingStages = useRef<StageChangeT[]>([])
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Reactive mirror of "a burst is buffering" (the refs above aren't reactive). Drives canUndo during
  // the ≤700ms coalesce window so the toolbar button and keyboard Cmd+Z agree: a first-edit keystroke
  // enables Undo immediately (Cmd+Z flushes-then-undoes), instead of the button staying greyed until
  // flush while the shortcut already works (EX-526 #5).
  const [hasPendingBurst, setHasPendingBurst] = useState(false)

  // Collapse the buffered burst into one undo command (before=first seen, after=last), dropping a
  // net-zero burst (type-then-revert) entirely so it never lands a dead entry on the stack.
  function flushUndoBuffer() {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current)
      flushTimer.current = null
    }
    const fields = coalesceFieldChanges(pendingFields.current)
    const stages = coalesceStageChanges(pendingStages.current)
    pendingFields.current = []
    pendingStages.current = []
    setHasPendingBurst(false)
    if (fields.length === 0 && stages.length === 0) return
    const touchedIds = [...new Set([...fields.map((c) => c.id), ...stages.map((c) => c.id)])]
    push({
      label: 'Edycja',
      undo: () => runGridReversal(fields, stages, 'undo'),
      redo: () => runGridReversal(fields, stages, 'redo'),
      touchedIds,
    })
  }

  // A failed save can filter the last entry out of the burst buffers; if that empties them, cancel the
  // pending flush and clear the reactive flag so canUndo stops reporting a burst that no longer exists
  // (otherwise the Undo button stays enabled for the rest of the window but has nothing to flush).
  function clearBurstIfEmpty() {
    if (pendingFields.current.length > 0 || pendingStages.current.length > 0) return
    if (flushTimer.current) {
      clearTimeout(flushTimer.current)
      flushTimer.current = null
    }
    setHasPendingBurst(false)
  }

  // A failed save's revert calls one of these to pull its now-reverted change out of the buffered
  // burst (EX-526 #4), then re-checks whether that emptied the buffer.
  function dropPendingField(id: number, field: keyof ItemPatchT) {
    pendingFields.current = pendingFields.current.filter((c) => !(c.id === id && c.field === field))
    clearBurstIfEmpty()
  }

  function dropPendingStage(id: number, stageId: number) {
    pendingStages.current = pendingStages.current.filter(
      (c) => !(c.id === id && c.stageId === stageId),
    )
    clearBurstIfEmpty()
  }

  // A restore remounts the body; drop any dangling burst timer so a pending flush can't push a
  // command closing over the outgoing mount's setRows/prevById.
  useEffect(() => {
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current)
    }
  }, [])

  // Push a structural command (reorder / rename / coeff / VAT) — flushing any still-buffering grid
  // edit first, so a burst typed just before the structural action keeps its correct chronological
  // (LIFO) place on the stack instead of being pushed after it.
  function pushCommand(cmd: Parameters<typeof push>[0]) {
    flushUndoBuffer()
    push(cmd)
  }

  // A structural command whose reversal is just re-running one `apply` with the before/after state —
  // direction is expressed by which argument is replayed, so undo and redo share the same function.
  function pushReversible<T>(label: string, apply: (state: T) => void, before: T, after: T) {
    pushCommand({ label, undo: () => apply(before), redo: () => apply(after) })
  }

  function setSortField(field: string, dir: SortDirT | null) {
    setSort(dir ? { field, dir } : null)
  }

  // One O(n) pass feeding the render-hot getRemovePlan (see below) an O(1) per-row lookup.
  const removalCounts = sectionItemCounts(rows)

  // onRemoveItem/onReorderItem read prevById.current / rowsRef.current — stable refs —
  // only from a cell's onClick, never during render, so passing them here is safe.
  // In clientView the grid is read-only (buildV2Grid disables every cell + drops the action column)
  // and column-filtered to the client-visible set, so every DATA-MUTATION callback is dropped — there
  // is no control left that could fire them. Column resize (onGuide/onCommitColumn) is the exception:
  // it only moves a localStorage width, never touches the server, so a client keeps it for readability.
  // Sort is dropped (headers render as plain labels) — the client sees a fixed, non-interactive order.
  // Wired only in the interactive editor render, dropped in the read-only client view. The gate is
  // the render mode, NOT a role — OWNER/MANAGER/ADMIN all edit; the client (no login) does not.
  const editorOnly = <T>(handler: T): T | undefined => (clientView ? undefined : handler)
  const columnOpts = {
    view,
    stages,
    onRemoveStage: editorOnly(handleRemoveStage),
    onRenameStage: editorOnly(handleRenameStage),
    onSetStagePlane: editorOnly(handleSetStagePlane),
    sort,
    onSetSort: editorOnly(setSortField),
    isHidden,
    moneyAxis: effectiveMoneyAxis,
    progressDisplay,
    layer,
    widths,
    onGuide: setGuideX,
    onCommitColumn: setWidth,
    onRemoveItem: editorOnly(handleRemoveItem),
    onReorderItem: editorOnly(handleReorderItem),
    onInsertItem: editorOnly(handleInsertItem),
    onRenameSection: editorOnly(handleRenameSection),
    getRemovePlan: editorOnly(getRemovePlan),
    globalDiscountActive,
    readOnly: clientView || undefined,
    clientVisible: clientView || undefined,
  }
  const { columns, columnToggleItems } = buildV2Grid(columnOpts)
  // A column sort must not outlive its column. A money-axis or view toggle can drop the sorted
  // column, taking its SortHeader — the only control that clears the sort — with it, while the sort
  // state lingers: the rows freeze in an unexplained order and the row actions stay disabled with no
  // way to re-enable them (EX-486). Forget the sort when its field stops rendering. Cleared as real
  // state, not derived, so it does not resurrect if the column later returns (owner, 2026-07-17).
  // setState during render is React's sanctioned "adjust state on an input change" path: the
  // condition bails the loop, and this render (its columns built with the stale sort) is discarded
  // before commit — the column set is sort-independent, so the retry rebuilds the same columns.
  const renderedFieldIds = new Set(
    columns.map((c) => c.id).filter((id): id is string => id != null),
  )
  if (reconcileSort(sort, renderedFieldIds) !== sort) setSort(null)

  // Per-section subtotals: the FULL dataset (not viewRows) — a stable breakdown independent of
  // the filter/sort. Sits above viewRows because „Zwiń puste sekcje" reads its net.
  const subtotals = useMemo(() => sectionSubtotalsForView(rows, stages, view), [rows, stages, view])
  // Feeds the filter menu's „Zwiń puste sekcje" row — both its count and the ids it unticks. That
  // row folds by unticking rather than filtering rows on its own, so the picker's checkmarks stay
  // the single description of what the grid shows.
  const emptySections = useMemo(() => emptySectionIds(subtotals), [subtotals])

  function toggleSectionCollapsed(sectionId: number) {
    setCollapsedSectionIds((prev) => {
      const next = new Set(prev)
      if (!next.delete(sectionId)) next.add(sectionId)
      return next
    })
  }

  // View = search + sort. Sections are not filtered here: hiding one is a fold, applied further down
  // by buildSectionHeaderRows so the band survives its own collapse.
  const viewRows = useMemo(() => {
    const filtered = filterRows(rows, search)
    if (!sort) return filtered
    return sortRows(filtered, (r) => columnSortValue(r, sort.field, view, stages), sort.dir)
  }, [rows, search, sort, view, stages])
  // Executed total at the active view — the money the totals bar shows and the base the global
  // discount comes off. Full-dataset (like the subtotals): a search or section filter must not move it.
  const totalNet = useMemo(() => subtotals.reduce((s, x) => s + x.net, 0), [subtotals])
  // Per-etap „suma transzy" at the active view — the executed value each stage delivered. Full-dataset
  // (like the subtotals): Σ over stages equals totalNet, so the etap totals and the wykonane readout
  // reconcile by construction.
  const stageTotals = useMemo(() => stageTotalsForView(rows, stages, view), [rows, stages, view])
  // Σ recorded qty per etap (the „Pomiar z natury" the column footer totals) — full-dataset, price-
  // independent, so a search/section filter or a view switch never moves it.
  const stageQtyTotals = useMemo(() => {
    const totals = new Map<number, number>()
    for (const stage of stages)
      totals.set(
        stage.id,
        rows.reduce((sum, row) => sum + ((row[stageKey(stage.id)] as number | undefined) ?? 0), 0),
      )
    return totals
  }, [rows, stages])
  const plannedQtyTotal = useMemo(
    () => rows.reduce((sum, row) => sum + (row.plannedQty ?? 0), 0),
    [rows],
  )
  // Σ of the „Pozostało" columns for the grid's Razem row. Rows with no przedmiar read `null` — no
  // offer to subtract from — and are skipped, so the total is the sum of what the column actually
  // shows rather than of a 0 it never claimed. Gross accumulates each row's own VAT instead of
  // grossing the net sum once, so a row-level vatRate can't drift the two apart.
  const remainingTotals = useMemo(() => {
    let net = 0
    let gross = 0
    for (const row of rows) {
      const rowNet = rowRemainingForView(row, stages, view)
      if (rowNet === null) continue
      net += rowNet
      gross += toGross(rowNet, row.vatRate)
    }
    return { net, gross }
  }, [rows, stages, view])
  // The progress counter is a PROGRESS figure, not money — it must read the same in every price view,
  // so its executed/offered are weighted at the client price (a separate client-priced pass), never
  // the active `view`. Same client basis as each section's completionRatio.
  const progressSubtotals = useMemo(
    () => sectionSubtotalsForView(rows, stages, 'client'),
    [rows, stages],
  )
  // doneNet feeds the progress counter (÷ plannedNet, both post-rabat); sumaPracNet + rabatClientNet
  // feed the reconciliation and route through the shared helper the investment page also calls, so the
  // two verification surfaces can't drift (reconciliation, lessons.md). All three are client-view and
  // view-independent — the progress ratio and the robocizna/rabat comparison must not move with the
  // price-view toggle.
  const { doneNet, sumaPracNet, rabatClientNet, globalRabatNet } = useMemo(
    () => clientTotalsFromSubtotals(progressSubtotals, globalDiscount),
    [progressSubtotals, globalDiscount],
  )
  const plannedNet = useMemo(
    () => progressSubtotals.reduce((s, x) => s + x.plannedNet, 0),
    [progressSubtotals],
  )

  // NOT the „Do zapłaty" the UI shows — that one adds materiały and subtracts wpłaty
  // (computeDoZaplatyRM). This is robocizna alone, after rabat. Both total surfaces (the Sekcje Suma
  // block and the totals bar) read this one prop, so they can never disagree.
  const laborCostsNetFromKosztorys = doneNet - globalRabatNet

  // „Suma wykonanej pracy" (należne) for the subcontractor summary — view-INDEPENDENT: each etap
  // valued at its own plane's price, split + combined. Reactive to unsaved edits via [rows, stages];
  // no `view` dependency (the settlement is the same in both subcontractor views, honest on mixed).
  const subcontractorDue = useMemo(() => subcontractorDueByPlane(rows, stages), [rows, stages])

  // revert-on-error: roll an optimistic field edit back to its pre-save value
  // (rows + diff snapshot) when the server rejects it. The "current === attempted" guard lives
  // in revertField — we don't stomp on a newer edit.
  function revertOne(
    id: number,
    field: keyof KosztorysV2RowT,
    prevVal: unknown,
    attempted: unknown,
  ) {
    setRows((rs) => revertField(rs, id, field, prevVal, attempted))
    const snap = prevById.current.get(id)
    if (snap && snap[field] === attempted) {
      prevById.current.set(id, { ...snap, [field]: prevVal } as KosztorysV2RowT)
    }
  }

  // Apply one direction of a captured grid-edit batch (undo → `before`, redo → `after`). Unlike an
  // autosave, an undo is a deliberate user action: it writes the target value immediately and updates
  // `rows` + `prevById` in lockstep so the next onChange diff doesn't re-fire the write. Each inverse
  // write goes through `runNow`, which serializes it on the cell's lane behind any in-flight forward
  // save (EX-526 #1) and routes a failed inverse through the same toast + `revertOne` rollback as a
  // forward save (EX-526 #3) — so a rejected write can't escape as an unhandled rejection or leave the
  // grid diverged from the DB.
  async function runGridReversal(
    fields: FieldChangeT[],
    stages: StageChangeT[],
    dir: 'undo' | 'redo',
  ) {
    // Merge every change of one row into a single patch so multi-field/-stage rows apply at once.
    const patchById = new Map<number, Record<string, unknown>>()
    for (const c of fields) {
      const patch = patchById.get(c.id) ?? {}
      patch[c.field as string] = dir === 'undo' ? c.before : c.after
      patchById.set(c.id, patch)
    }
    for (const c of stages) {
      const patch = patchById.get(c.id) ?? {}
      patch[stageKey(c.stageId)] = dir === 'undo' ? c.before : c.after
      patchById.set(c.id, patch)
    }
    setRows((rs) =>
      rs.map((r) =>
        patchById.has(r.id) ? ({ ...r, ...patchById.get(r.id) } as KosztorysV2RowT) : r,
      ),
    )
    for (const [id, patch] of patchById) {
      const snap = prevById.current.get(id)
      if (snap) prevById.current.set(id, { ...snap, ...patch } as KosztorysV2RowT)
    }
    // Each inverse goes through its cell's lane. On failure the lane toasts AND we roll the optimistic
    // apply back to its pre-reversal value via `revertOne` — the trailing `router.refresh()` can't do it
    // (`rows` is the mount-frozen useState seed, EX-441, so refresh reseeds the prop surfaces but not the
    // grid), so without this a rejected inverse would leave the grid diverged from the DB behind a toast.
    const writes: Promise<void>[] = []
    for (const c of fields) {
      const value = dir === 'undo' ? c.before : c.after
      const restore = dir === 'undo' ? c.after : c.before
      writes.push(
        runNow(
          `item:${c.id}:${String(c.field)}`,
          () => updateItemFieldAction(c.id, { [c.field]: value } as ItemPatchT),
          () => revertOne(c.id, c.field as keyof KosztorysV2RowT, restore, value),
        ),
      )
    }
    for (const c of stages) {
      const value = dir === 'undo' ? c.before : c.after
      const restore = dir === 'undo' ? c.after : c.before
      writes.push(
        runNow(
          `progress:${c.id}:${c.stageId}`,
          () => setStageProgressAction(c.id, c.stageId, value),
          () => revertOne(c.id, stageKey(c.stageId) as keyof KosztorysV2RowT, restore, value),
        ),
      )
    }
    await Promise.all(writes)
    // Pull recomputed section/stage totals once the inverse writes have committed.
    router.refresh()
  }

  // Reverse (or replay) a ▲▼ swap: exchange the two rows' array positions and re-issue the
  // display_order swap. Self-inverse — undo restores each row's pre-swap order, redo re-applies the
  // original. Matches handleReorderItem: no prevById touch (display_order isn't a diffed field) and
  // no totals refresh (a reorder doesn't change any figure).
  function runReorderReversal(a: OrderRefT, b: OrderRefT, dir: 'undo' | 'redo') {
    setRows((rs) => {
      const ia = rs.findIndex((r) => r.id === a.id)
      const ib = rs.findIndex((r) => r.id === b.id)
      if (ia < 0 || ib < 0) return rs
      const next = [...rs]
      ;[next[ia], next[ib]] = [next[ib], next[ia]]
      return next
    })
    void swapItemOrderAction(
      { id: a.id, displayOrder: dir === 'undo' ? a.order : b.order },
      { id: b.id, displayOrder: dir === 'undo' ? b.order : a.order },
    )
  }

  async function handleAddItem(sectionId: number) {
    const res = await addItemAction(sectionId)
    if (!res.success) return
    // Take the denormalized section fields from any existing row of that section.
    const sample = [...prevById.current.values()].find((r) => r.sectionId === sectionId)
    const row = buildBlankRow({
      id: res.data.id,
      displayOrder: res.data.displayOrder,
      sectionId,
      sectionName: sample?.sectionName ?? NEW_SECTION_DEFAULTS.name,
      sectionColor: sample?.sectionColor ?? null,
      vatRate: tree.vatRate,
      globalDiscountActive,
      sectionDefaultCostVariant:
        sample?.sectionDefaultCostVariant ?? NEW_SECTION_DEFAULTS.defaultCostVariant,
      globalWToolsCoeff: tree.globalCoeffs.wTools,
      globalOwnToolsCoeff: tree.globalCoeffs.ownTools,
      stages,
    })
    prevById.current.set(row.id, row)
    setRows((rs) => applyAddItem(rs, row))
    // A row added to a folded section would be invisible — unfold it so the add is visible.
    setCollapsedSectionIds((prev) => {
      if (!prev.has(sectionId)) return prev
      const next = new Set(prev)
      next.delete(sectionId)
      return next
    })
  }

  // ⋯ menu → Wstaw pozycję powyżej/poniżej. Inserts a blank row at the anchor's display slot
  // (±1) within the anchor's section. "Above/below" has no meaning against a price-sorted view, so
  // it's a no-op while a column sort is active (the menu also disables it). Denormalized section
  // fields come from any existing row of that section (as in handleAddItem).
  async function handleInsertItem(anchorRow: KosztorysV2RowT, dir: 'above' | 'below') {
    if (sort) return
    const at = insertDisplayOrder(anchorRow, dir)
    const res = await insertItemAction(anchorRow.sectionId, at)
    if (!res.success) return
    const sample =
      [...prevById.current.values()].find((r) => r.sectionId === anchorRow.sectionId) ?? anchorRow
    const row = buildBlankRow({
      id: res.data.id,
      displayOrder: res.data.displayOrder,
      sectionId: anchorRow.sectionId,
      sectionName: sample.sectionName,
      sectionColor: sample.sectionColor,
      vatRate: tree.vatRate,
      globalDiscountActive,
      sectionDefaultCostVariant: sample.sectionDefaultCostVariant,
      globalWToolsCoeff: tree.globalCoeffs.wTools,
      globalOwnToolsCoeff: tree.globalCoeffs.ownTools,
      stages,
    })
    // Mirror the section-tail display_order bump in prevById so a later insert/▲▼ diffs correctly.
    for (const [id, r] of prevById.current) {
      if (r.sectionId === row.sectionId && r.displayOrder >= at) {
        prevById.current.set(id, { ...r, displayOrder: r.displayOrder + 1 })
      }
    }
    prevById.current.set(row.id, row)
    setRows((rs) => applyInsertItem(rs, anchorRow.id, row, dir))
  }

  // What deleting a row does — read at event time from the full dataset (prevById), not the view,
  // so the handler decides on accurate counts. The render-hot per-cell path uses getRemovePlan.
  function removalPlan(row: KosztorysV2RowT) {
    return planItemRemoval([...prevById.current.values()], row, stagesRef.current)
  }

  // Render-hot: called per cell. Counts are precomputed once per render (removalCounts below), so this
  // is O(1) per row — going through removalPlan (which spreads prevById and rescans per row) here would
  // make the whole grid's per-row delete plan O(n²).
  function getRemovePlan(row: KosztorysV2RowT): ItemRemovalPlanT {
    return planItemRemovalFromCounts(
      rows.length,
      removalCounts.get(row.sectionId) ?? 0,
      row,
      stagesRef.current,
    )
  }

  async function handleRemoveItem(row: KosztorysV2RowT) {
    const plan = removalPlan(row)
    // Backstop: the trash button is disabled when a reason exists, so this is normally unreachable.
    if (plan.kind === 'blocked') {
      toastMessage(plan.reason, 'warning', 4000)
      return
    }
    // Last item in its section → cascade-delete the section so no orphaned 0-row section is left.
    if (plan.kind === 'cascade-section') {
      await handleRemoveSection(row.sectionId)
      return
    }
    const rowsAtRemoval = rowsRef.current
    const removedAt = rowsAtRemoval.findIndex((r) => r.id === row.id)
    const afterId = removedAt > 0 ? rowsAtRemoval[removedAt - 1].id : null
    prevById.current.delete(row.id)
    setRows((rs) => applyRemoveItem(rs, row.id))
    // Flush any still-buffering burst into a command first, then drop every stack command touching the
    // deleted row — otherwise undoing one would fire writes against a dead id and `setStageProgressAction`
    // (an absolute upsert) could recreate an orphan stage row (EX-526 #2).
    flushUndoBuffer()
    pruneByIds([row.id])
    const res = await removeItemAction(row.id)
    if (!res.success) {
      // Server rejected (client/server predicate drift) — restore the row after the neighbor it
      // followed, resolved against the current rows so a concurrent edit during the await can't
      // misplace it (applyAddItem would re-append it at the grid's end). The pruned undo history for
      // this row stays gone — a rare failure path on throwaway data, not worth reconstructing.
      prevById.current.set(row.id, row)
      setRows((rs) => applyRestoreItem(rs, row, afterId))
      toastMessage(res.error ?? 'Nie udało się usunąć pozycji', 'warning', 4000)
    }
  }

  function handleReorderItem(row: KosztorysV2RowT, dir: 'up' | 'down') {
    const rs = rowsRef.current
    const neighbor = sectionNeighbor(rs, row.id, dir)
    if (!neighbor) return // edge of the block → no-op
    setRows(swapItemInSection(rs, row.id, dir))
    // ▲▼ is a swap of two neighbors → we only exchange their display_order (2 updates, not a
    // renumbering of the whole section — that choked with 1000+ rows). The action fires from the
    // event handler, not from the setRows updater (there its cache revalidation would move the Router during render).
    void swapItemOrderAction(
      { id: row.id, displayOrder: neighbor.displayOrder },
      { id: neighbor.id, displayOrder: row.displayOrder },
    )
    const a: OrderRefT = { id: row.id, order: row.displayOrder }
    const b: OrderRefT = { id: neighbor.id, order: neighbor.displayOrder }
    pushCommand({
      label: 'Zmiana kolejności',
      undo: () => runReorderReversal(a, b, 'undo'),
      redo: () => runReorderReversal(a, b, 'redo'),
      touchedIds: [a.id, b.id],
    })
  }

  // Mirrors handleReorderItem one level up: the grid regroups its blocks, the DB exchanges the two sections' display_order (2 updates, not a renumbering). Returns
  // false at the edge so the undo command isn't pushed for a no-op.
  function applySectionSwap(sectionId: number, dir: 'up' | 'down') {
    const neighborId = neighborSectionId(rowsRef.current, sectionId, dir)
    if (neighborId == null) return false
    const orders = sectionOrderRef.current
    const order = orders.get(sectionId)
    const neighborOrder = orders.get(neighborId)
    if (order == null || neighborOrder == null) return false
    setRows((rs) => swapSectionBlock(rs, sectionId, dir))
    orders.set(sectionId, neighborOrder)
    orders.set(neighborId, order)
    void swapSectionOrderAction(
      { id: sectionId, displayOrder: neighborOrder },
      { id: neighborId, displayOrder: order },
    )
    return true
  }

  function handleReorderSection(sectionId: number, dir: 'up' | 'down') {
    // „w górę/w dół" has no meaning against a price-sorted view (the menu also disables it).
    if (sort) return
    // Captured BEFORE the swap: deleting the section later prunes this command, so an undo can
    // never re-derive a neighbour from rows the section no longer has.
    const touchedIds = rowsRef.current.filter((r) => r.sectionId === sectionId).map((r) => r.id)
    if (!applySectionSwap(sectionId, dir)) return
    const back = dir === 'up' ? 'down' : 'up'
    pushCommand({
      label: 'Zmiana kolejności sekcji',
      undo: () => void applySectionSwap(sectionId, back),
      redo: () => void applySectionSwap(sectionId, dir),
      touchedIds,
    })
  }

  // The first row of a brand-new section: the section's own fields are still the defaults the action
  // just wrote, so they come from NEW_SECTION_DEFAULTS rather than a round trip.
  function buildNewSectionRow(sectionId: number, item: { id: number; displayOrder: number }) {
    return buildBlankRow({
      id: item.id,
      displayOrder: item.displayOrder,
      sectionId,
      sectionName: NEW_SECTION_DEFAULTS.name,
      sectionColor: null,
      vatRate: tree.vatRate,
      globalDiscountActive,
      sectionDefaultCostVariant: NEW_SECTION_DEFAULTS.defaultCostVariant,
      globalWToolsCoeff: tree.globalCoeffs.wTools,
      globalOwnToolsCoeff: tree.globalCoeffs.ownTools,
      stages,
    })
  }

  // ⋯ → Sekcje → Wstaw powyżej/poniżej. The section-level twin of handleInsertItem: a new section
  // (plus its first blank item — a 0-item section renders as 0 rows) lands right before or after the
  // anchor section instead of at the end.
  async function handleInsertSection(anchorSectionId: number, dir: 'above' | 'below') {
    if (sort) return
    const anchorOrder = sectionOrderRef.current.get(anchorSectionId)
    if (anchorOrder == null) return
    const at = dir === 'above' ? anchorOrder : anchorOrder + 1
    const sec = await insertSectionAction(investmentId, at)
    if (!sec.success) return
    // The tail shift has COMMITTED, so mirror it before anything else can bail — unlike an item
    // insert (where order is relative within a section), the client caches these absolute numbers
    // and a missed shift makes every later section move exchange the wrong ones.
    for (const [id, order] of sectionOrderRef.current) {
      if (order >= at) sectionOrderRef.current.set(id, order + 1)
    }
    sectionOrderRef.current.set(sec.data.id, at)
    const item = await addItemAction(sec.data.id)
    if (!item.success) return
    const row = buildNewSectionRow(sec.data.id, item.data)
    prevById.current.set(row.id, row)
    setRows((rs) => applyInsertSectionRow(rs, anchorSectionId, row, dir))
  }

  async function handleAddSection() {
    const sec = await addSectionAction(investmentId)
    if (!sec.success) return
    // A new section immediately gets a blank item (an empty section = 0 rows = invisible).
    const item = await addItemAction(sec.data.id)
    if (!item.success) return
    const row = buildNewSectionRow(sec.data.id, item.data)
    sectionOrderRef.current.set(sec.data.id, sec.data.displayOrder)
    prevById.current.set(row.id, row)
    setRows((rs) => applyAddItem(rs, row))
  }

  // Append the sections returned by appendPresetSectionsAction to the grid without a reload. The rows
  // are built through treeToRows (the same denormalization as the initial load), using the CURRENT
  // stages + global discount so the appended rows carry today's stage columns and rabat flag — the
  // action already committed with real ids, so no temp-id reconciliation. router.refresh() alone
  // can't add them (mount-frozen `rows`, EX-441); it still runs for the prop-reading surfaces.
  function handleAppendedSections(slice: KosztorysTreeT['sections']) {
    const appended = treeToRows({
      sections: slice,
      stages,
      progress: [],
      globalCoeffs: tree.globalCoeffs,
      vatRate: tree.vatRate,
      settlementMode: tree.settlementMode,
      globalDiscount,
      revision: tree.revision,
    })
    for (const section of slice) sectionOrderRef.current.set(section.id, section.displayOrder)
    for (const row of appended) prevById.current.set(row.id, row)
    setRows((rs) => [...rs, ...appended])
    router.refresh()
  }

  // --- Stages (etapy) ---

  // A new stage adds a `stage_<id>: 0` key to every current row + snapshot (like patchRows for
  // coeffs), so the column renders 0s (not blanks) and the first progress entry diffs correctly.
  async function handleAddStage(plane: ToolPlaneT) {
    const res = await addStageAction(investmentId, plane)
    if (!res.success) return
    const { id, ordinal } = res.data
    setStages((s) => [...s, { id, ordinal, label: null, plane }])
    patchRows(
      () => true,
      (r) => ({ ...r, [stageKey(id)]: 0 }),
    )
  }

  async function handleRemoveStage(stageId: number) {
    const res = await removeStageAction(stageId)
    if (!res.success) {
      toastMessage(res.error ?? 'Nie udało się usunąć etapu', 'warning', 4000)
      return
    }
    setStages((s) => s.filter((st) => st.id !== stageId))
    const key = stageKey(stageId)
    dropWidth(
      key,
      stageValueNetKey(stageId),
      stageValueGrossKey(stageId),
      stageValuePercentKey(stageId),
    )
    patchRows(
      () => true,
      (r) => {
        const next = { ...r }
        delete next[key]
        return next
      },
    )
  }

  // Optimistic rename; an empty label reverts to null (the header shows the "Etap N" placeholder).
  // Guard against a no-op write: the header's onBlur fires on every focus-out, so skip when the
  // label is unchanged (the header has no diff of its own, unlike item cells via diffRow).
  function handleRenameStage(stageId: number, label: string) {
    const trimmed = label.trim()
    const next = trimmed === '' ? null : trimmed
    const current = stagesRef.current.find((st) => st.id === stageId)
    if (current && current.label === next) return
    const prevLabel = current?.label ?? null
    setStages((s) => s.map((st) => (st.id === stageId ? { ...st, label: next } : st)))
    // Route through the debounced saver for the same revert-on-error discipline as cell edits.
    // The revert restores the prior label only if nothing newer was typed (label still === next).
    save(
      `stage-label:${stageId}`,
      () => updateStageAction(stageId, { label: next }),
      () =>
        setStages((s) =>
          s.map((st) =>
            st.id === stageId && st.label === next ? { ...st, label: prevLabel } : st,
          ),
        ),
    )
  }

  // Optimistic plane pick. Fired from the header's onValueChange (an event handler, never inside a
  // state updater), with the same revert-on-error discipline as the rename saver. Picking any plane
  // (even the default w_tools) writes it, which is what clears the unconfirmed warning.
  function handleSetStagePlane(stageId: number, plane: ToolPlaneT) {
    const current = stagesRef.current.find((st) => st.id === stageId)
    if (current && current.plane === plane) return
    const prevPlane = current?.plane ?? null
    setStages((s) => s.map((st) => (st.id === stageId ? { ...st, plane } : st)))
    save(
      `stage-plane:${stageId}`,
      () => updateStageAction(stageId, { plane }),
      () =>
        setStages((s) =>
          s.map((st) =>
            st.id === stageId && st.plane === plane ? { ...st, plane: prevPlane } : st,
          ),
        ),
    )
  }

  async function handleRemoveSection(sectionId: number) {
    // The summary confirms before calling here (EX-477); a populated section cascade-deletes its
    // items + stage_progress server-side, guarded only by the confirm dialog, not a block.
    const removed = rowsRef.current
      .filter((r) => r.sectionId === sectionId)
      .map((r) => prevById.current.get(r.id) ?? r)
    setRows((rs) => rs.filter((r) => r.sectionId !== sectionId))
    for (const [id, r] of prevById.current) {
      if (r.sectionId === sectionId) prevById.current.delete(id)
    }
    // Drop stack commands touching any of the cascade-deleted rows (EX-526 #2) — see handleRemoveItem.
    flushUndoBuffer()
    pruneByIds(removed.map((r) => r.id))
    // collapsedSectionIds is left alone: with no rows there is no band to fold, so a leftover id is
    // inert — and it keeps the section's fold state if the server rejects and the rows come back.
    const res = await removeSectionAction(sectionId)
    if (!res.success) {
      // Server rejected (predicate drift) — restore the section's rows and surface the block.
      for (const r of removed) prevById.current.set(r.id, r)
      setRows((rs) => [...rs, ...removed])
      toastMessage(res.error ?? 'Nie udało się usunąć sekcji', 'warning', 4000)
    }
  }

  // A section field is denormalized on every row of the section, so setting one patches them all
  // (rows + prevById) and persists once. The two fields differ only in which row key mirrors which
  // column, so they share one pathway rather than growing a third copy for defaultCostVariant.
  const SECTION_ROW_FIELDS = { sectionName: 'name', sectionColor: 'color' } as const
  type SectionRowFieldT = keyof typeof SECTION_ROW_FIELDS

  // Extracted from the handler so undo/redo can re-run it with the before/after value: unlike a grid
  // cell, a section field fires the action directly, not via the debounced saver — nothing to cancel.
  function applySectionField<K extends SectionRowFieldT>(
    sectionId: number,
    rowKey: K,
    value: KosztorysV2RowT[K],
  ) {
    patchRows(
      (r) => r.sectionId === sectionId,
      (r) => ({ ...r, [rowKey]: value }),
    )
    void updateSectionFieldAction(sectionId, { [SECTION_ROW_FIELDS[rowKey]]: value })
  }

  // Bails on a no-op write: the Sekcja cell's onBlur fires on every focus-out and the colour picker
  // stays open across clicks, so both can re-send the value they already hold.
  function handleSetSectionField<K extends SectionRowFieldT>(
    sectionId: number,
    rowKey: K,
    value: KosztorysV2RowT[K],
    undoLabel: string,
  ) {
    const before = rowsRef.current.find((r) => r.sectionId === sectionId)?.[rowKey]
    if (before === undefined || before === value) return
    applySectionField(sectionId, rowKey, value)
    pushReversible(
      undoLabel,
      (v: KosztorysV2RowT[K]) => applySectionField(sectionId, rowKey, v),
      before,
      value,
    )
  }

  function handleSetSectionColor(sectionId: number, color: SectionColorKeyT | null) {
    handleSetSectionField(sectionId, 'sectionColor', color, 'Zmiana koloru sekcji')
  }

  function handleRenameSection(sectionId: number, name: string) {
    handleSetSectionField(sectionId, 'sectionName', name, 'Zmiana nazwy sekcji')
  }

  // Optimistic patch of a denormalized field on the matching rows + prevById (like
  // handleRenameSection for sectionName). The markup coefficients are denormalized on
  // EVERY row, but they are changed OUTSIDE the grid (the panel). router.refresh() alone won't
  // pick them up: `rows` lives in useState with an initializer that runs once at mount, so a
  // refreshed `tree` prop does not reinitialize the rows — without this patch the "Cena" column
  // would show the stale value until a reload.
  function patchRows(
    match: (row: KosztorysV2RowT) => boolean,
    patch: (row: KosztorysV2RowT) => KosztorysV2RowT,
  ) {
    setRows((rs) => rs.map((r) => (match(r) ? patch(r) : r)))
    for (const [id, r] of prevById.current) {
      if (match(r)) prevById.current.set(id, patch(r))
    }
  }

  // Shared tail of every optimistic settings write (global coeff / VAT / discount / section coeff).
  // The caller has already applied its optimistic patch and captured whatever `revert` needs; this
  // persists, then on success refreshes so the panel re-reads `tree`, or on failure runs `revert` and
  // surfaces the error. Tail-only on purpose: the optimistic apply and the pre-patch capture differ
  // per setting and stay at the call site — only this success-or-rollback tail was identical.
  async function optimisticSettingSave(
    persist: () => Promise<{ success: boolean; error?: string }>,
    revert: () => void,
    errorMessage: string,
  ) {
    const res = await persist()
    if (res.success) {
      router.refresh()
      return true
    }
    revert()
    toastMessage(res.error ?? errorMessage, 'warning', 4000)
    return false
  }

  // Changing the global coefficient recomputes the derived prices of all non-overridden items.
  // Optimistic patch on the rows + a refresh for the panel (which reads from `tree`). Extracted so
  // undo/redo can re-run it with a before/after patch of the same keys.
  async function applyGlobalCoeff(patch: { wToolsCoeff?: number; ownToolsCoeff?: number }) {
    // patchRows builds fresh row objects, so `sample` still holds the pre-patch coefficients for the
    // revert. Only the coefficients present in `patch` map to their denormalized row fields.
    const sample = rowsRef.current[0]
    const applied: { globalWToolsCoeff?: number; globalOwnToolsCoeff?: number } = {}
    if (patch.wToolsCoeff != null) applied.globalWToolsCoeff = patch.wToolsCoeff
    if (patch.ownToolsCoeff != null) applied.globalOwnToolsCoeff = patch.ownToolsCoeff
    patchRows(
      () => true,
      (r) => ({ ...r, ...applied }),
    )
    await optimisticSettingSave(
      () => updateInvestmentCoeffsAction(investmentId, patch),
      () => {
        // Roll the optimistic coefficients back so the grid doesn't show an unsaved price (the
        // once-only useState seed means a plain refresh can't reseed it). No-op on an empty kosztorys.
        if (!sample) return
        const restored: { globalWToolsCoeff?: number; globalOwnToolsCoeff?: number } = {}
        if (patch.wToolsCoeff != null) restored.globalWToolsCoeff = sample.globalWToolsCoeff
        if (patch.ownToolsCoeff != null) restored.globalOwnToolsCoeff = sample.globalOwnToolsCoeff
        patchRows(
          () => true,
          (r) => ({ ...r, ...restored }),
        )
      },
      'Nie udało się zapisać współczynnika',
    )
  }

  async function handleGlobalCoeffChange(patch: { wToolsCoeff?: number; ownToolsCoeff?: number }) {
    const before = inverseGlobalCoeffPatch(patch, rowsRef.current[0])
    await applyGlobalCoeff(patch)
    pushReversible('Zmiana współczynnika', applyGlobalCoeff, before, patch)
  }

  // Changing the per-investment VAT rate recomputes every brutto figure. vatRate is denormalized
  // on every row, so patch them all optimistically (router.refresh alone won't reseed `rows` — the
  // useState initializer runs once at mount); then persist + refresh for the panel. `vatRate` is a
  // fraction (0.08), converted from the panel's percent input at the commit site.
  async function applyVat(vatRate: number) {
    const prevVatRate = rowsRef.current[0]?.vatRate
    patchRows(
      () => true,
      (r) => ({ ...r, vatRate }),
    )
    await optimisticSettingSave(
      () => updateInvestmentVatAction(investmentId, vatRate),
      () => {
        // Roll the optimistic VAT back (no-op when there were no rows to patch). The toast still fires
        // regardless — it lives in optimisticSettingSave, so an empty kosztorys can't swallow the failure.
        if (prevVatRate === undefined) return
        patchRows(
          () => true,
          (r) => ({ ...r, vatRate: prevVatRate }),
        )
      },
      'Nie udało się zapisać stawki VAT',
    )
  }

  async function handleVatChange(vatRate: number) {
    const before = rowsRef.current[0]?.vatRate ?? tree.vatRate
    await applyVat(vatRate)
    if (before !== vatRate) pushReversible('Zmiana stawki VAT', applyVat, before, vatRate)
  }

  // The settlement mode isn't denormalized onto the rows, so there's nothing to patch optimistically:
  // persist, then let the refresh reseed `tree` for the panel that reads it.
  async function applySettlementMode(mode: SettlementModeT) {
    await optimisticSettingSave(
      () => updateInvestmentSettlementModeAction(investmentId, mode),
      () => {},
      'Nie udało się zapisać sposobu rozliczenia',
    )
  }

  async function handleSettlementModeChange(mode: SettlementModeT) {
    // On the undo stack like its sibling investment settings — without it Ctrl+Z after a mode flip
    // silently reverts whatever unrelated edit preceded it.
    const before = tree.settlementMode
    await applySettlementMode(mode)
    if (before !== mode)
      pushReversible('Zmiana sposobu rozliczenia', applySettlementMode, before, mode)
  }

  // Setting/clearing the global discount flips per-item rabat on or off for every row. Update the
  // local discount (drives the derived totals + column visibility) and patch the denormalized active
  // flag on every row in the same render, so all three surfaces move together; then persist + refresh.
  async function handleGlobalDiscountChange(next: GlobalDiscountT) {
    const prevDiscount = globalDiscount
    const active = isGlobalDiscountActive(next)
    setGlobalDiscount(next)
    patchRows(
      () => true,
      (r) => ({ ...r, globalDiscountActive: active }),
    )
    await optimisticSettingSave(
      () =>
        updateInvestmentGlobalDiscountAction(investmentId, {
          globalDiscountType: next.type,
          globalDiscountValue: next.value,
        }),
      () => {
        // Roll all three surfaces back so they don't disagree on an unsaved discount.
        setGlobalDiscount(prevDiscount)
        patchRows(
          () => true,
          (r) => ({ ...r, globalDiscountActive: isGlobalDiscountActive(prevDiscount) }),
        )
      },
      'Nie udało się zapisać rabatu',
    )
  }

  // Percent rabat bulk-apply: a one-shot tool, not stored state (unlike handleGlobalDiscountChange).
  // Overwrites every item's per-item rabat with `percent X` — optimistically on the rows, then one
  // bulk SQL update. No undo entry (owner: recovery = re-typing). Returns success so the settings
  // control clears its input only when the write landed.
  async function handleApplyPercentRabat(percent: number): Promise<boolean> {
    const prev = new Map(
      rowsRef.current.map((r) => [
        r.id,
        { discountType: r.discountType, discountValue: r.discountValue },
      ]),
    )
    patchRows(
      () => true,
      (r) => ({ ...r, discountType: 'percent', discountValue: percent }),
    )
    // Roll each row's rabat back to its pre-apply value on failure — the once-only useState seed means
    // a refresh can't reseed it.
    return optimisticSettingSave(
      () => applyPercentRabatToAllItemsAction(investmentId, percent),
      () =>
        patchRows(
          () => true,
          (r) => ({ ...r, ...(prev.get(r.id) ?? {}) }),
        ),
      'Nie udało się zastosować rabatu',
    )
  }

  function onChange(next: KosztorysV2RowT[]) {
    // The load-bearing persistence kill-switch: a clientView grid is read-only, but this guards the
    // one path that could still POST — so no save, undo capture, or refresh ever fires on the public page.
    if (clientView) return
    const changedById = new Map<number, KosztorysV2RowT>()
    // One onChange batch (incl. a multi-cell paste) = one composite undo entry; accumulate every
    // field/stage change here and buffer a single coalesced command after the loop.
    const fieldChanges: FieldChangeT[] = []
    const stageChanges: StageChangeT[] = []
    for (const row of next) {
      const prev = prevById.current.get(row.id)
      if (!prev) continue
      const diff = diffRow(prev, row)
      if (diff.itemPatch) {
        const patch = diff.itemPatch
        for (const field of Object.keys(patch)) {
          const key = field as keyof KosztorysV2RowT
          const prevVal = prev[key]
          const attempted = row[key]
          save(
            `item:${row.id}:${field}`,
            () => updateItemFieldAction(row.id, { [field]: patch[field as keyof ItemPatchT] }),
            () => {
              revertOne(row.id, key, prevVal, attempted)
              dropPendingField(row.id, field as keyof ItemPatchT)
            },
          )
          fieldChanges.push({
            id: row.id,
            field: field as keyof ItemPatchT,
            before: prevVal,
            after: attempted,
          })
        }
      }
      // Stage progress is a distinct save dimension (sparse upsert), keyed per item×stage.
      for (const sc of diff.stageChanges ?? []) {
        const key = stageKey(sc.stageId)
        const prevVal = prev[key]
        save(
          `progress:${row.id}:${sc.stageId}`,
          () => setStageProgressAction(row.id, sc.stageId, sc.qty),
          () => {
            revertOne(row.id, key, prevVal, sc.qty)
            dropPendingStage(row.id, sc.stageId)
          },
        )
        stageChanges.push({
          id: row.id,
          stageId: sc.stageId,
          before: Number(prevVal) || 0,
          after: sc.qty,
        })
      }
      if (diff.itemPatch || diff.stageChanges) changedById.set(row.id, row)
      prevById.current.set(row.id, row)
    }
    if (fieldChanges.length > 0 || stageChanges.length > 0) {
      pendingFields.current.push(...fieldChanges)
      pendingStages.current.push(...stageChanges)
      setHasPendingBurst(true)
      if (flushTimer.current) clearTimeout(flushTimer.current)
      flushTimer.current = setTimeout(flushUndoBuffer, UNDO_COALESCE_MS)
    }
    if (changedById.size > 0) {
      // Merge the view's changes into the full dataset by id (so filter/sort don't lose hidden rows).
      setRows((master) => master.map((r) => changedById.get(r.id) ?? r))
      // Pull the recomputed totals from the server after the save quiets down (only when
      // something actually changed — an unconditional refresh on a spurious onChange could loop the render).
      setTimeout(() => router.refresh(), 700)
    }
  }

  return {
    // grid data + layout
    gridRef,
    gridHeight,
    columns,
    columnToggleItems,
    toggleColumn,
    setAllColumns,
    moneyAxis: effectiveMoneyAxis,
    setMoneyAxis,
    progressDisplay,
    setProgressDisplay,
    layer,
    setLayer,
    viewRows,
    view,
    sort,
    guideX,
    collapsedSectionIds,
    toggleSectionCollapsed,
    setCollapsedSectionIds,
    // Undefined in the read-only client view — one gate for the whole bundle, so the band's menu
    // can't half-appear.
    sectionHandlers: clientView
      ? undefined
      : {
          onInsert: handleInsertSection,
          onReorder: handleReorderSection,
          onSetColor: handleSetSectionColor,
          onRemove: handleRemoveSection,
          onRename: handleRenameSection,
        },
    // subtotals + section panel
    subtotals,
    // client-priced, view-invariant per-section subtotals — the section pie's structure source.
    progressSubtotals,
    totalNet,
    stageTotals,
    stageQtyTotals,
    plannedQtyTotal,
    remainingTotals,
    stages,
    doneNet,
    sumaPracNet,
    rabatClientNet,
    plannedNet,
    globalDiscount,
    subcontractorDue,
    laborCostsNetFromKosztorys,
    // toolbar / panel state
    setView,
    search,
    setSearch,
    emptySections,
    // handlers
    onChange,
    handleAddItem,
    handleAddSection,
    handleAppendedSections,
    handleAddStage,
    handleGlobalCoeffChange,
    handleVatChange,
    handleSettlementModeChange,
    handleGlobalDiscountChange,
    handleApplyPercentRabat,
    // undo/redo (stack lives in the shell; consumed by the toolbar + keyboard). Both flush a
    // still-buffering edit burst first, so an undo pops the just-typed edit (correct LIFO) rather
    // than an older command that the un-pushed burst is sitting in front of.
    undo: () => {
      flushUndoBuffer()
      undo()
    },
    redo: () => {
      flushUndoBuffer()
      redo()
    },
    // A buffering burst counts as undoable (it flushes to a command on undo) and, being a fresh edit,
    // will clear the redo path on flush — so surface it as "can undo, can't redo" during the window.
    canUndo: canUndo || hasPendingBurst,
    canRedo: canRedo && !hasPendingBurst,
  }
}
