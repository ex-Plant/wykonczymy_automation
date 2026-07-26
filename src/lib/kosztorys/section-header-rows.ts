import { makeSectionHeaderRow } from '@/lib/kosztorys/synthetic-rows'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

const EMPTY_COLLAPSED: ReadonlySet<number> = new Set()

type OptsT = {
  collapsedSectionIds: ReadonlySet<number>
  // False under an active column sort: grouping presumes section-contiguous rows, which a sort
  // breaks. Bands are then dropped entirely AND the collapsed set ignored — a collapsed section with
  // no band left to re-expand it would be rows the user can't get back.
  enabled: boolean
  // A search narrows to the rows that matched, so a fold left over from before the search would hide
  // hits behind a band that gives no hint they exist — the grid would read as "no results". The fold
  // is suppressed while searching and restored when the box clears.
  searchActive: boolean
}

/**
 * The grid's row list with one band opening each section, plus the gutter's item ordinals.
 *
 * Ordinals number the rows actually rendered, so the visible column reads 1…N with no gaps; bands
 * carry no ordinal at all (a band is not a position).
 */
export function buildSectionHeaderRows(
  viewRows: KosztorysV2RowT[],
  { collapsedSectionIds, enabled, searchActive }: OptsT,
): { rows: KosztorysV2RowT[]; ordinalByRowId: Map<number, number> } {
  const ordinalByRowId = new Map<number, number>()
  if (!enabled) {
    viewRows.forEach((row, index) => ordinalByRowId.set(row.id, index + 1))
    return { rows: viewRows, ordinalByRowId }
  }

  const collapsed = searchActive ? EMPTY_COLLAPSED : collapsedSectionIds
  const rows: KosztorysV2RowT[] = []
  // A band's id is a pure function of its section, so a section appearing in two blocks would emit
  // the same id twice — duplicate keys in dsg's virtualizer. Rows normally arrive section-contiguous;
  // this keeps the failure to a mis-grouped block rather than a corrupt render if one ever doesn't.
  const banded = new Set<number>()
  for (const row of viewRows) {
    if (!banded.has(row.sectionId)) {
      banded.add(row.sectionId)
      // Emitted from the first row that survived the filter, so a section whose rows were all
      // filtered away contributes no band.
      rows.push(makeSectionHeaderRow(row))
    }
    if (collapsed.has(row.sectionId)) continue
    ordinalByRowId.set(row.id, ordinalByRowId.size + 1)
    rows.push(row)
  }
  return { rows, ordinalByRowId }
}
