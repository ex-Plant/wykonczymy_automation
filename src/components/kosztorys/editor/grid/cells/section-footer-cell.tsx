'use client'

import { IDENTITY_COLUMN_ID } from '@/lib/kosztorys/constants'
import { formatNet } from '@/lib/kosztorys/format'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Carried on the wrapped column's `columnData`, never a closure — see kosztorys-synthetic-rows.tsx.
// A map rather than named fields is what keeps the footer open-ended: a column with no entry renders
// blank, so covering one later is an entry, not a branch here.
export type SectionFooterContextT = {
  figures: Map<number, Map<string, number>>
}

export function SectionFooterCell({
  rowData,
  columnId,
  context,
}: {
  rowData: KosztorysV2RowT
  columnId: string | undefined
  context: SectionFooterContextT
}) {
  if (columnId === IDENTITY_COLUMN_ID)
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
