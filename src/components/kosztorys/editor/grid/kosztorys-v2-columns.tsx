'use client'

import { type ReactNode } from 'react'
import { Column, type CellProps, keyColumn } from 'react-datasheet-grid'
import { SortHeader } from '@/components/kosztorys/editor/grid/sort-header'
import { StageHeader } from '@/components/kosztorys/editor/grid/stage-header'
import { STAGE_HEADER_COPY } from '@/components/kosztorys/editor/grid/stage-header-copy'
import { HeaderLabel } from '@/components/ui/datasheet-grid/header-label'
import { SimpleTooltip } from '@/components/ui/tooltip'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import { KosztorysRowActionsMenu } from '@/components/kosztorys/editor/grid/menus/kosztorys-row-actions-menu'
import { ResizableHeader } from '@/components/ui/datasheet-grid/column-resize-handle'
import { decimalColumn } from '@/components/kosztorys/editor/grid/cells/decimal-column'
import { computedColumn } from '@/components/kosztorys/editor/grid/cells/computed-cell'
import { divergenceColumn } from '@/components/kosztorys/editor/grid/cells/divergence-cell'
import {
  subcontractorCoeffColumn,
  subcontractorModeColumn,
  subcontractorPriceColumn,
} from '@/components/kosztorys/editor/grid/cells/subcontractor-columns'
import { type BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import {
  rowDiscountForView,
  rowDoneFraction,
  rowPlannedNetForView,
  stageValueForView,
  toGross,
  viewPrice,
} from '@/lib/kosztorys/calc'
import {
  discountValueColumn,
  discountTypeColumn,
} from '@/components/kosztorys/editor/grid/cells/discount-columns'
import { unitColumn } from '@/components/kosztorys/editor/grid/cells/unit-column'
import { SectionNameCell } from '@/components/kosztorys/editor/grid/cells/section-name-cell'
import { longTextColumn } from '@/components/ui/datasheet-grid/long-text-cell'
import { type ColumnToggleItemT } from '@/components/ui/column-toggle-menu'
import {
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
  stageGroupOfKey,
  stageKey,
  stageValueGrossKey,
  stageValueNetKey,
} from '@/lib/kosztorys/stage-keys'
import {
  baseRanksFromKeys,
  groupColumns,
  orderColumns,
  type ColumnRanksT,
} from '@/lib/table/column-order'
import {
  PREVIEW_VISIBLE_COLUMNS,
  PRZEDMIAR_ANCHORED_COLUMNS,
  UNPICKABLE_COLUMNS,
  columnLabelForView,
} from '@/lib/kosztorys/column-config'
import { HEADER_TIPS } from '@/lib/kosztorys/header-tips'
import { LAYER_DEFAULT, layerAllows } from '@/lib/kosztorys/layer'
import { MONEY_AXIS_DEFAULT, axisAllows } from '@/lib/kosztorys/money-axis'
import { formatPercent, formatQty } from '@/lib/kosztorys/format'
import { formatPLN } from '@/lib/utils/format-currency'
import {
  hasStagesOverPlanned,
  measureDiscrepancy,
  rowRemainingForView,
  rowTotalQtyDone,
  rowValueForView,
} from '@/lib/kosztorys/settlement-rows'
import { activeSortPick } from '@/lib/kosztorys/row-view'
import { stagesForView } from '@/lib/kosztorys/settlement-view'
import { stagesMatchingEngaged } from '@/lib/kosztorys/stage-conditions'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import type { KosztorysStageT, KosztorysV2RowT, StageKeyT } from '@/lib/kosztorys/types'
import { numericFieldPolicy } from '@/lib/kosztorys/cell-edit'

// The four per-item rabat columns hidden while the global discount overrides them.
const DISCOUNT_COLUMN_IDS = new Set([
  'discountValue',
  'discountType',
  'discountAmount',
  'discountAmountGross',
])

// keyColumn requires column: Column<Row[K]>. longTextColumn is nullable (Column<string|null>)
// whereas the item fields are non-null. The cell type is invariant (rowData covariant + setRowData
// contravariant), so no concrete type other than an exact match will pass — the only safe bridge is
// `any` at the library boundary. The cells are null-safe at runtime; we return a ready
// Column<KosztorysV2RowT>.
function keyCol(
  key: keyof KosztorysV2RowT,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: Partial<Column<any>>,
  rest: Partial<Column<KosztorysV2RowT>>,
): Column<KosztorysV2RowT> {
  return { ...(keyColumn(key, column) as Column<KosztorysV2RowT>), ...rest }
}

// An etap with no rozliczenie belongs to neither crew’s bill (subcontractor-due.ts), so its quantities fall
// out of both subcontractor sums — the kind of hole that is only found when the money doesn't add up.
// So the ilość column screams, header and every cell. Reachable in the client view only, which is the
// one that shows every etap.
//
// Only the ilość column: its wartość columns are derived from it and sit right beside it, so tinting
// them repeats one etap's warning three times — and their red totals row reads as a figure being
// wrong rather than an etap being unassigned.
const PLANE_UNCONFIRMED_CELL = {
  headerClassName: 'bg-destructive/15',
  cellClassName: 'bg-destructive/10 text-destructive',
} as const

function withTip(node: ReactNode, tip: string): ReactNode {
  return (
    <SimpleTooltip content={tip}>
      <span className="flex size-full items-center">{node}</span>
    </SimpleTooltip>
  )
}

// A column header that offers the sort menu, or — with no `onSetSort`, i.e. a preview — the bare
// label. The tip goes ONTO the sort trigger (same element), not around it: a second wrapping trigger
// would fight the dropdown for the click. Plain labels have no trigger, so they wrap directly, and
// they wrap (no truncate) into the fixed, taller header row (KosztorysEditorBody).
function sortableHeader(
  label: string,
  field: string,
  tip: string | undefined,
  opts: Pick<BuildV2ColumnsOptsT, 'sort' | 'onSetSort' | 'onPersistKosztorysOrder'>,
): ReactNode {
  const { onSetSort } = opts
  if (onSetSort) {
    return (
      <SortHeader
        label={label}
        active={activeSortPick(opts.sort, field)}
        tip={tip}
        onSort={(pick) => onSetSort(field, pick)}
        onPersistOrder={opts.onPersistKosztorysOrder}
      />
    )
  }
  const node = <HeaderLabel>{label}</HeaderLabel>
  return tip ? withTip(node, tip) : node
}

// The label is resolved from `field`, never passed in: every header and the column picker then read
// the same resolver, so a label that becomes view-dependent can't land in one and miss the other.
function title(
  field: string,
  opts: Pick<BuildV2ColumnsOptsT, 'sort' | 'onSetSort' | 'onPersistKosztorysOrder' | 'view'>,
): ReactNode {
  return sortableHeader(columnLabelForView(field, opts.view), field, HEADER_TIPS[field], opts)
}

// Header of a per-stage value column: a read-only mirror of the stage's name. One source for the
// name, so a rename moves all three of the stage's headers and a delete takes all three columns.
// Deliberately not `StageHeader` — a mirror carries no rename/delete affordance of its own; its
// label is simply one the column-label resolver cannot produce, the stage's name being data rather
// than a static column label.
function stageValueHeader(
  stage: KosztorysStageT,
  suffix: string,
  tip: string,
  field: string,
  opts: Pick<BuildV2ColumnsOptsT, 'sort' | 'onSetSort' | 'onPersistKosztorysOrder'>,
): ReactNode {
  return sortableHeader(`${stageLabel(stage)} ${suffix}`, field, tip, opts)
}

const DEFAULT_COLUMN_MIN_WIDTH = 110

function withResize(
  col: Column<KosztorysV2RowT>,
  opts: Pick<BuildV2ColumnsOptsT, 'onGuide' | 'onCommitColumn' | 'widths'>,
): Column<KosztorysV2RowT> {
  if (!opts.onGuide || !opts.onCommitColumn || !col.id) return col
  // A fixed-width column (min === max, e.g. the row-actions column) has nothing to drag — skip the
  // resizable header rather than hang a dead handle on it.
  if (col.minWidth != null && col.minWidth === col.maxWidth) return col
  // A default, not a clamp: a column that declares its own minWidth keeps it (the trailing gap wants
  // 24). dsg clamps an unpinned column's rendered width to its minWidth on overflow (many columns >
  // viewport), so this is the actual initial width, not just a drag limit.
  const min = col.minWidth ?? DEFAULT_COLUMN_MIN_WIDTH
  const pinned = opts.widths?.[col.id]
  // Pinning = a rigid width independent of dsg's flex algorithm: min=max=basis=W,
  // grow/shrink 0. (dsg ignored `basis` alone on overflow — it fell back to minWidth.)
  const sized: Column<KosztorysV2RowT> =
    pinned != null
      ? { ...col, basis: pinned, grow: 0, shrink: 0, minWidth: pinned, maxWidth: pinned }
      : { ...col, minWidth: min }
  return {
    ...sized,
    title: (
      <ResizableHeader
        colId={col.id}
        minWidth={min}
        onGuide={opts.onGuide}
        onCommit={opts.onCommitColumn}
      >
        {col.title}
      </ResizableHeader>
    ),
  }
}

function RowActionsCell({
  rowData,
  opts,
}: {
  rowData: KosztorysV2RowT
  opts: BuildV2ColumnsOptsT
}) {
  const plan = opts.getRemovePlan?.(rowData)
  const removeBlockReason = plan?.kind === 'blocked' ? plan.reason : undefined
  const removeNeedsConfirm = plan != null && plan.kind !== 'blocked' && plan.requiresConfirm

  // All four section callbacks come from one `editorOnly()` gate, so this reads as a single
  // "editor mode?" test rather than four independent ones.
  const { onInsertSection, onReorderSection, onSetSectionColor, onRemoveSection } = opts
  const section =
    onInsertSection && onReorderSection && onSetSectionColor && onRemoveSection
      ? {
          color: rowData.sectionColor,
          name: rowData.sectionName ?? undefined,
          itemCount: opts.getSectionItemCount?.(rowData.sectionId) ?? 0,
          onInsertAbove: () => onInsertSection(rowData.sectionId, 'above'),
          onInsertBelow: () => onInsertSection(rowData.sectionId, 'below'),
          onMoveUp: () => onReorderSection(rowData.sectionId, 'up'),
          onMoveDown: () => onReorderSection(rowData.sectionId, 'down'),
          onSetColor: (color: SectionColorKeyT | null) =>
            onSetSectionColor(rowData.sectionId, color),
          onRemove: () => onRemoveSection(rowData.sectionId),
        }
      : undefined

  return (
    <KosztorysRowActionsMenu
      sortActive={opts.sort != null}
      removeBlockReason={removeBlockReason}
      removeNeedsConfirm={removeNeedsConfirm}
      item={{
        onInsertAbove: () => opts.onInsertItem?.(rowData, 'above'),
        onInsertBelow: () => opts.onInsertItem?.(rowData, 'below'),
        onMoveUp: () => opts.onReorderItem?.(rowData, 'up'),
        onMoveDown: () => opts.onReorderItem?.(rowData, 'down'),
        onRemove: () => opts.onRemoveItem?.(rowData),
      }}
      section={section}
    />
  )
}

function actionColumn(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT> {
  return {
    id: 'actions',
    title: <HeaderLabel className="px-1">Akcje</HeaderLabel>,
    basis: 64,
    grow: 0,
    shrink: 0,
    minWidth: 64,
    maxWidth: 64,
    // Not `disabled`: dsg treats that flag as "never focusable", which blocked the row-actions
    // button from Tab/Enter entirely. `kosztorys-actions-cell` only strips dsg's own cell chrome.
    cellClassName: 'kosztorys-actions-cell',
    component: ({ rowData }) => <RowActionsCell rowData={rowData} opts={opts} />,
  }
}

// Every data column in sheet order, before any hiding. Split out from buildV2Columns so the picker
// can enumerate what EXISTS while the grid renders what's visible — one list, no second registry of
// "which columns are there in this view" to drift.
function assembleV2Columns(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT>[] {
  const { stages, view } = opts
  // Client view: a simple editable price. Subcontractor views: a "Źródło ceny" column (override)
  // + "Cena" showing the derived/override price.
  const priceCols: Column<KosztorysV2RowT>[] =
    view === 'client'
      ? [
          // `formatPLN`: „przywrócono 120" would read as a quantity in a grid full of them.
          decimalColumn(
            'price',
            title('price', opts),
            numericFieldPolicy<'clientPrice', KosztorysV2RowT>('clientPrice', formatPLN),
          ),
        ]
      : [
          subcontractorModeColumn(view, title('priceMode', opts)),
          subcontractorCoeffColumn(view, title('priceCoeff', opts)),
          subcontractorPriceColumn(view, title('price', opts)),
        ]
  const identity: Column<KosztorysV2RowT>[] = [
    {
      id: 'sectionName',
      title: title('sectionName', opts),
      keepFocus: true,
      // Named so the section footer can drop its vertical rule (globals.css) — dsg has no colspan.
      cellClassName: 'kosztorys-section-name-cell',
      component: ({ rowData, disabled }: CellProps<KosztorysV2RowT, unknown>) => (
        <SectionNameCell rowData={rowData} onRename={opts.onRenameSection} disabled={disabled} />
      ),
      copyValue: ({ rowData }) => rowData.sectionName ?? '',
      // Delete on a selected Sekcja cell is a no-op — an accidental keypress must not blank a whole
      // section. Only an explicit in-cell clear-and-commit renames it.
      deleteValue: ({ rowData }) => rowData,
    },
    keyCol('description', longTextColumn, {
      id: 'description',
      title: title('description', opts),
      minWidth: 360,
      grow: 2,
    }),
  ]

  // A subcontractor view is one crew's bill: only that plane's etapy get columns at all. Nothing
  // becomes uneditable — quantities are typed in the Inwestor view, which shows every etap.
  const viewStages = stagesForView(stages, view)

  // Which of those actually get columns, once the „Problemy" filters have their say. Narrowed HERE and
  // nowhere else, so the three stage axes below cannot drift apart — and deliberately NOT fed to
  // `totalQtyDone`: the share each etap's wartość is computed against is Σ etapów of the whole view, so
  // hiding columns would otherwise silently reprice the ones left standing.
  const shownStages = stagesMatchingEngaged(viewStages, opts.engagedStageConditionIds ?? [])

  // Rows are replaced immutably on every edit, so row identity is a self-invalidating cache key — a
  // stale value can't outlive the row it was computed from.
  const memoisedByRow = <T,>(compute: (row: KosztorysV2RowT) => T) => {
    const cache = new WeakMap<KosztorysV2RowT, { value: T }>()
    return (row: KosztorysV2RowT) => {
      const hit = cache.get(row)
      if (hit) return hit.value
      const value = compute(row)
      cache.set(row, { value })
      return value
    }
  }

  // Σ etapów for the row — the denominator every stage-value cell divides by. There are 2×|etapy| of
  // those cells per row (netto + brutto) and each used to re-run the O(|etapy|) reduce to arrive at
  // the SAME number, making a row O(|etapy|²).
  const totalQtyDone = memoisedByRow((row: KosztorysV2RowT) =>
    rowTotalQtyDone(row, viewStages, view),
  )

  // Przedmiar (sheet N, the offered scope) leads the stage columns rather than following them, so the
  // offered quantity reads before the per-etap execution it is measured against.
  const przedmiar: Column<KosztorysV2RowT>[] = [
    {
      ...decimalColumn(
        'plannedQty',
        title('plannedQty', opts),
        numericFieldPolicy<'plannedQty', KosztorysV2RowT>('plannedQty', formatQty),
      ),
      minWidth: 150,
    },
  ]

  // The imported sheet's „Pomiar z natury" against Σ etapów.
  //
  // Owner-only: the reference figure is scaffolding for entering old sheets into the app, and a
  // client's document must not carry the company's own bookkeeping doubts. Client plane only for a
  // second reason: `measureDiscrepancy` is hard-anchored to the whole offered scope, so hanging it
  // on a subcontractor view's cell would put two different „etapy" numbers side by side.
  //
  // Right behind „Opis prac" rather than beside „Pomiar", the figure it is derived from — it is the
  // answer to „ile jeszcze zostało", which nobody should have to scroll 8 columns to read.
  // Tied to the diagnostic filter, not to the presence of an imported pomiar: while the filter is off
  // the grid holds every pozycja and this column would be „—" down almost all of it. The button's own
  // count is what says the rozjazd exists; the column is where you read it.
  const divergence: Column<KosztorysV2RowT>[] =
    !opts.previewVisible && view === 'client' && opts.divergenceFilterEngaged
      ? [
          {
            ...divergenceColumn(
              title('divergence', opts),
              memoisedByRow((row: KosztorysV2RowT) => measureDiscrepancy(row, stages)),
            ),
            cellClassName: 'border-border border-r',
          },
        ]
      : []

  const measure: Column<KosztorysV2RowT>[] = [
    {
      ...computedColumn('stageQtySum', title('stageQtySum', opts), (r) => totalQtyDone(r)),
      minWidth: 80,
    },
    unitColumn(title('unit', opts)),
  ]

  // Rabat is a client concession, never passed to the subcontractor (calc.ts netForQtyForView), so
  // the four discount columns exist in the client view only — the subcontractor views never assemble
  // them, and their discount figures would be zero anyway.
  const discountCols: Column<KosztorysV2RowT>[] =
    view === 'client'
      ? [
          discountValueColumn(title('discountValue', opts)),
          discountTypeColumn(title('discountType', opts)),
          computedColumn('discountAmount', title('discountAmount', opts), (r) =>
            rowDiscountForView(r, totalQtyDone(r), view),
          ),
          computedColumn('discountAmountGross', title('discountAmountGross', opts), (r) =>
            toGross(rowDiscountForView(r, totalQtyDone(r), view), r.vatRate),
          ),
        ]
      : []

  const pricing: Column<KosztorysV2RowT>[] = [
    ...priceCols,
    computedColumn('priceGross', title('priceGross', opts), (r) =>
      toGross(viewPrice(r, view), r.vatRate),
    ),
    ...discountCols,
  ]

  const stageCols: Column<KosztorysV2RowT>[] = shownStages.map((st) => {
    // The qty field IS the column id, so the sort wiring is the same shape `title()` builds — the
    // etap menu just hosts it alongside rename/plane/roster instead of owning the whole menu.
    const qtyField = stageKey(st.id)
    const header = (
      <StageHeader
        stage={st}
        onRename={opts.onRenameStage}
        onRemove={opts.onRemoveStage}
        onSetPlane={opts.onSetStagePlane}
        workers={opts.workers}
        onSetWorker={opts.onSetStageWorker}
        sort={activeSortPick(opts.sort, qtyField)}
        onSort={opts.onSetSort && ((pick) => opts.onSetSort?.(qtyField, pick))}
        onPersistOrder={opts.onPersistKosztorysOrder}
        executedValue={opts.executedValueByStage?.get(st.id) ?? 0}
      />
    )
    // Locked until the rozliczenie is picked: qty typed here would be work nobody gets billed for,
    // and picking one costs a click. Deliberately NOT widened to the worker — a worker-less etap
    // still has a price and still belongs to the executed total; it just isn't attributed to anyone.
    //
    // The lock renders as a COMPUTED cell, not as a `disabled` editable one: dsg's disabled cell is
    // silent — you type, nothing happens, and the red tint is the only hint that this was deliberate.
    // The reason already existed as copy (STAGE_HEADER_COPY.planeUnconfirmed) but only on a badge in
    // the header, which is not where anyone looks after a keystroke goes nowhere. Same string, hung
    // where the lock is discovered.
    if (st.plane == null) {
      return {
        ...computedColumn(
          qtyField,
          header,
          (r) => r[qtyField] ?? null,
          { tone: 'danger', tip: () => STAGE_HEADER_COPY.planeUnconfirmed },
          // Blank, never „0,00": an etap nobody has recorded work in has no quantity, and a zero
          // would read as one that was measured.
          (value) => (value == null ? '' : formatQty(value)),
        ),
        minWidth: 110,
        ...PLANE_UNCONFIRMED_CELL,
      }
    }
    return {
      ...decimalColumn(
        qtyField,
        header,
        numericFieldPolicy<StageKeyT, KosztorysV2RowT>(qtyField, formatQty),
      ),
      minWidth: 110,
    }
  })

  // The sheet's V–AE: the value of each stage's recorded qty at the view's price, post-discount.
  // Computed at render, never a row field — hence the separate id namespace (constants.ts).
  const stageValueNetCols: Column<KosztorysV2RowT>[] = shownStages.map((st) => {
    const qtyKey = stageKey(st.id)
    const field = stageValueNetKey(st.id)
    const header = stageValueHeader(
      st,
      'netto',
      HEADER_TIPS[STAGE_VALUE_NET_COLUMN_GROUP],
      field,
      opts,
    )
    return computedColumn(field, header, (r) =>
      stageValueForView(r, r[qtyKey] ?? 0, totalQtyDone(r), view),
    )
  })

  const stageValueGrossCols: Column<KosztorysV2RowT>[] = shownStages.map((st) => {
    const qtyKey = stageKey(st.id)
    const field = stageValueGrossKey(st.id)
    const header = stageValueHeader(
      st,
      'brutto',
      HEADER_TIPS[STAGE_VALUE_GROSS_COLUMN_GROUP],
      field,
      opts,
    )
    return computedColumn(field, header, (r) =>
      toGross(stageValueForView(r, r[qtyKey] ?? 0, totalQtyDone(r), view), r.vatRate),
    )
  })

  // The przedmiar-anchored columns here and below compute at `'client'` outright, not at `view`:
  // PRZEDMIAR_ANCHORED_COLUMNS drops them outside the client view, so a `view`-reactive formula would
  // be false generality — it reads as if a subcontractor reading existed, and there isn't one.
  const donePercent: Column<KosztorysV2RowT>[] = [
    computedColumn(
      'donePercent',
      title('donePercent', opts),
      (r) => rowDoneFraction(r, rowTotalQtyDone(r, stages, 'client')),
      {
        // Red = more was executed than was offered. The percentage says so too (>100%), but only
        // this cell says it at a glance across a thousand rows.
        tone: (r) => (hasStagesOverPlanned(r, stages) ? 'danger' : 'muted'),
        emphasize: true,
      },
      formatPercent,
    ),
  ]

  const plannedValue: Column<KosztorysV2RowT>[] = [
    computedColumn('plannedNet', title('plannedNet', opts), (r) =>
      rowPlannedNetForView(r, 'client'),
    ),
    computedColumn('plannedGross', title('plannedGross', opts), (r) =>
      toGross(rowPlannedNetForView(r, 'client'), r.vatRate),
    ),
  ]

  const computed: Column<KosztorysV2RowT>[] = [
    ...plannedValue,
    computedColumn('net', title('net', opts), (r) => rowValueForView(r, stages, view), {
      emphasize: true,
    }),
    computedColumn('gross', title('gross', opts), (r) =>
      toGross(rowValueForView(r, stages, view), r.vatRate),
    ),
  ]

  // Komentarz (sheet col T): the row's free-text note. Plain text column — the `note` field is
  // already diffed/persisted; this only surfaces it in the grid. Sits at the Praca/Postęp seam and
  // carries the left border, so it doubles as the block divider (layer-neutral → always visible).
  const komentarz: Column<KosztorysV2RowT>[] = [
    keyCol('note', longTextColumn, {
      id: 'note',
      title: title('note', opts),
      minWidth: 200,
      grow: 1,
      headerClassName: 'border-l border-border',
      cellClassName: 'border-l border-border',
    }),
  ]

  const remaining: Column<KosztorysV2RowT>[] = [
    computedColumn('remaining', title('remaining', opts), (r) =>
      rowRemainingForView(r, stages, 'client'),
    ),
    computedColumn('remainingGross', title('remainingGross', opts), (r) =>
      toGross(rowRemainingForView(r, stages, 'client'), r.vatRate),
    ),
  ]

  // „Rozjazd" right behind the identity block when it exists at all (see above — it is a work list,
  // not a reading of the sheet),
  // then sheet order proper: Przedmiar (N) leads the stage qty columns (the sheet's D–M), then Pomiar z natury (O), then
  // Komentarz (T) at the work/progress seam, then the value block (U–AE right before AF "pozostało").
  // The row-actions column leads the whole grid when editing is enabled — it rides the same
  // assemble→hide→toggle pipeline as every data column (no special-casing), so the picker can hide it
  // like any other.
  const dataColumns = [
    ...identity,
    ...divergence,
    ...przedmiar,
    ...stageCols,
    ...measure,
    ...pricing,
    ...computed,
    ...komentarz,
    ...stageValueNetCols,
    ...stageValueGrossCols,
    ...donePercent,
    ...remaining,
  ]
  if (opts.readOnly) return dataColumns.map((c) => ({ ...c, disabled: true }))
  return opts.onRemoveItem || opts.onReorderItem
    ? [actionColumn(opts), ...dataColumns]
    : dataColumns
}

// A stage column answers to its axis's shared "Etapy — …" picker entry, not to its own id.
function toggleKey(columnId: string): string {
  return stageGroupOfKey(columnId) ?? columnId
}

// The column allowlist and the client price plane are one disclosure decision (useKosztorysEditor
// derives them as a pair). Split them and PREVIEW_VISIBLE_COLUMNS keeps letting `price`/`net`/`gross`
// through while they compute a subcontractor's cost basis — client-named columns holding contractor
// numbers, a leak with no foreign column to notice. Nothing in the types forbids the split, so this
// says it out loud at the one chokepoint both build paths cross. It throws rather than repairing the
// opts: a caller that got this wrong has a bug worth seeing, and silently overriding its `view` would
// hide it.
function assertDisclosurePair(opts: BuildV2ColumnsOptsT): void {
  if (opts.previewVisible && opts.view !== 'client') {
    throw new Error(
      `previewVisible requires view='client' (got '${opts.view}') — the column allowlist does not pin the price plane.`,
    )
  }
}

// Hide/axis/resize selection over an already-assembled column list. Split from the assembly so the
// grid and the picker can share ONE assembleV2Columns pass (buildV2Grid) instead of two.
function selectV2Columns(
  assembled: Column<KosztorysV2RowT>[],
  opts: BuildV2ColumnsOptsT,
): Column<KosztorysV2RowT>[] {
  assertDisclosurePair(opts)
  const axis = opts.moneyAxis ?? MONEY_AXIS_DEFAULT
  const layer = opts.layer ?? LAYER_DEFAULT
  // Two kinds of gate live in this filter, and only one of them may touch a client's document.
  // PREFERENCE gates — the axis, the layer, the picker tick — say what ONE owner wants to read
  // right now, so a preview skips them entirely and takes the allowlist as its
  // whole answer (owner ruling 2026-07-28). The discount gate is not one of them: `globalDiscount`
  // is a property of the investment, identical for every reader, and while it is on, the per-item
  // rabat fields are bypassed rather than cleared (calc.ts `applyDiscount`) — so showing those
  // columns would print „Rabat 10 %" beside „Kwota rabatu 0,00" on the offer itself.
  const keep = (key: string): boolean => {
    if (opts.globalDiscountActive && DISCOUNT_COLUMN_IDS.has(key)) return false
    if (opts.previewVisible) {
      return PREVIEW_VISIBLE_COLUMNS.has(key) && !opts.previewHiddenColumns?.has(key)
    }
    if (opts.view !== 'client' && PRZEDMIAR_ANCHORED_COLUMNS.has(key)) return false
    // The reveal sits beside UNPICKABLE_COLUMNS because it answers the same question — „may a stored
    // tick hide this right now" — and pointedly NOT beside the two gates after it: a problem filter
    // gets to overrule one owner's picker, never their money axis or layer.
    return (
      (UNPICKABLE_COLUMNS.has(key) || opts.revealedColumnIds?.has(key) || !opts.isHidden?.(key)) &&
      axisAllows(key, axis) &&
      layerAllows(key, layer)
    )
  }
  const base = assembled.filter((c) => keep(toggleKey(c.id ?? ''))).map((c) => withResize(c, opts))
  return appendTrailingGap(base, opts)
}

// A trailing empty spacer column pinned to the far right of the grid. Resizable (min ≠ max) so its
// width is the user's call; 48 is only the default basis. The Praca/Postęp divider is now „Komentarz"
// itself (which carries the border and sits at the seam) — this is just the end-of-grid gap.
const layerGapColumn: Column<KosztorysV2RowT> = {
  id: 'layerGap',
  title: <span />,
  basis: 48,
  grow: 0,
  shrink: 0,
  minWidth: 24,
  maxWidth: 400,
  disabled: true,
  headerClassName: 'border-l border-border',
  cellClassName: 'border-l border-border',
  component: () => null,
}

// Append the empty spacer to the far right of the visible grid. Inserted here, post-filter, so it
// never appears in the column picker and always shows. Wrapped in withResize (not in the assembly
// map, which runs before this append) so it gets a drag handle. The Praca/Postęp divider itself is
// „Komentarz" at the seam — see assembleV2Columns.
function appendTrailingGap(
  columns: Column<KosztorysV2RowT>[],
  opts: Pick<BuildV2ColumnsOptsT, 'onGuide' | 'onCommitColumn' | 'widths'>,
): Column<KosztorysV2RowT>[] {
  return [...columns, withResize(layerGapColumn, opts)]
}

// Picker entries for the columns this view actually has, in grid order. Stage columns collapse into
// their axis's "Etapy — …" entry — hence the dedupe.
function selectV2ToggleItems(
  assembled: Column<KosztorysV2RowT>[],
  opts: BuildV2ColumnsOptsT,
): ColumnToggleItemT[] {
  // A preview has no picker at all (the body mounts the slim header, not the toolbar), and a picker
  // is by definition the owner preference selectV2Columns just stopped honouring — so there is no
  // coherent list to return here. Empty rather than allowlist-filtered: the latter would describe a
  // grid whose columns no longer answer to it.
  if (opts.previewVisible) return []
  const items: ColumnToggleItemT[] = []
  for (const col of assembled) {
    const id = toggleKey(col.id ?? '')
    if (items.some((i) => i.id === id)) continue
    if (opts.globalDiscountActive && DISCOUNT_COLUMN_IDS.has(id)) continue
    if (UNPICKABLE_COLUMNS.has(id)) continue
    if (opts.view !== 'client' && PRZEDMIAR_ANCHORED_COLUMNS.has(id)) continue
    // `visible` is the STORED tick, never the reveal: a column a problem is currently forcing on
    // screen still reports what the picker holds. Unticking it then is a no-op that takes effect on
    // disengage — accepted, because showing it ticked would lie about what is saved and disabling it
    // would need a third state nobody asked for.
    items.push({ id, label: columnLabelForView(id, opts.view), visible: !opts.isHidden?.(id) })
  }
  return items
}

// The owner's stored column order, applied to the assembled list — BEFORE the filter, since the
// filter preserves relative order: one sort then serves both the grid and the picker, and the
// trailing gap (appended post-filter) stays last.
//
// A preview skips it whole: the order is one owner's reading preference, exactly like the axis, the
// layer and the picker tick, and none of those may shape what a client is served (ruling
// 2026-07-28). Skipping is not merely cosmetic here — a client's localStorage is client-writable.
function orderAssembled(
  assembled: Column<KosztorysV2RowT>[],
  opts: BuildV2ColumnsOptsT,
): Column<KosztorysV2RowT>[] {
  // An empty rank map is the assemble order by definition, and it is what every owner who never
  // reordered anything has — bail before the group→sort→regroup pass instead of reproducing the
  // input array on each render.
  if (opts.previewVisible || !opts.columnRanks || Object.keys(opts.columnRanks).length === 0) {
    return assembled
  }
  return orderColumns(assembled, opts.columnRanks, toggleKey)
}

// Assemble-order rank per group key: the fallback an unranked column sorts at. Read off the list
// BEFORE ordering — the reorder dialog only ever sees the already-ordered picker list, so it cannot
// derive this itself.
function assembleBaseRanks(assembled: Column<KosztorysV2RowT>[]): ColumnRanksT {
  return baseRanksFromKeys([...groupColumns(assembled, toggleKey).keys()])
}

// Columns-only assemble — the grid path goes through buildV2Grid; kept for the column-set unit specs
// (money-axis / layer), which assert which ids survive a predicate without the picker.
export function buildV2Columns(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT>[] {
  return selectV2Columns(orderAssembled(assembleV2Columns(opts), opts), opts)
}

// The grid + its picker in one assembly pass — assembleV2Columns is the O(columns·stages) build, so
// it runs once and returns both instead of once per export.
export function buildV2Grid(opts: BuildV2ColumnsOptsT): {
  columns: Column<KosztorysV2RowT>[]
  columnToggleItems: ColumnToggleItemT[]
  columnBaseRanks: ColumnRanksT
} {
  const assembled = assembleV2Columns(opts)
  const ordered = orderAssembled(assembled, opts)
  return {
    columns: selectV2Columns(ordered, opts),
    columnToggleItems: selectV2ToggleItems(ordered, opts),
    columnBaseRanks: assembleBaseRanks(assembled),
  }
}
