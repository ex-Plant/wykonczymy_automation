import { describe, expect, it } from 'vitest'

import { planSectionRenumber } from '@/lib/kosztorys/display-order-plan'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

function row(
  id: number,
  sectionId: number,
  displayOrder: number,
  description: string,
): KosztorysV2RowT {
  return { id, sectionId, displayOrder, description } as KosztorysV2RowT
}

const byDescription = (r: KosztorysV2RowT) => r.description

// Section 10's stored order (0,1,2) is deliberately NOT alphabetical, and section 20 sits between
// them in the array so a plan that ignored sectionId would show up.
const ROWS = [
  row(1, 10, 0, 'tynk'),
  row(2, 10, 1, 'malowanie'),
  row(3, 20, 0, 'parapet'),
  row(4, 10, 2, 'gruntowanie'),
]

describe('planSectionRenumber', () => {
  it('assigns 0…n-1 in the sort order', () => {
    const { after } = planSectionRenumber(ROWS, 10, byDescription, 'asc')

    expect(after).toEqual([
      { id: 4, displayOrder: 0 },
      { id: 2, displayOrder: 1 },
      { id: 1, displayOrder: 2 },
    ])
  })

  it('touches only the named section', () => {
    const { before, after } = planSectionRenumber(ROWS, 10, byDescription, 'asc')

    expect([...before, ...after].every((ref) => ref.id !== 3)).toBe(true)
  })

  // The write is what undo replays, so `before` has to carry the stored indices — including the
  // gaps a delete leaves behind, which renumbering to 0…n-1 would silently close.
  it('reports the stored order as before, gaps and all', () => {
    const gapped = [row(1, 10, 0, 'b'), row(2, 10, 7, 'a')]

    expect(planSectionRenumber(gapped, 10, byDescription, 'asc').before).toEqual([
      { id: 1, displayOrder: 0 },
      { id: 2, displayOrder: 7 },
    ])
  })

  it('covers every row of the section, not just the ones a filter left visible', () => {
    const { after } = planSectionRenumber(ROWS, 10, byDescription, 'asc')

    expect(after.map((ref) => ref.id).sort()).toEqual([1, 2, 4])
  })

  it('reverses under desc', () => {
    const { after } = planSectionRenumber(ROWS, 10, byDescription, 'desc')

    expect(after.map((ref) => ref.id)).toEqual([1, 2, 4])
  })

  it('returns empty plans for a section with no rows', () => {
    expect(planSectionRenumber(ROWS, 99, byDescription, 'asc')).toEqual({ before: [], after: [] })
  })
})
