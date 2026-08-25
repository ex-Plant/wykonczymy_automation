import { describe, expect, it } from 'vitest'

import { sortRows, sortRowsWithinSections } from '@/lib/kosztorys/row-view'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

function row(id: number, sectionId: number, description: string): KosztorysV2RowT {
  return { id, sectionId, description } as KosztorysV2RowT
}

const byDescription = (r: KosztorysV2RowT) => r.description

// One section's rows sort ahead of the other's alphabetically, so a scope that ignores sections and
// one that respects them cannot produce the same answer on this fixture.
const ROWS = [row(1, 10, 'beton'), row(2, 10, 'tynk'), row(3, 20, 'aneks'), row(4, 20, 'sufit')]

describe('sort scope', () => {
  it('orders the whole kosztorys as one list under the global scope', () => {
    expect(sortRows(ROWS, byDescription, 'asc').map((r) => r.id)).toEqual([3, 1, 4, 2])
    expect(sortRows(ROWS, byDescription, 'desc').map((r) => r.id)).toEqual([2, 4, 1, 3])
  })

  it('keeps each section together under the section scope', () => {
    expect(sortRowsWithinSections(ROWS, byDescription, 'asc').map((r) => r.id)).toEqual([
      1, 2, 3, 4,
    ])
    expect(sortRowsWithinSections(ROWS, byDescription, 'desc').map((r) => r.id)).toEqual([
      2, 1, 4, 3,
    ])
  })
})
