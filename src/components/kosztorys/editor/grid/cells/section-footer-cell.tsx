'use client'

import { IDENTITY_COLUMN_ID } from '@/lib/kosztorys/constants'
import { formatNet } from '@/lib/kosztorys/format'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Carried on the wrapped column's `columnData`, never a closure — see kosztorys-synthetic-rows.tsx.
// A map rather than named fields is what keeps the footer open-ended: a column with no entry renders
// blank, so covering one later is an entry, not a branch here.
export type SectionFooterContextT = {
  figures: Map<number, Map<string, number>>
  // Which column carries „Razem <sekcja>" — see sectionFooterLabelColumnId.
  labelColumnId: string | undefined
}

// The label starts under „Sekcja" rather than „Opis prac", so it opens right where the section's own
// name reads in the rows above. dsg has no colspan, so the span is spelled the only way it can be:
// „Sekcja" prints the label and simply overflows „Opis prac" (which renders blank and, per
// globals.css, drops its vertical rule) — the two read as one merged cell, „Akcje" stays its own.
// „Sekcja" can be hidden by the picker, hence a candidate list rather than a fixed id.
const LABEL_COLUMN_CANDIDATES = ['sectionName', IDENTITY_COLUMN_ID]

export function sectionFooterLabelColumnId(
  columnIds: readonly (string | undefined)[],
): string | undefined {
  return LABEL_COLUMN_CANDIDATES.find((id) => columnIds.includes(id))
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
  if (columnId != null && columnId === context.labelColumnId)
    // `z-10` is what lets the overflow show: dsg cells are absolutely positioned siblings, so the
    // ones to the right would otherwise paint their background over the spill. Stays under the
    // sticky gutter (dsg gives it z-index 30), which must keep clipping the label on a scroll right.
    return (
      <div className="text-foreground relative z-10 flex size-full items-center gap-1 px-2 text-sm font-bold whitespace-nowrap">
        <span>Razem</span>
        <span>{rowData.sectionName ?? ''}</span>
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
