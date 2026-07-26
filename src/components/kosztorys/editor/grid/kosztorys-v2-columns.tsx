'use client'

import { type ReactNode } from 'react'
import { Column, type CellProps, keyColumn, textColumn, floatColumn } from 'react-datasheet-grid'
import { SortHeader } from '@/components/kosztorys/editor/grid/sort-header'
import { StageHeader } from '@/components/kosztorys/editor/grid/stage-header'
import { HeaderLabel } from '@/components/ui/datasheet-grid/header-label'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { KosztorysRowActionsMenu } from '@/components/kosztorys/editor/grid/menus/kosztorys-row-actions-menu'
import { ResizableHeader } from '@/components/ui/datasheet-grid/column-resize-handle'
import { computedColumn } from '@/components/kosztorys/editor/grid/cells/computed-cell'
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
  stageDoneFraction,
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
import { type ColumnToggleItemT } from '@/components/ui/column-toggle-menu'
import {
  STAGE_QTY_PREFIX,
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
  STAGE_VALUE_PERCENT_COLUMN_GROUP,
  STAGES_COLUMN_GROUP,
  stageKey,
  stageValueGrossKey,
  stageValueNetKey,
  stageValuePercentKey,
} from '@/lib/kosztorys/stage-keys'
import {
  CLIENT_VISIBLE_COLUMNS,
  PRZEDMIAR_ANCHORED_COLUMNS,
  columnLabelForView,
} from '@/lib/kosztorys/column-config'
import { HEADER_TIPS } from '@/lib/kosztorys/header-tips'
import { LAYER_DEFAULT, layerAllows } from '@/lib/kosztorys/layer'
import { MONEY_AXIS_DEFAULT, axisAllows } from '@/lib/kosztorys/money-axis'
import { PROGRESS_DISPLAY_DEFAULT, progressDisplayAllows } from '@/lib/kosztorys/progress-display'
import { formatPercent } from '@/lib/kosztorys/format'
import {
  hasStagesOverPlanned,
  rowRemainingForView,
  rowTotalQtyDone,
  rowValueForView,
  stagesForView,
} from '@/lib/kosztorys/settlement'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

// floatColumn right-aligns by default; the grid reads cleaner with every cell left-aligned under
// its (left-aligned) header, so numbers don't float at the far edge of wide columns.
const floatColumnLeft = {
  ...floatColumn,
  columnData: { ...floatColumn.columnData, alignRight: false },
}

// The four per-item rabat columns hidden while the global discount overrides them.
const DISCOUNT_COLUMN_IDS = new Set([
  'discountValue',
  'discountType',
  'discountAmount',
  'discountAmountGross',
])

// keyColumn requires column: Column<Row[K]>. floatColumn/textColumn are nullable
// (Column<number|null> / <string|null>), whereas the item fields are non-null. The cell type is
// invariant (rowData covariant + setRowData contravariant), so no concrete type other than an
// exact match will pass — the only safe bridge is `any` at the library boundary. The cells are
// null-safe at runtime; we return a ready Column<KosztorysV2RowT>.
function keyCol(
  key: keyof KosztorysV2RowT,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: Partial<Column<any>>,
  rest: Partial<Column<KosztorysV2RowT>>,
): Column<KosztorysV2RowT> {
  return { ...(keyColumn(key, column) as Column<KosztorysV2RowT>), ...rest }
}

// An etap with no rozliczenie belongs to neither crew's bill (settlement.ts), so its quantities fall
// out of both subcontractor sums — the kind of hole that is only found when the money doesn't add up.
// So the whole column screams, header and every cell. Reachable in the client view only, which is the
// one that shows every etap.
//
// Colour only: the qty column adds its own lock (the three value columns are already read-only, so a
// `disabled` here would say nothing about them).
const PLANE_UNCONFIRMED_CELL = {
  headerClassName: 'bg-destructive/15',
  cellClassName: 'bg-destructive/10 text-destructive',
} as const

function planeUnconfirmed(stage: KosztorysStageT): Partial<Column<KosztorysV2RowT>> {
  return stage.plane == null ? PLANE_UNCONFIRMED_CELL : {}
}

