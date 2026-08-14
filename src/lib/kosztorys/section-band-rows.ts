import { makeSectionFooterRow, makeSectionHeaderRow } from '@/lib/kosztorys/synthetic-rows'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

const EMPTY_COLLAPSED: ReadonlySet<number> = new Set()

type OptsT = {
  collapsedSectionIds: ReadonlySet<number>
  // False under an active column sort: grouping presumes section-contiguous rows, which a sort
  // breaks. Bands are then dropped entirely AND the collapsed set ignored — a collapsed section with
  // no band left to re-expand it would be rows the user can't get back.
  enabled: boolean
  // Any row filter narrows to the rows that matched, so a fold left over from before it would hide
  // hits behind a band that gives no hint they exist — the grid would read as "no results". The fold
  // is suppressed while a filter is on (search, „tylko rozjechane") and restored when it clears.
  foldSuppressed: boolean
}

/**
 * The grid's row list with one band opening each section and a totals band closing it, plus the
 * gutter's item ordinals.
 *
 * Ordinals number the rows actually rendered, so the visible column reads 1…N with no gaps; bands
 * carry no ordinal at all (a band is not a position).
 */
export function buildSectionBandRows(
  viewRows: KosztorysV2RowT[],
  { collapsedSectionIds, enabled, foldSuppressed }: OptsT,
): { rows: KosztorysV2RowT[]; ordinalByRowId: Map<number, number> } {
  const ordinalByRowId = new Map<number, number>()
  if (!enabled) {
    viewRows.forEach((row, index) => ordinalByRowId.set(row.id, index + 1))
    return { rows: viewRows, ordinalByRowId }
  }

  const collapsed = foldSuppressed ? EMPTY_COLLAPSED : collapsedSectionIds
  const rows: KosztorysV2RowT[] = []
  // A band's id is a pure function of its section, so a section appearing in two blocks would emit
  // the same id twice — duplicate keys in dsg's virtualizer. Rows normally arrive section-contiguous;
  // these keep the failure to a mis-grouped block rather than a corrupt render if one ever doesn't.
  const headered = new Set<number>()
  const footered = new Set<number>()
  // A whole row, not a sectionId: the footer reads the section's name and colour off it.
  let openRow: KosztorysV2RowT | null = null

  function closeOpenSection() {
    if (openRow == null) return
    const section = openRow
    openRow = null
    // A collapsed section shows its header alone: the footer sums the rows it hides, so it goes
    // with them.
    if (collapsed.has(section.sectionId) || footered.has(section.sectionId)) return
    footered.add(section.sectionId)
    rows.push(makeSectionFooterRow(section))
  }

  for (const row of viewRows) {
    if (openRow != null && openRow.sectionId !== row.sectionId) closeOpenSection()
    if (!headered.has(row.sectionId)) {
      headered.add(row.sectionId)
      // Emitted from the first row that survived the filter, so a section whose rows were all
      // filtered away contributes no band — footer included, since the block never opens.
      rows.push(makeSectionHeaderRow(row))
    }
    openRow = row
    if (collapsed.has(row.sectionId)) continue
    ordinalByRowId.set(row.id, ordinalByRowId.size + 1)
    rows.push(row)
  }
  closeOpenSection()
  return { rows, ordinalByRowId }
}
