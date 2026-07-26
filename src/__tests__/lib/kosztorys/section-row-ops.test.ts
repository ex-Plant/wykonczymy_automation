import { describe, expect, it } from 'vitest'
import { applyInsertSectionRow, neighborSectionId, swapSectionBlock } from '@/lib/kosztorys/row-ops'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// The section movers only ever read `id` and `sectionId`, so the rest of the row is irrelevant here.
function row(id: number, sectionId: number): KosztorysV2RowT {
  return { id, sectionId } as KosztorysV2RowT
}

const ids = (rows: KosztorysV2RowT[]) => rows.map((r) => r.id)

// Three tidy blocks: section 1 = [1,2], section 2 = [3,4], section 3 = [5].
const contiguous = [row(1, 1), row(2, 1), row(3, 2), row(4, 2), row(5, 3)]

// The same three sections, but item 2 was added by applyAddItem AFTER the others, so it sits at the
// end of the array instead of next to its block. This is the shape that broke the index-based
// splice: nothing guarantees a section's rows are adjacent.
const nonContiguous = [row(1, 1), row(3, 2), row(4, 2), row(5, 3), row(2, 1)]

describe('neighborSectionId', () => {
  it('reads the section order off the array, ignoring block contiguity', () => {
    expect(neighborSectionId(nonContiguous, 2, 'up')).toBe(1)
    expect(neighborSectionId(nonContiguous, 2, 'down')).toBe(3)
  })

  it('is undefined at either edge and for an unknown section', () => {
    expect(neighborSectionId(contiguous, 1, 'up')).toBeUndefined()
    expect(neighborSectionId(contiguous, 3, 'down')).toBeUndefined()
    expect(neighborSectionId(contiguous, 99, 'up')).toBeUndefined()
  })
})

describe('swapSectionBlock', () => {
  it('exchanges two whole blocks', () => {
    expect(ids(swapSectionBlock(contiguous, 2, 'up'))).toEqual([3, 4, 1, 2, 5])
  })

  it('pulls a stray row back into its block while swapping', () => {
    // Section 1 keeps both its rows even though row 2 lived at the array's end.
    expect(ids(swapSectionBlock(nonContiguous, 2, 'up'))).toEqual([3, 4, 1, 2, 5])
  })

  it('returns the same reference at an edge or for an unknown section', () => {
    expect(swapSectionBlock(contiguous, 1, 'up')).toBe(contiguous)
    expect(swapSectionBlock(contiguous, 3, 'down')).toBe(contiguous)
    expect(swapSectionBlock(contiguous, 99, 'down')).toBe(contiguous)
  })
})

describe('applyInsertSectionRow', () => {
  it('lands the new section just before the anchor section', () => {
    expect(ids(applyInsertSectionRow(contiguous, 2, row(9, 4), 'above'))).toEqual([
      1, 2, 9, 3, 4, 5,
    ])
  })

  it('lands it just after the anchor section', () => {
    expect(ids(applyInsertSectionRow(contiguous, 2, row(9, 4), 'below'))).toEqual([
      1, 2, 3, 4, 9, 5,
    ])
  })

  // The regression: with a stray row at the array end, an index splice put the new section past the
  // wrong block. Going through the block sequence lands it correctly AND regroups section 1.
  it('lands correctly when the anchor section is not contiguous', () => {
    expect(ids(applyInsertSectionRow(nonContiguous, 2, row(9, 4), 'below'))).toEqual([
      1, 2, 3, 4, 9, 5,
    ])
  })

  it('appends when the anchor section is unknown', () => {
    expect(ids(applyInsertSectionRow(contiguous, 99, row(9, 4), 'above'))).toEqual([
      1, 2, 3, 4, 5, 9,
    ])
  })
})
