import type { DisplayOrderRefT } from '@/lib/kosztorys/display-order'
import { groupBySection } from '@/lib/kosztorys/row-ops'
import { sortRows, type SortDirT } from '@/lib/kosztorys/row-view'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// What „Zapisz kolejność" writes: every row renumbered 0…n-1 in the grid's current sort order, plus
// the order they held before, so undo is the same write with the two swapped.
//
// Each section is renumbered on its own — that is what keeps the sections apart. A single running
// index across the whole sheet would express the sort's interleaving, which display_order cannot
// carry: position is only ever read within a section, so a global index would re-file prace under
// whichever section they landed next to.
//
// Takes the FULL row set, never viewRows: the search box and „tylko rozjechane" narrow a section to
// the rows that matched, and renumbering only those would interleave them with the rows the filter
// hid.
export function planKosztorysRenumber(
  rows: KosztorysV2RowT[],
  getValue: (row: KosztorysV2RowT) => string | number | null,
  dir: SortDirT,
): { before: DisplayOrderRefT[]; after: DisplayOrderRefT[] } {
  const before: DisplayOrderRefT[] = []
  const after: DisplayOrderRefT[] = []
  for (const sectionRows of groupBySection(rows).values()) {
    for (const row of sectionRows) before.push({ id: row.id, displayOrder: row.displayOrder })
    sortRows(sectionRows, getValue, dir).forEach((row, index) =>
      after.push({ id: row.id, displayOrder: index }),
    )
  }
  return { before, after }
}
