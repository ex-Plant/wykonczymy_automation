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
  // is suppressed while a filter is on (search or a condition) and restored when it clears.
  foldSuppressed: boolean
  // Every section in the base dataset, in display order, each represented by one of its rows (the
  // band reads name and colour off it). Taken from the FULL dataset, not the filtered view, so the
  // sections keep their original order regardless of which ones the filter thinned out.
  sections: readonly KosztorysV2RowT[]
}

/** One representative row per section, in the order the sections first appear. */
export function sectionRepresentatives(rows: readonly KosztorysV2RowT[]): KosztorysV2RowT[] {
  const bySection = new Map<number, KosztorysV2RowT>()
  for (const row of rows) if (!bySection.has(row.sectionId)) bySection.set(row.sectionId, row)
  return [...bySection.values()]
}

/**
 * A pozycja's number: its rank among ALL item rows in display order.
 *
 * Computed over the unfiltered, unsorted dataset on purpose — a number that renumbered itself per
 * view would make a filter invisible (1…N either way) and a sort would silently reassign every
 * position. Numbers skipping is the signal that something is hidden.
 */
export function baseOrdinals(rows: readonly KosztorysV2RowT[]): Map<number, number> {
  return new Map(rows.map((row, index) => [row.id, index + 1]))
}

/**
 * The grid's row list with one band opening each section and a totals band closing it.
 *
 * A section the filter emptied is dropped whole — band, sum and all. A header over a footer with
 * nothing between says only „tu nic nie ma", and a strict filter (five hits across a dozen sections)
 * would bury its own results under eleven such frames.
 */
export function buildSectionBandRows(
  viewRows: KosztorysV2RowT[],
  { collapsedSectionIds, enabled, foldSuppressed, sections }: OptsT,
): KosztorysV2RowT[] {
  if (!enabled) return viewRows

  const collapsed = foldSuppressed ? EMPTY_COLLAPSED : collapsedSectionIds
  const bySection = new Map<number, KosztorysV2RowT[]>()
  for (const row of viewRows) {
    const group = bySection.get(row.sectionId)
    if (group) group.push(row)
    else bySection.set(row.sectionId, [row])
  }

  const rows: KosztorysV2RowT[] = []
  for (const section of sections) {
    const group = bySection.get(section.sectionId)
    if (!group) continue
    bySection.delete(section.sectionId)
    rows.push(makeSectionHeaderRow(section))
    // A collapsed section shows its header alone: the footer sums the rows it hides, so it goes
    // with them.
    if (collapsed.has(section.sectionId)) continue
    rows.push(...group, makeSectionFooterRow(section))
  }
  // A row whose section the list never named would otherwise vanish from the grid — render it
  // bandless rather than drop it.
  for (const orphans of bySection.values()) rows.push(...orphans)
  return rows
}
