import { describe, expect, it } from 'vitest'

import {
  buildSectionHeaderRows,
  isSectionHeaderRow,
  isSyntheticRow,
  sectionHeaderRowId,
  sectionIdFromHeaderRow,
} from '@/lib/kosztorys/section-header-rows'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

function row(id: number, sectionId: number): KosztorysV2RowT {
  return { id, sectionId, sectionName: `Sekcja ${sectionId}`, sectionColor: null } as KosztorysV2RowT
}

// Two sections, three items then two — the shape every case below narrows.
const VIEW_ROWS = [row(1, 10), row(2, 10), row(3, 10), row(4, 20), row(5, 20)]

const enabled = (collapsed: number[] = []) => ({
  collapsedSectionIds: new Set(collapsed),
  enabled: true,
})

describe('section header row ids', () => {
  it('round-trips a section id', () => {
    expect(sectionIdFromHeaderRow(sectionHeaderRowId(42))).toBe(42)
  })

  it('separates band ids from the spacer and „Razem" rows', () => {
    expect(isSectionHeaderRow(sectionHeaderRowId(0))).toBe(true)
    expect(isSectionHeaderRow(-1)).toBe(false)
    expect(isSectionHeaderRow(-2)).toBe(false)
    expect(isSyntheticRow(sectionHeaderRowId(0))).toBe(true)
    expect(isSyntheticRow(1)).toBe(false)
  })
})

describe('buildSectionHeaderRows', () => {
  it('opens each section with a band carrying the section identity', () => {
    const { rows } = buildSectionHeaderRows(VIEW_ROWS, enabled())

    expect(rows.map((r) => r.id)).toEqual([
      sectionHeaderRowId(10),
      1,
      2,
      3,
      sectionHeaderRowId(20),
      4,
      5,
    ])
    expect(rows[0].sectionId).toBe(10)
    expect(rows[0].sectionName).toBe('Sekcja 10')
  })

  it('keeps a collapsed section band and drops its items', () => {
    const { rows } = buildSectionHeaderRows(VIEW_ROWS, enabled([10]))

    expect(rows.map((r) => r.id)).toEqual([sectionHeaderRowId(10), sectionHeaderRowId(20), 4, 5])
  })

  it('emits no band for a section whose rows were all filtered away', () => {
    const { rows } = buildSectionHeaderRows([row(4, 20), row(5, 20)], enabled())

    expect(rows.map((r) => r.id)).toEqual([sectionHeaderRowId(20), 4, 5])
  })

  it('numbers item rows continuously across bands, never the bands themselves', () => {
    const { rows, ordinalByRowId } = buildSectionHeaderRows(VIEW_ROWS, enabled())

    expect([...ordinalByRowId.entries()]).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [5, 5],
    ])
    for (const band of rows.filter((r) => isSectionHeaderRow(r.id))) {
      expect(ordinalByRowId.has(band.id)).toBe(false)
    }
  })

  it('leaves no gap in the numbering when a section is collapsed', () => {
    const { ordinalByRowId } = buildSectionHeaderRows(VIEW_ROWS, enabled([10]))

    expect([...ordinalByRowId.entries()]).toEqual([
      [4, 1],
      [5, 2],
    ])
  })

  it('passes the rows through untouched when disabled by an active sort', () => {
    const { rows, ordinalByRowId } = buildSectionHeaderRows(VIEW_ROWS, {
      // Even a collapsed section stays visible: with no band there would be nothing to re-expand it.
      collapsedSectionIds: new Set([10]),
      enabled: false,
    })

    expect(rows).toBe(VIEW_ROWS)
    expect([...ordinalByRowId.values()]).toEqual([1, 2, 3, 4, 5])
  })
})
