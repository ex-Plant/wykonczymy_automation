import { groupBySection } from '@/lib/kosztorys/row-ops'
import { sortRows, type SortDirT } from '@/lib/kosztorys/row-view'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// What „Zapisz kolejność" writes: the id sequence the sheet should be stored in, plus the sequence it
// held before, so undo is the same write with the two swapped. The display_order integers are the
// server's to derive — it groups by section and numbers 0…n-1 within each.
//
// Sections are still kept apart here, by emitting section block after section block rather than the
// sort's interleaving: position is only ever read within a section, so a sequence that wove two
// sections together would re-file prace under whichever section they landed next to.
//
// Takes the FULL row set, never viewRows: the search box and „tylko rozjechane" narrow a section to
// the rows that matched, and reordering only those would interleave them with the rows the filter
// hid.
export function planKosztorysRenumber(
  rows: KosztorysV2RowT[],
  getValue: (row: KosztorysV2RowT) => string | number | null,
  dir: SortDirT,
): { before: number[]; after: number[] } {
  const before: number[] = []
  const after: number[] = []
  for (const sectionRows of groupBySection(rows).values()) {
    for (const row of sectionRows) before.push(row.id)
    for (const row of sortRows(sectionRows, getValue, dir)) after.push(row.id)
  }
  return { before, after }
}
