import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Every synthetic grid row lives in the negative id namespace — the spacer (-2) and „Razem" (-1) at
// the top of it, the section bands below -1000. That leaves `id < 0` as the ONE test the grid's
// onChange filters on, so a band can never reach the editor's diff no matter how many kinds are added.
export const SECTION_HEADER_ROW_BASE = -1000

export function sectionHeaderRowId(sectionId: number): number {
  return SECTION_HEADER_ROW_BASE - sectionId
}

export function sectionIdFromHeaderRow(rowId: number): number {
  return SECTION_HEADER_ROW_BASE - rowId
}

export function isSectionHeaderRow(id: number): boolean {
  return id <= SECTION_HEADER_ROW_BASE
}

export function isSyntheticRow(id: number): boolean {
  return id < 0
}

// Minimal stand-in row, like makeTotalsRow: the band's cells read only the section's identity, and
// the wrapper short-circuits on the id before any other field is touched — hence the cast.
function makeSectionHeaderRow(row: KosztorysV2RowT): KosztorysV2RowT {
  return {
    id: sectionHeaderRowId(row.sectionId),
    sectionId: row.sectionId,
    sectionName: row.sectionName,
    sectionColor: row.sectionColor,
  } as unknown as KosztorysV2RowT
}

type OptsT = {
  collapsedSectionIds: ReadonlySet<number>
  // False under an active column sort: grouping presumes section-contiguous rows, which a sort
  // breaks. Bands are then dropped entirely AND the collapsed set ignored — a collapsed section with
  // no band left to re-expand it would be rows the user can't get back.
  enabled: boolean
}

/**
 * The grid's row list with one band opening each section, plus the gutter's item ordinals.
 *
 * Ordinals number the rows actually rendered, so the visible column reads 1…N with no gaps; bands
 * carry no ordinal at all (a band is not a position). Assumes `viewRows` is section-contiguous —
 * true of `treeToRows` + `filterRows`, and the reason `enabled` exists for the sort that isn't.
 */
export function buildSectionHeaderRows(
  viewRows: KosztorysV2RowT[],
  { collapsedSectionIds, enabled }: OptsT,
): { rows: KosztorysV2RowT[]; ordinalByRowId: Map<number, number> } {
  const ordinalByRowId = new Map<number, number>()
  if (!enabled) {
    viewRows.forEach((row, index) => ordinalByRowId.set(row.id, index + 1))
    return { rows: viewRows, ordinalByRowId }
  }

  const rows: KosztorysV2RowT[] = []
  let currentSectionId: number | null = null
  for (const row of viewRows) {
    if (row.sectionId !== currentSectionId) {
      currentSectionId = row.sectionId
      // Emitted from the first row that survived the filter, so a section whose rows were all
      // filtered away contributes no band.
      rows.push(makeSectionHeaderRow(row))
    }
    if (collapsedSectionIds.has(row.sectionId)) continue
    ordinalByRowId.set(row.id, ordinalByRowId.size + 1)
    rows.push(row)
  }
  return { rows, ordinalByRowId }
}
