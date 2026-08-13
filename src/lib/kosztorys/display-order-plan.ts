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

// „Utrwal kolejność w całym kosztorysie": the same write over every section at once, so one command
// bakes the whole sheet and one undo takes it back.
//
// Each section is still renumbered 0…n-1 on its own — that is what keeps the sections apart. A single
// running index across the whole sheet would express the sort's interleaving, which display_order
// cannot carry: position is only ever read within a section, so a global index would re-file prace
// under whichever section they landed next to.
export function planKosztorysRenumber(
  rows: KosztorysV2RowT[],
  getValue: (row: KosztorysV2RowT) => string | number | null,
  dir: SortDirT,
): { before: DisplayOrderRefT[]; after: DisplayOrderRefT[] } {
  const before: DisplayOrderRefT[] = []
  const after: DisplayOrderRefT[] = []
  for (const sectionId of new Set(rows.map((r) => r.sectionId))) {
    const plan = planSectionRenumber(rows, sectionId, getValue, dir)
    before.push(...plan.before)
    after.push(...plan.after)
  }
  return { before, after }
}
