'use client'

import { type CellProps, type Column } from 'react-datasheet-grid'
import {
  SectionHeaderCell,
  sectionHeaderSlot,
  type SectionHeaderContextT,
  type SectionHeaderSlotT,
} from '@/components/kosztorys/editor/grid/cells/section-header-cell'
import {
  SectionFooterCell,
  type SectionFooterContextT,
} from '@/components/kosztorys/editor/grid/cells/section-footer-cell'
import { formatNet } from '@/lib/kosztorys/format'
import {
  isSectionFooterRow,
  isSectionHeaderRow,
  SPACER_ROW_ID,
  TOTALS_ROW_ID,
} from '@/lib/kosztorys/synthetic-rows'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// „Razem" rides the grid's own layout, so column alignment and horizontal scroll come for free; the
// price of that is that dsg renders EVERY column's cell against it, so `withSyntheticRows` wraps each
// column to render a baked total on this row (and its normal cell on every real row). The section
// bands are the same mechanism, one branch further.

// The label column (widest identity column) carries the „Razem" caption instead of a number.
const LABEL_COLUMN_ID = 'description'

// Left-aligned like the data cells (computed-cell.tsx / floatColumnLeft are `text-left px-2`), so a
// column's total sits directly under its values.
function TotalsRowCell({ content }: { content: string }) {
  return (
    <div className="bg-muted text-foreground border-border flex size-full items-center border-t-2 px-2 text-base font-semibold tabular-nums">
      {content}
    </div>
  )
}

// Per-column synthetic-row metadata carried on the wrapped column's `columnData`, not baked into a
// closure. `base` is the wrapped column's own cell (its columnData type varies per column —
// keyColumn, floatColumn, …); Column's default C already widens it, so no explicit `any` is needed.
type SyntheticColumnDataT = {
  content: string
  slot: SectionHeaderSlotT
  columnId: string | undefined
  sectionHeader: SectionHeaderContextT
  sectionFooter: SectionFooterContextT
  base: Column<KosztorysV2RowT>['component']
}

// A SINGLE stable component reused for every wrapped column. It must be module-level, not a fresh
// closure per `withSyntheticRows` call: `columns` is rebuilt on every render (harmlessly — dsg's own
// `keyColumn` keeps a stable `component` across those rebuilds), so a per-call closure would give
// every cell a new `component` identity each render, and dsg remounts a cell whose component type
// changed — tearing down the focused <input> mid-edit and dropping all but the last character typed.
// The per-column total + underlying cell ride on `columnData` (a prop → re-render, not remount),
// exactly the indirection `keyColumn` uses to stay stable.
function SyntheticAwareCell(props: CellProps<KosztorysV2RowT, SyntheticColumnDataT>) {
  const { rowData, columnData } = props
  if (rowData.id === SPACER_ROW_ID) return <div className="bg-background size-full" />
  if (rowData.id === TOTALS_ROW_ID) return <TotalsRowCell content={columnData.content} />
  if (isSectionHeaderRow(rowData.id))
    return (
      <SectionHeaderCell
        rowData={rowData}
        slot={columnData.slot}
        context={columnData.sectionHeader}
      />
    )
  if (isSectionFooterRow(rowData.id))
    return (
      <SectionFooterCell
        rowData={rowData}
        columnId={columnData.columnId}
        context={columnData.sectionFooter}
      />
    )
  const Base = columnData.base
  return Base ? <Base {...props} /> : null
}

export function withSyntheticRows(
  column: Column<KosztorysV2RowT>,
  {
    totals,
    sectionHeader,
    sectionFooter,
  }: {
    totals: Map<string, number>
    sectionHeader: SectionHeaderContextT
    sectionFooter: SectionFooterContextT
  },
): Column<KosztorysV2RowT> {
  const total = column.id != null ? totals.get(column.id) : undefined
  const content = column.id === LABEL_COLUMN_ID ? 'Razem' : total != null ? formatNet(total) : ''
  return {
    ...column,
    component: SyntheticAwareCell as Column<KosztorysV2RowT>['component'],
    // Merge over the wrapped column's own columnData so a delegated base cell (e.g. keyColumn's
    // KeyComponent, which reads columnData.key/original) still finds what it needs.
    columnData: {
      ...column.columnData,
      content,
      slot: sectionHeaderSlot(column.id),
      columnId: column.id,
      sectionHeader,
      sectionFooter,
      base: column.component,
    },
  }
}
