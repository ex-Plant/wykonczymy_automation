import { describe, expect, it } from 'vitest'

import { buildSectionBandRows } from '@/lib/kosztorys/section-band-rows'
import {
  isSectionFooterRow,
  isSectionHeaderRow,
  isSyntheticRow,
  SECTION_HEADER_ROW_BASE,
  sectionFooterRowId,
  sectionHeaderRowId,
} from '@/lib/kosztorys/synthetic-rows'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

function row(id: number, sectionId: number): KosztorysV2RowT {
  return {
    id,
    sectionId,
    sectionName: `Sekcja ${sectionId}`,
    sectionColor: null,
  } as KosztorysV2RowT
}

// Two sections, three items then two — the shape every case below narrows.
const VIEW_ROWS = [row(1, 10), row(2, 10), row(3, 10), row(4, 20), row(5, 20)]

const opts = (collapsed: number[] = [], foldSuppressed = false, enabled = true) => ({
  enabled,
  collapsedSectionIds: new Set(collapsed),
  foldSuppressed,
})

describe('section band row ids', () => {
  it('derives one id per section id', () => {
    expect(SECTION_HEADER_ROW_BASE - sectionHeaderRowId(42)).toBe(42)
    expect(sectionHeaderRowId(1)).not.toBe(sectionHeaderRowId(2))
    expect(sectionFooterRowId(1)).not.toBe(sectionFooterRowId(2))
  })

  it('separates band ids from the spacer and „Razem" rows', () => {
    expect(isSectionHeaderRow(sectionHeaderRowId(0))).toBe(true)
    expect(isSectionHeaderRow(-1)).toBe(false)
    expect(isSectionHeaderRow(-2)).toBe(false)
    expect(isSectionFooterRow(-1)).toBe(false)
    expect(isSectionFooterRow(-2)).toBe(false)
    expect(isSyntheticRow(sectionHeaderRowId(0))).toBe(true)
    expect(isSyntheticRow(sectionFooterRowId(0))).toBe(true)
    expect(isSyntheticRow(1)).toBe(false)
  })

  // The predicate that decides which cell, row height and wash a band gets — an overlap would render
  // a footer as a header.
  it('never classifies a band as both a header and a footer', () => {
    for (const sectionId of [0, 1, 42, 998_999]) {
      expect(isSectionFooterRow(sectionHeaderRowId(sectionId))).toBe(false)
      expect(isSectionHeaderRow(sectionFooterRowId(sectionId))).toBe(false)
    }
  })
})

describe('buildSectionBandRows', () => {
  it('brackets each section with an opening and a closing band', () => {
    const { rows } = buildSectionBandRows(VIEW_ROWS, opts())

    expect(rows.map((r) => r.id)).toEqual([
      sectionHeaderRowId(10),
      1,
      2,
      3,
      sectionFooterRowId(10),
      sectionHeaderRowId(20),
      4,
      5,
      sectionFooterRowId(20),
    ])
    expect(rows[0].sectionId).toBe(10)
    expect(rows[0].sectionName).toBe('Sekcja 10')
    expect(rows[4].sectionId).toBe(10)
  })

  // Under a whole-kosztorys sort the rows are interleaved, so bands would bracket the wrong rows —
  // and with no header left to click, a fold would hide its rows with no way back.
  it('passes the rows through bandless and unfolded when disabled', () => {
    const { rows, ordinalByRowId } = buildSectionBandRows(VIEW_ROWS, opts([10], false, false))

    expect(rows).toBe(VIEW_ROWS)
    expect([...ordinalByRowId.entries()]).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [5, 5],
    ])
  })

  it('keeps a collapsed section header and drops its items with their footer', () => {
    const { rows } = buildSectionBandRows(VIEW_ROWS, opts([10]))

    expect(rows.map((r) => r.id)).toEqual([
      sectionHeaderRowId(10),
      sectionHeaderRowId(20),
      4,
      5,
      sectionFooterRowId(20),
    ])
  })

  it('emits no band for a section whose rows were all filtered away', () => {
    const { rows } = buildSectionBandRows([row(4, 20), row(5, 20)], opts())

    expect(rows.map((r) => r.id)).toEqual([sectionHeaderRowId(20), 4, 5, sectionFooterRowId(20)])
  })

  it('numbers item rows continuously across bands, never the bands themselves', () => {
    const { rows, ordinalByRowId } = buildSectionBandRows(VIEW_ROWS, opts())

    expect([...ordinalByRowId.entries()]).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [5, 5],
    ])
    for (const band of rows.filter((r) => isSyntheticRow(r.id))) {
      expect(ordinalByRowId.has(band.id)).toBe(false)
    }
  })

  it('leaves no gap in the numbering when a section is collapsed', () => {
    const { ordinalByRowId } = buildSectionBandRows(VIEW_ROWS, opts([10]))

    expect([...ordinalByRowId.entries()]).toEqual([
      [4, 1],
      [5, 2],
    ])
  })

  it('ignores a collapsed section while a row filter is active', () => {
    const { rows } = buildSectionBandRows(VIEW_ROWS, opts([10], true))

    expect(rows.map((r) => r.id)).toEqual([
      sectionHeaderRowId(10),
      1,
      2,
      3,
      sectionFooterRowId(10),
      sectionHeaderRowId(20),
      4,
      5,
      sectionFooterRowId(20),
    ])
  })

  it('emits one band pair per section even when its rows arrive in two blocks', () => {
    const { rows } = buildSectionBandRows([row(1, 10), row(4, 20), row(2, 10)], opts())

    expect(rows.map((r) => r.id)).toEqual([
      sectionHeaderRowId(10),
      1,
      sectionFooterRowId(10),
      sectionHeaderRowId(20),
      4,
      sectionFooterRowId(20),
      2,
    ])
  })

  // Same guard, one block further: a band id is a pure function of its section, so re-emitting the
  // pair would hand dsg's virtualizer a duplicate key. The bounded cost is that the third block's
  // rows render outside any band — recorded so the degradation is known, not discovered.
  it('leaves a third block of the same section outside any band rather than repeating its id', () => {
    const { rows } = buildSectionBandRows(
      [row(1, 10), row(4, 20), row(2, 10), row(5, 20), row(3, 10)],
      opts(),
    )

    expect(rows.map((r) => r.id)).toEqual([
      sectionHeaderRowId(10),
      1,
      sectionFooterRowId(10),
      sectionHeaderRowId(20),
      4,
      sectionFooterRowId(20),
      2,
      5,
      3,
    ])
  })
})