function withTip(node: ReactNode, tip: string): ReactNode {
  return (
    <SimpleTooltip content={tip}>
      <span className="flex size-full items-center">{node}</span>
    </SimpleTooltip>
  )
}

// Column title as a sort-menu header (when onSetSort is provided), wrapped in an explanatory
// tooltip when the field has one in HEADER_TIPS.
// `sortable: false` for columns whose value is categorical or dash-laden (the subcontractor
// „źródło ceny" pair) — a sort trigger there would render a caret over a sort nothing can resolve.
//
// The label is resolved from `field`, never passed in: every header and the column picker then read
// the same resolver, so a label that becomes view-dependent can't land in one and miss the other.
function title(
  field: string,
  opts: Pick<BuildV2ColumnsOptsT, 'sort' | 'onSetSort' | 'view'>,
  sortable = true,
): ReactNode {
  const label = columnLabelForView(field, opts.view)
  const active = opts.sort?.field === field ? opts.sort.dir : null
  const tip = HEADER_TIPS[field]
  // The tip goes ONTO the sort trigger (same element), not around it — a second wrapping trigger
  // would fight the dropdown for the click. Plain-label columns have no trigger, so wrap directly.
  if (opts.onSetSort && sortable) {
    return (
      <SortHeader
        label={label}
        active={active}
        tip={tip}
        onSort={(dir) => opts.onSetSort?.(field, dir)}
      />
    )
  }
  const node = <HeaderLabel>{label}</HeaderLabel>
  return tip ? withTip(node, tip) : node
}

// Header of a per-stage value column: a read-only mirror of the stage's name. One source for the
// name, so a rename moves all three of the stage's headers and a delete takes all three columns.
// Deliberately not `title(...)` — these columns carry per-stage dynamic ids that columnSortValue
// (lib/kosztorys/sort-value) has no case for, so a sort trigger here would render an arrow that does
// nothing. Deliberately not `StageHeader` — a mirror carries no rename/delete affordance of its own.
function stageValueHeader(stage: KosztorysStageT, suffix: string, tip: string): ReactNode {
  // Wraps (no truncate) into the fixed, taller header row (KosztorysEditorBody).
  return withTip(
    <HeaderLabel>{`${stage.label || `Etap ${stage.ordinal}`} ${suffix}`}</HeaderLabel>,
    tip,
  )
}

const DEFAULT_COLUMN_MIN_WIDTH = 140

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

