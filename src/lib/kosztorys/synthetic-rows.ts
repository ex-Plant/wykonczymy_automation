import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Every synthetic grid row lives in the negative id namespace — the spacer (-2) and „Razem" (-1) at
// the top of it, the section bands below -1000. That leaves `id < 0` as the ONE test the grid's
// onChange filters on, so a synthetic row can never reach the editor's diff no matter how many kinds
// are added. Every id in the namespace is declared here so that predicate can be checked against the
// whole set; the components that render these rows import them back.
export const TOTALS_ROW_ID = -1
export const SPACER_ROW_ID = -2
export const SECTION_HEADER_ROW_BASE = -1000

export function sectionHeaderRowId(sectionId: number): number {
  return SECTION_HEADER_ROW_BASE - sectionId
}

export function isSectionHeaderRow(id: number): boolean {
  return id <= SECTION_HEADER_ROW_BASE
}

export function isSyntheticRow(id: number): boolean {
  return id < 0
}

// Minimal stand-in rows: only `id` is read before a cell renders (rowKey), and the wrapper
// short-circuits on it before any other field is touched — hence the cast over a real row. The band
// additionally carries the section identity its cells read out.
export function makeTotalsRow(): KosztorysV2RowT {
  return { id: TOTALS_ROW_ID } as unknown as KosztorysV2RowT
}

export function makeSpacerRow(): KosztorysV2RowT {
  return { id: SPACER_ROW_ID } as unknown as KosztorysV2RowT
}

export function makeSectionHeaderRow(row: KosztorysV2RowT): KosztorysV2RowT {
  return {
    id: sectionHeaderRowId(row.sectionId),
    sectionId: row.sectionId,
    sectionName: row.sectionName,
    sectionColor: row.sectionColor,
  } as unknown as KosztorysV2RowT
}
