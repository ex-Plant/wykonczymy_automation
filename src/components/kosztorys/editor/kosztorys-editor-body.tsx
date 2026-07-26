'use client'

import 'react-datasheet-grid/dist/style.css'
import { useMemo } from 'react'
import { createPortal } from 'react-dom'
// `DynamicDataSheetGrid`, not `DataSheetGrid`: the library aliases the plain name to
// StaticDataSheetGrid, which snapshots `columns` via useState at mount (EX-422).
import { DynamicDataSheetGrid } from 'react-datasheet-grid'
import { KosztorysTotalsPanel } from '@/components/kosztorys/summary/kosztorys-totals-panel'
import { KosztorysTotalsPanelToggle } from '@/components/kosztorys/summary/kosztorys-totals-panel-toggle'
import { KosztorysEditorToolbar } from '@/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar'
import { MoneyAxisToggle } from '@/components/kosztorys/editor/grid/money-axis-toggle'
import { useKosztorysEditor } from '@/components/kosztorys/editor/use-kosztorys-editor'
import { KosztorysEditorProvider } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { useUndoKeyboard } from '@/components/kosztorys/editor/hooks/use-undo-keyboard'
import { withSyntheticRows } from '@/components/kosztorys/editor/grid/kosztorys-synthetic-rows'
import type { SectionHeaderFigureT } from '@/components/kosztorys/editor/grid/cells/section-header-cell'
import { buildSectionHeaderRows } from '@/lib/kosztorys/section-header-rows'
import {
  isSectionHeaderRow,
  isSyntheticRow,
  makeSpacerRow,
  makeTotalsRow,
} from '@/lib/kosztorys/synthetic-rows'
import { sectionColorRail } from '@/lib/kosztorys/section-colors'
import { cn } from '@/lib/utils/cn'
import { toGross } from '@/lib/kosztorys/calc'
import { toClientAxis } from '@/lib/kosztorys/money-axis'
import { buildKosztorysReconciliation } from '@/lib/kosztorys/reconciliation'
import { stageKey, stageValueGrossKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import { stagesForView } from '@/lib/kosztorys/settlement'
import {
  NOOP_UNDO_REDO,
  type UndoRedoApiT,
} from '@/components/kosztorys/editor/hooks/use-undo-redo'
import type { KosztorysEditorDataT } from '@/lib/kosztorys/types'

const ITEM_ROW_HEIGHT = 32
const SECTION_BAND_ROW_HEIGHT = 52

// dsg's leftmost column is the only sticky-left element it gives us, so it is the one place a
// per-row indicator survives horizontal scroll — which is why the section rail is painted on
// `.dsg-cell-gutter` (globals.css) rather than on a cell of our own. Content-free and 6px wide:
// wide enough for the 3px rail plus its tint, narrow enough to read as a margin rather than a
// column. Module-level so its `component` identity is stable across renders.
const SECTION_RAIL_GUTTER = {
  basis: 6,
  title: <></>,
  component: () => <></>,
}

type PropsT = KosztorysEditorDataT & {
  // Read-only public/preview render: hides the mutation chrome, swaps the toolbar for a slim axis
  // header, kills persistence, and gates the footer's owner-only bits. The owner path leaves it unset.
  clientView?: boolean
  // Optional because the read-only client body omits it and falls back to NOOP_UNDO_REDO.
  undoRedo?: UndoRedoApiT
  onOpenVersions?: () => void
}

// The stateful editor: seeds the grid from `tree` at mount (useKosztorysEditor's useState
// initializer). Remounting it (fresh `key` from the wrapper) is how a restore re-seeds the whole
// grid — see KosztorysEditorV2.
export function KosztorysEditorBody({
  investmentId,
  tree,
  investmentName,
  materialsGrossBase,
  materialsNetBilled,
  materialyBreakdown,
  wplatyNet,
  laborCostsNetFromTransactions,
  investmentRabat,
  payoutsByWorker = [],
  payoutTransactions = [],
  depositTransactions = [],
  materialTransactions,
  clientView = false,
  undoRedo = NOOP_UNDO_REDO,
  onOpenVersions,
}: PropsT) {
  const editor = useKosztorysEditor({ investmentId, tree, clientView, undoRedo })
  const {
    gridRef,
    gridHeight,
    columns,
    viewRows,
    guideX,
    subtotals,
    progressSubtotals,
    stageTotals,
    stageQtyTotals,
    plannedQtyTotal,
    remainingTotals,
    stages,
    totalNet,
    sumaPracNet,
    rabatClientNet,
    laborCostsNetFromKosztorys,
    subcontractorDue,
    view,
    sort,
    search,
    collapsedSectionIds,
    toggleSectionCollapsed,
    sectionHandlers,
    moneyAxis,
    setMoneyAxis,
    onChange,
  } = editor

  useUndoKeyboard(editor.undo, editor.redo)

  const columnTotals = useMemo(() => {
    const totals = new Map<string, number>()
    // Money: executed value + offered przedmiar, net and gross. The Przedmiar „Razem" must track
    // the active price view (its column reprices per view), so sum the view-aware subtotals — NOT
    // the hook's `plannedNet`, which is fixed to client prices for the progress counter.
    totals.set('net', totalNet)
    totals.set('gross', toGross(totalNet, tree.vatRate))
    // `null` outside the client view — the przedmiar has no per-rozliczenie reading, so the subtotals
    // withhold it. Nothing to sum, and the columns it would total are hidden there anyway.
    if (view === 'client') {
      const plannedNetForView = subtotals.reduce(
        (sum, section) => sum + (section.plannedNet ?? 0),
        0,
      )
      totals.set('plannedNet', plannedNetForView)
      totals.set('plannedGross', toGross(plannedNetForView, tree.vatRate))
    }
    totals.set('remaining', remainingTotals.net)
    totals.set('remainingGross', remainingTotals.gross)
    // Rabat: Σ per-item discount taken on executed qty, view-aware like the columns themselves.
    const discountNetForView = subtotals.reduce((sum, section) => sum + section.discount, 0)
    totals.set('discountAmount', discountNetForView)
    totals.set('discountAmountGross', toGross(discountNetForView, tree.vatRate))
    // Qty (Pomiar z natury): per-etap column, their sum, and the offered przedmiar column.
    let qtySum = 0
    for (const stage of stagesForView(stages, view)) {
      const stageQty = stageQtyTotals.get(stage.id) ?? 0
      qtySum += stageQty
      totals.set(stageKey(stage.id), stageQty)
      const stageNet = stageTotals.get(stage.id) ?? 0
      totals.set(stageValueNetKey(stage.id), stageNet)
      totals.set(stageValueGrossKey(stage.id), toGross(stageNet, tree.vatRate))
    }
    totals.set('stageQtySum', qtySum)
    totals.set('plannedQty', plannedQtyTotal)
    return totals
  }, [
    stages,
    stageTotals,
    stageQtyTotals,
    plannedQtyTotal,
    remainingTotals,
    totalNet,
    subtotals,
    tree.vatRate,
    view,
  ])

  // What a band shows: the section's own figures, read out of the same full-dataset `subtotals` the
  // Podsumowanie uses — so a band, „Razem" and the panel can't disagree, and a search filter narrows
  // the visible rows without moving the section's total.
  const sectionHeader = useMemo(() => {
    const figures = new Map<number, SectionHeaderFigureT>()
    for (const section of subtotals) {
      figures.set(section.sectionId, {
        net: section.net,
        gross: toGross(section.net, tree.vatRate),
        itemCount: section.itemCount,
      })
    }
    return {
      figures,
      collapsedSectionIds,
      onToggleCollapsed: toggleSectionCollapsed,
      moneyAxis,
      handlers: sectionHandlers,
    }
  }, [
    subtotals,
    tree.vatRate,
    collapsedSectionIds,
    toggleSectionCollapsed,
    moneyAxis,
    sectionHandlers,
  ])

  const gridColumns = useMemo(
    () =>
      columns.map((column) => withSyntheticRows(column, { totals: columnTotals, sectionHeader })),
    [columns, columnTotals, sectionHeader],
  )
  const { rows: bodyRows } = useMemo(
    () =>
      buildSectionHeaderRows(viewRows, {
        collapsedSectionIds,
        enabled: sort == null,
        searchActive: search.trim() !== '',
      }),
    [viewRows, collapsedSectionIds, sort, search],
  )
  const gridRows = useMemo(() => [...bodyRows, makeSpacerRow(), makeTotalsRow()], [bodyRows])

  // Reconciliation verdict for the Podsumowanie scream: kosztorys client-view nets (sumaPracNet /
  // rabatClientNet, view-independent) vs the investment's transaction sums — net to net, since the
  // ledger carries no VAT. Built via the shared lib fn — the same one the investment page calls — so
  // the two surfaces can't disagree.
  const reconciliation = useMemo(
    () =>
      buildKosztorysReconciliation({
        sumaPracNet,
        rabatClientNet,
        laborCostsNetFromTransactions,
        investmentRabat,
      }),
    [sumaPracNet, rabatClientNet, laborCostsNetFromTransactions, investmentRabat],
  )

  // Viewport minus the shell's chrome: the h-14 TopNav always, plus the h-14 AppFooter, which only
  // renders below `lg` (hence the two calcs — subtracting it at every width would leave a dead band
  // where no footer exists). The client view mounts under the bare (share) layout, which has neither,
  // so subtracting there is what WOULD leave the dead band — it takes the whole viewport.
  return (
    <KosztorysEditorProvider
      editor={{ ...editor, investmentId, investmentName, tree, onOpenVersions }}
    >
      <div
        className={cn(
          'flex w-full flex-col overflow-hidden',
          clientView ? 'h-dvh' : 'h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-3.5rem)]',
        )}
      >
        {clientView ? (
          <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <h1 className="truncate text-base font-medium">{investmentName}</h1>
            <div className="flex shrink-0 items-center gap-2">
              <MoneyAxisToggle value={toClientAxis(moneyAxis)} onChange={setMoneyAxis} />
              {/* The panel's open state is persisted per person, not per view, so without this the
                  client view inherits whatever the toolbar last left and can never fold it back. */}
              <KosztorysTotalsPanelToggle size="default" />
            </div>
          </header>
        ) : (
          <KosztorysEditorToolbar />
        )}
        {/* We measure the container height (flex-1) and pass it to the grid — datasheet-grid
            needs px for virtualization; without it, it renders all 1000 rows.
            The grid track `minmax(0,1fr)` gives a DEFINITE width (= viewport): the grid doesn't
            stretch the container to the sum of the columns, it scrolls them internally instead. */}
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {/* min-w-0 lets the wrapper shrink below its content in a flex context;
              grid-cols-1 still gives the grid a definite width (anti-flicker). */}
          <div ref={gridRef} className="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden">
            <DynamicDataSheetGrid
              className="kosztorys-grid"
              value={gridRows}
              // Strip the appended spacer + „Razem" rows before the editor's diff sees them — display-only.
              onChange={(rows) => onChange(rows.filter((row) => !isSyntheticRow(row.id)))}
              columns={gridColumns}
              gutterColumn={SECTION_RAIL_GUTTER}
              height={gridHeight}
              rowHeight={({ rowData }) =>
                isSectionHeaderRow(rowData.id) ? SECTION_BAND_ROW_HEIGHT : ITEM_ROW_HEIGHT
              }
              // Taller header so verbose column labels („Pozostało netto (względem przedmiaru)" etc.)
              // wrap onto two rows instead of truncating.
              headerRowHeight={56}
              lockRows
              rowKey={({ rowData }) => String(rowData.id)}
              rowClassName={({ rowData }) =>
                cn(
                  sectionColorRail(rowData.sectionColor),
                  isSectionHeaderRow(rowData.id) && 'kosztorys-section-header',
                )
              }
            />
          </div>
          {/* Overlays the grid's bottom edge instead of consuming a flex track — the grid keeps its
              full height and its last rows scroll under the (opaque) panel rather than being pushed up. */}
          <KosztorysTotalsPanel
            investmentId={investmentId}
            investmentName={investmentName}
            stages={stages}
            stageTotals={stageTotals}
            payoutsByWorker={payoutsByWorker}
            payoutTransactions={payoutTransactions}
            depositTransactions={depositTransactions}
            materialTransactions={materialTransactions}
            subcontractorDue={subcontractorDue}
            totalNet={totalNet}
            laborCostsNetFromKosztorys={laborCostsNetFromKosztorys}
            materialsGrossBase={materialsGrossBase}
            materialsNetBilled={materialsNetBilled}
            materialyBreakdown={materialyBreakdown}
            sectionSubtotals={progressSubtotals}
            wplatyNet={wplatyNet}
            rabatAmount={rabatClientNet}
            reconciliation={reconciliation}
            vatRate={tree.vatRate}
            clientView={clientView}
          />
        </div>
        {/* Vertical guide while dragging a column edge (left = cursor viewport X). Portaled to body:
            <main> uses transform-gpu, which would otherwise make this `fixed` element measure `left`
            from <main> (sidebar-offset) instead of the viewport — same containing-block trap as the
            context menu. */}
        {guideX !== null &&
          createPortal(
            <div
              className="bg-primary/70 pointer-events-none fixed inset-y-0 z-50 w-px"
              style={{ left: guideX }}
            />,
            document.body,
          )}
      </div>
    </KosztorysEditorProvider>
  )
}