// Insert/move disabled under an active sort (no display_order mapping); delete disabled with a
// reason (last item in a section, or a populated row) surfaced via tooltip.
function RowActionsCell({
  rowData,
  opts,
}: {
  rowData: KosztorysV2RowT
  opts: BuildV2ColumnsOptsT
}) {
  const sortActive = opts.sort != null
  const plan = opts.getRemovePlan?.(rowData)
  const removeBlockReason = plan?.kind === 'blocked' ? plan.reason : undefined
  const removeNeedsConfirm = plan != null && plan.kind !== 'blocked' && plan.requiresConfirm

  return (
    <KosztorysRowActionsMenu
      sortActive={sortActive}
      removeBlockReason={removeBlockReason}
      removeNeedsConfirm={removeNeedsConfirm}
      onInsertAbove={() => opts.onInsertItem?.(rowData, 'above')}
      onInsertBelow={() => opts.onInsertItem?.(rowData, 'below')}
      onMoveUp={() => opts.onReorderItem?.(rowData, 'up')}
      onMoveDown={() => opts.onReorderItem?.(rowData, 'down')}
      onRemove={() => opts.onRemoveItem?.(rowData)}
      onRemoveSection={opts.onRemoveSection && (() => opts.onRemoveSection?.(rowData.sectionId))}
      onInsertSectionAbove={
        opts.onInsertSection && (() => opts.onInsertSection?.(rowData, 'above'))
      }
      onInsertSectionBelow={
        opts.onInsertSection && (() => opts.onInsertSection?.(rowData, 'below'))
      }
      onMoveSectionUp={
        opts.onReorderSection && (() => opts.onReorderSection?.(rowData.sectionId, 'up'))
      }
      onMoveSectionDown={
        opts.onReorderSection && (() => opts.onReorderSection?.(rowData.sectionId, 'down'))
      }
      onSetSectionColor={
        opts.onSetSectionColor && ((color) => opts.onSetSectionColor?.(rowData.sectionId, color))
      }
      sectionColor={rowData.sectionColor}
      sectionName={rowData.sectionName ?? undefined}
      sectionItemCount={opts.getSectionItemCount?.(rowData.sectionId) ?? 0}
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
    disabled: true,
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
          keyCol('clientPrice', floatColumnLeft, {
            id: 'price',
            title: title('price', opts),
          }),
        ]
      : [
          subcontractorModeColumn(view, title('priceMode', opts, false)),
          subcontractorCoeffColumn(view, title('priceCoeff', opts, false)),
          subcontractorPriceColumn(view, title('price', opts)),
        ]
  const identity: Column<KosztorysV2RowT>[] = [
    {
      id: 'sectionName',
      title: title('sectionName', opts),
      keepFocus: true,
      component: ({ rowData, disabled }: CellProps<KosztorysV2RowT, unknown>) => (
        <SectionNameCell rowData={rowData} onRename={opts.onRenameSection} disabled={disabled} />
      ),
      copyValue: ({ rowData }) => rowData.sectionName ?? '',
      // Delete on a selected Sekcja cell is a no-op — an accidental keypress must not blank a whole
      // section. Only an explicit in-cell clear-and-commit renames it.
      deleteValue: ({ rowData }) => rowData,
    },
    keyCol('description', textColumn, {
      id: 'description',
      title: title('description', opts),
      minWidth: 240,
      grow: 2,
    }),
  ]

  // A subcontractor view is one crew's bill: only that plane's etapy get columns at all. Nothing
  // becomes uneditable — quantities are typed in the Klient view, which shows every etap.
  const viewStages = stagesForView(stages, view)

  // Przedmiar (sheet N, the offered scope) leads the stage columns rather than following them, so the
  // offered quantity reads before the per-etap execution it is measured against.
  const przedmiar: Column<KosztorysV2RowT>[] = [
    keyCol('plannedQty', floatColumnLeft, {
      id: 'plannedQty',
      title: title('plannedQty', opts),
      minWidth: 150,
    }),
  ]

  const measure: Column<KosztorysV2RowT>[] = [
    {
      ...computedColumn('stageQtySum', title('stageQtySum', opts), (r) =>
        rowTotalQtyDone(r, viewStages, view),
      ),
      minWidth: 170,
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
            rowDiscountForView(r, rowTotalQtyDone(r, viewStages, view), view),
          ),
          computedColumn('discountAmountGross', title('discountAmountGross', opts), (r) =>
            toGross(rowDiscountForView(r, rowTotalQtyDone(r, viewStages, view), view), r.vatRate),
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

  const stageCols: Column<KosztorysV2RowT>[] = viewStages.map((st) =>
    keyCol(stageKey(st.id), floatColumnLeft, {
      id: stageKey(st.id),
      title: (
        <StageHeader
          stage={st}
          onRename={opts.onRenameStage}
          onRemove={opts.onRemoveStage}
          onSetPlane={opts.onSetStagePlane}
        />
      ),
      minWidth: 150,
      // Locked until the rozliczenie is picked: qty typed here would be work nobody gets billed for,
      // and picking one costs a click.
      disabled: st.plane == null,
      ...planeUnconfirmed(st),
    }),
  )

  // The sheet's V–AE: the value of each stage's recorded qty at the view's price, post-discount.
  // Computed at render, never a row field — hence the separate id namespace (constants.ts).
  const stageValueNetCols: Column<KosztorysV2RowT>[] = viewStages.map((st) => {
    const qtyKey = stageKey(st.id)
    const header = stageValueHeader(st, 'netto', HEADER_TIPS[STAGE_VALUE_NET_COLUMN_GROUP])
    return {
      ...computedColumn(stageValueNetKey(st.id), header, (r) =>
        stageValueForView(r, r[qtyKey] ?? 0, rowTotalQtyDone(r, viewStages, view), view),
      ),
      ...planeUnconfirmed(st),
    }
  })

  const stageValueGrossCols: Column<KosztorysV2RowT>[] = viewStages.map((st) => {
    const qtyKey = stageKey(st.id)
    const header = stageValueHeader(st, 'brutto', HEADER_TIPS[STAGE_VALUE_GROSS_COLUMN_GROUP])
    return {
      ...computedColumn(stageValueGrossKey(st.id), header, (r) =>
        toGross(
          stageValueForView(r, r[qtyKey] ?? 0, rowTotalQtyDone(r, viewStages, view), view),
          r.vatRate,
        ),
      ),
      ...planeUnconfirmed(st),
    }
  })

  // The percent reading of the same stage block: one column per stage instead of the netto/brutto
  // pair, since a percentage is the same figure on either side of the VAT.
  const stageValuePercentCols: Column<KosztorysV2RowT>[] = viewStages.map((st) => {
    const qtyKey = stageKey(st.id)
    const header = stageValueHeader(st, '%', HEADER_TIPS[STAGE_VALUE_PERCENT_COLUMN_GROUP])
    return {
      ...computedColumn(
        stageValuePercentKey(st.id),
        header,
        (r) => stageDoneFraction(r, r[qtyKey] ?? 0),
        'text-muted-foreground',
        formatPercent,
      ),
      ...planeUnconfirmed(st),
    }
  })

  // The row's headline figure — available in both display modes, hence untagged: it answers "how far
  // along is this position", which the money columns never say outright.
  //
  // The przedmiar-anchored columns here and below compute at `'client'` outright, not at `view`:
  // PRZEDMIAR_ANCHORED_COLUMNS drops them outside the client view, so a `view`-reactive formula would
  // be false generality — it reads as if a subcontractor reading existed, and there isn't one.
  const donePercent: Column<KosztorysV2RowT>[] = [
    computedColumn(
      'donePercent',
      title('donePercent', opts),
      (r) => rowDoneFraction(r, rowTotalQtyDone(r, stages, 'client')),
      // Red = more was executed than was offered. The percentage says so too (>100%), but only
      // this cell says it at a glance across a thousand rows.
      (r) =>
        hasStagesOverPlanned(r, stages)
          ? 'text-destructive font-medium'
          : 'text-muted-foreground font-medium',
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
    computedColumn(
      'net',
      title('net', opts),
      (r) => rowValueForView(r, stages, view),
      'text-muted-foreground font-medium',
    ),
    computedColumn('gross', title('gross', opts), (r) =>
      toGross(rowValueForView(r, stages, view), r.vatRate),
    ),
  ]

  // Komentarz (sheet col T): the row's free-text note. Plain text column — the `note` field is
  // already diffed/persisted; this only surfaces it in the grid. Sits at the Praca/Postęp seam and
  // carries the left border, so it doubles as the block divider (layer-neutral → always visible).
  const komentarz: Column<KosztorysV2RowT>[] = [
    keyCol('note', textColumn, {
      id: 'note',
      title: title('note', opts, false),
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
    computedColumn(
      'remainingGross',
      title('remainingGross', opts),
      // The dash must survive the VAT step: toGross(null) would read 0 — "settled" — on a row
      // that has no przedmiar to settle against.
      (r) => {
        const net = rowRemainingForView(r, stages, 'client')
        return net === null ? null : toGross(net, r.vatRate)
      },
    ),
  ]

  // Przedmiar (N) leads the stage qty columns (the sheet's D–M), then Pomiar z natury (O), then
  // Komentarz (T) at the work/progress seam, then the value block (U–AE right before AF "pozostało").
  // The row-actions column leads the whole grid when editing is enabled — it rides the same
  // assemble→hide→toggle pipeline as every data column (no special-casing), so the picker can hide it
  // like any other.
  const dataColumns = [
    ...identity,
    ...przedmiar,
    ...stageCols,
    ...measure,
    ...pricing,
    ...computed,
    // Komentarz at the work/progress seam — it is the visual divider now (see the trailing gap column).
    ...komentarz,
    ...stageValueNetCols,
    ...stageValueGrossCols,
    ...stageValuePercentCols,
    ...donePercent,
    ...remaining,
  ]
  if (opts.readOnly) return dataColumns.map((c) => ({ ...c, disabled: true }))
  return opts.onRemoveItem || opts.onReorderItem
    ? [actionColumn(opts), ...dataColumns]
    : dataColumns
}

// A stage column answers to its axis's shared "Etapy — …" picker entry, not to its own id. The three
// prefixes are mutually exclusive (none is a prefix of another), so the order of these tests carries
// no meaning — the qty prefix last is not load-bearing.
function toggleKey(columnId: string): string {
  if (columnId.startsWith(`${STAGE_VALUE_NET_COLUMN_GROUP}_`)) return STAGE_VALUE_NET_COLUMN_GROUP
  if (columnId.startsWith(`${STAGE_VALUE_GROSS_COLUMN_GROUP}_`)) {
    return STAGE_VALUE_GROSS_COLUMN_GROUP
  }
  if (columnId.startsWith(`${STAGE_VALUE_PERCENT_COLUMN_GROUP}_`)) {
    return STAGE_VALUE_PERCENT_COLUMN_GROUP
  }
  return columnId.startsWith(STAGE_QTY_PREFIX) ? STAGES_COLUMN_GROUP : columnId
}

// Hide/axis/resize selection over an already-assembled column list. Split from the assembly so the
// grid and the picker can share ONE assembleV2Columns pass (buildV2Grid) instead of two.
function selectV2Columns(
  assembled: Column<KosztorysV2RowT>[],
  opts: BuildV2ColumnsOptsT,
): Column<KosztorysV2RowT>[] {
  const axis = opts.moneyAxis ?? MONEY_AXIS_DEFAULT
  const display = opts.progressDisplay ?? PROGRESS_DISPLAY_DEFAULT
  const layer = opts.layer ?? LAYER_DEFAULT
  const base = assembled
    .filter((c) => {
      const key = toggleKey(c.id ?? '')
      if (opts.clientVisible && !CLIENT_VISIBLE_COLUMNS.has(key)) return false
      if (opts.globalDiscountActive && DISCOUNT_COLUMN_IDS.has(key)) return false
      if (opts.view !== 'client' && PRZEDMIAR_ANCHORED_COLUMNS.has(key)) return false
      return (
        !opts.isHidden?.(key) &&
        axisAllows(key, axis) &&
        progressDisplayAllows(key, display) &&
        layerAllows(key, layer)
      )
    })
    .map((c) => withResize(c, opts))
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
  const items: ColumnToggleItemT[] = []
  for (const col of assembled) {
    const id = toggleKey(col.id ?? '')
    if (items.some((i) => i.id === id)) continue
    if (opts.clientVisible && !CLIENT_VISIBLE_COLUMNS.has(id)) continue
    if (opts.globalDiscountActive && DISCOUNT_COLUMN_IDS.has(id)) continue
    if (opts.view !== 'client' && PRZEDMIAR_ANCHORED_COLUMNS.has(id)) continue
    items.push({ id, label: columnLabelForView(id, opts.view), visible: !opts.isHidden?.(id) })
  }
  return items
}

// Columns-only assemble — the grid path goes through buildV2Grid; kept for the column-set unit specs
// (money-axis / layer), which assert which ids survive a predicate without the picker.
export function buildV2Columns(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT>[] {
  return selectV2Columns(assembleV2Columns(opts), opts)
}

// The grid + its picker in one assembly pass — assembleV2Columns is the O(columns·stages) build, so
// it runs once and returns both instead of once per export.
export function buildV2Grid(opts: BuildV2ColumnsOptsT): {
  columns: Column<KosztorysV2RowT>[]
  columnToggleItems: ColumnToggleItemT[]
} {
  const assembled = assembleV2Columns(opts)
  return {
    columns: selectV2Columns(assembled, opts),
    columnToggleItems: selectV2ToggleItems(assembled, opts),
  }
}
