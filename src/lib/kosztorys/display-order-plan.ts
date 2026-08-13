import type { DisplayOrderRefT } from '@/lib/kosztorys/display-order'
import { sortRows, type SortDirT } from '@/lib/kosztorys/row-view'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// What „Utrwal kolejność" writes: one section's rows renumbered 0…n-1 in the grid's current sort
// order, plus the order they held before so undo is the same write with the two swapped.
//
// Takes the FULL row set, never viewRows: the search box and „tylko rozjechane" narrow a section to
// the rows that matched, and renumbering only those would interleave them with the rows the filter
// hid. Filtering by sectionId here is what makes that impossible to get wrong at the call site.
export function planSectionRenumber(
  rows: KosztorysV2RowT[],
  sectionId: number,
  getValue: (row: KosztorysV2RowT) => string | number | null,
  dir: SortDirT,
): { before: DisplayOrderRefT[]; after: DisplayOrderRefT[] } {
  const sectionRows = rows.filter((r) => r.sectionId === sectionId)
  const sorted = sortRows(sectionRows, getValue, dir)
  return {
    before: sectionRows.map((row) => ({ id: row.id, displayOrder: row.displayOrder })),
    after: sorted.map((row, index) => ({ id: row.id, displayOrder: index })),
  }
}
