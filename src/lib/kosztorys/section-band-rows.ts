import { engagedHiders } from '@/lib/kosztorys/row-conditions'
import { groupBySection } from '@/lib/kosztorys/row-ops'
import { makeSectionFooterRow, makeSectionHeaderRow } from '@/lib/kosztorys/synthetic-rows'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

const EMPTY_COLLAPSED: ReadonlySet<number> = new Set()

type OptsT = {
  collapsedSectionIds: ReadonlySet<number>
  // False under a sort scoped to the whole kosztorys: grouping presumes section-contiguous rows,
  // which such a sort breaks. Bands are then dropped entirely AND the collapsed set ignored — a
  // collapsed section with no band left to re-expand it would be rows the user can't get back.
  // A sort scoped to the sections keeps the rows contiguous, so the bands stay.
  enabled: boolean
  // See `isFoldSuppressed` for what turns this on and why.
  foldSuppressed: boolean
  // Every section in the base dataset, in display order, each represented by one of its rows (the
  // band reads name and colour off it). Taken from the FULL dataset, not the filtered view, so the
  // sections keep their original order regardless of which ones the filter thinned out.
  sections: readonly KosztorysV2RowT[]
}

/**
 * Whether the folds have to stand down for now — the reader is narrowing, and a fold left over from
 * before would hide the very pozycje the narrowing was asked to find, behind a band that gives no
 * hint they are there.
 *
 * Both narrowings count, because both fail the same way: a hit inside a folded sekcja is a hit the
 * user is told does not exist. Search has always suppressed folding; the conditions did not, on the
 * argument that they and the folds are ticked in the same „Filtry" menu and so the fold is at least
 * visible beside them. That argument covered where the fold could be SEEN, not what it did to the
 * result — and it stopped holding once the active-filters bar started reporting both on one line.
 *
 * A diagnostic narrows too, and is still left out on purpose: it comes with its own count on its own
 * trigger, so the reader is checking off a number they were given rather than hunting for a pozycja
 * they believe is in there. Should that stop being true, this is the one place to widen.
 */
export function isFoldSuppressed(search: string, engagedIds: ReadonlySet<string>): boolean {
  return search.trim() !== '' || engagedHiders(engagedIds).length > 0
}

export function sectionRepresentatives(rows: readonly KosztorysV2RowT[]): KosztorysV2RowT[] {
  const bySection = new Map<number, KosztorysV2RowT>()
  for (const row of rows) if (!bySection.has(row.sectionId)) bySection.set(row.sectionId, row)
  return [...bySection.values()]
}

/**
 * A pozycja's number: its rank among the rows passed in, in display order.
 *
 * Never over a searched or sorted list — a number that renumbered itself as the reader typed would
 * name a different pozycja every keystroke. Which rows count is the caller's call: the owner's grid
 * passes the full dataset so a skipped number announces what a filter hid, the client's document
 * passes the rows it actually contains so the offer runs 1…N.
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
  const bySection = groupBySection(viewRows)

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
