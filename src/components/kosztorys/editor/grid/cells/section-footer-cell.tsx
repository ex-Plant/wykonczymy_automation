'use client'

import { formatNet } from '@/lib/kosztorys/format'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// The section's figures, keyed section id → column id → value, carried on the wrapped column's
// `columnData` (never a closure — see kosztorys-synthetic-rows.tsx). A map rather than named fields
// is what keeps the footer honest about its own limits: a column the per-section subtotals cannot
// supply simply has no entry and renders blank, so adding one later is an entry, not a branch.
export type SectionFooterContextT = {
  figures: Map<number, Map<string, number>>
}

// The identity column carries the caption instead of a number, the way „Razem" does.
const CAPTION_COLUMN_ID = 'description'

export function SectionFooterCell({
  rowData,
  columnId,
  context,
}: {
  rowData: KosztorysV2RowT
  columnId: string | undefined
  context: SectionFooterContextT
}) {
  if (columnId === CAPTION_COLUMN_ID)
    return (
      <div className="text-foreground flex size-full items-center gap-1 px-2 text-sm font-bold">
        <span className="shrink-0">Razem</span>
        <span className="min-w-0 truncate">{rowData.sectionName ?? ''}</span>
      </div>
    )

  const value = columnId == null ? undefined : context.figures.get(rowData.sectionId)?.get(columnId)
  if (value == null) return <div className="size-full" />

  // Left-aligned like the data cells and like „Razem", so a section's figure sits directly under the
  // column's values and directly above the grand total.
  return (
    <div className="flex size-full items-center px-2 text-sm font-semibold tabular-nums">
      {formatNet(value)}
    </div>
  )
}
