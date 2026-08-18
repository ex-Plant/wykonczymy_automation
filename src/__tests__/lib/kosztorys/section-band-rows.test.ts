import { describe, expect, it } from 'vitest'

import {
  baseOrdinals,
  buildSectionBandRows,
  isFoldSuppressed,
  sectionRepresentatives,
} from '@/lib/kosztorys/section-band-rows'
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

// The section list always comes off the FULL dataset, whatever subset the view is showing.
const enabled = (collapsed: number[] = [], foldSuppressed = false) => ({
  collapsedSectionIds: new Set(collapsed),
  enabled: true,
  foldSuppressed,
  sections: sectionRepresentatives(VIEW_ROWS),
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
    const rows = buildSectionBandRows(VIEW_ROWS, enabled())

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

  it('keeps a collapsed section header and drops its items with their footer', () => {
    const rows = buildSectionBandRows(VIEW_ROWS, enabled([10]))

    expect(rows.map((r) => r.id)).toEqual([
      sectionHeaderRowId(10),
      sectionHeaderRowId(20),
      4,
      5,
      sectionFooterRowId(20),
    ])
  })

  // A header over a footer with nothing between says only „tu nic nie ma". Under a strict filter the
  // grid would be mostly such frames, with the few hits lost among them.
  it('drops the band of a section whose rows were all filtered away', () => {
    const rows = buildSectionBandRows([row(4, 20), row(5, 20)], enabled())

    expect(rows.map((r) => r.id)).toEqual([sectionHeaderRowId(20), 4, 5, sectionFooterRowId(20)])
  })

  it('drops every band when the filter emptied the whole grid', () => {
    expect(buildSectionBandRows([], enabled())).toEqual([])
  })

  it('ignores a collapsed section while a row filter is active', () => {
    const rows = buildSectionBandRows(VIEW_ROWS, enabled([10], true))

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

  // Bands come from the section list, so rows arriving out of order are regrouped rather than
  // emitting a second band pair (a duplicate key for dsg's virtualizer) or spilling outside a band.
  it('gathers a section arriving in two blocks under one band pair', () => {
    const rows = buildSectionBandRows([row(1, 10), row(4, 20), row(2, 10)], enabled())

    expect(rows.map((r) => r.id)).toEqual([
      sectionHeaderRowId(10),
      1,
      2,
      sectionFooterRowId(10),
      sectionHeaderRowId(20),
      4,
      sectionFooterRowId(20),
    ])
  })

  it('renders a row whose section the list never named rather than dropping it', () => {
    const rows = buildSectionBandRows([row(9, 30)], enabled())

    expect(rows.map((r) => r.id)).toContain(9)
  })

  it('passes the rows through untouched when disabled by an active sort', () => {
    const rows = buildSectionBandRows(VIEW_ROWS, {
      // Even a collapsed section stays visible: with no band there would be nothing to re-expand it.
      collapsedSectionIds: new Set([10]),
      enabled: false,
      foldSuppressed: false,
      sections: sectionRepresentatives(VIEW_ROWS),
    })

    expect(rows).toBe(VIEW_ROWS)
  })
})

describe('baseOrdinals — a pozycja keeps its number', () => {
  it('numbers the full dataset in display order', () => {
    expect([...baseOrdinals(VIEW_ROWS).entries()]).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [5, 5],
    ])
  })

  it('leaves the numbers of the survivors alone when rows are filtered away', () => {
    // Numbers skipping is what makes the filter visible; renumbering 1..N would hide it.
    const ordinals = baseOrdinals(VIEW_ROWS)

    expect([row(2, 10), row(5, 20)].map((r) => ordinals.get(r.id))).toEqual([2, 5])
  })
})

describe('sectionRepresentatives', () => {
  it('names each section once, in the order it first appears', () => {
    expect(sectionRepresentatives(VIEW_ROWS).map((r) => r.sectionId)).toEqual([10, 20])
  })

  it('keeps the first row of a section as its representative even when the section is split', () => {
    const reps = sectionRepresentatives([row(4, 20), row(1, 10), row(5, 20)])

    expect(reps.map((r) => r.id)).toEqual([4, 1])
  })
})

describe('isFoldSuppressed', () => {
  const NOTHING = new Set<string>()

  it('leaves the folds standing while the reader is not narrowing', () => {
    expect(isFoldSuppressed('', NOTHING)).toBe(false)
    expect(isFoldSuppressed('   ', NOTHING)).toBe(false)
  })

  it('stands the folds down under a search phrase', () => {
    expect(isFoldSuppressed('gładź', NOTHING)).toBe(true)
  })

  // The rule the archived instalment recorded and only search actually kept: a hit inside a folded
  // sekcja is a hit the user is told does not exist, and an unticked filter buries one exactly like a
  // search does.
  it('stands them down under an engaged filter too', () => {
    expect(isFoldSuppressed('', new Set(['no-planned-qty']))).toBe(true)
  })

  it('stands them down for the client‘s own hider, so a shared kosztorys folds the same way', () => {
    expect(isFoldSuppressed('', new Set(['client-empty']))).toBe(true)
  })

  it('leaves them alone under a problem, which reports its own count instead', () => {
    expect(isFoldSuppressed('', new Set(['no-client-price']))).toBe(false)
  })
})
