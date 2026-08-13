import { describe, expect, it } from 'vitest'

import { planKosztorysRenumber } from '@/lib/kosztorys/display-order-plan'
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

describe('planKosztorysRenumber', () => {
  it('restarts the numbering in every section', () => {
    const { after } = planKosztorysRenumber(ROWS, byDescription, 'asc')

    expect(after).toEqual([
      { id: 4, displayOrder: 0 },
      { id: 2, displayOrder: 1 },
      { id: 1, displayOrder: 2 },
      { id: 3, displayOrder: 0 },
    ])
  })

  it('covers every row exactly once', () => {
    const { before, after } = planKosztorysRenumber(ROWS, byDescription, 'asc')

    expect(after.map((ref) => ref.id).sort()).toEqual([1, 2, 3, 4])
    expect(before.map((ref) => ref.id).sort()).toEqual([1, 2, 3, 4])
  })

  // What undo replays, so it must be the stored indices — gaps included.
  it('reports the stored order as before', () => {
    const { before } = planKosztorysRenumber(ROWS, byDescription, 'asc')

    expect(before).toEqual([
      { id: 1, displayOrder: 0 },
      { id: 2, displayOrder: 1 },
      { id: 4, displayOrder: 2 },
      { id: 3, displayOrder: 0 },
    ])
  })

  // Renumbering to 0…n-1 would silently close the gaps a delete left behind, and undo replays
  // `before` verbatim.
  it('keeps the gaps a delete left in before', () => {
    const gapped = [row(1, 10, 0, 'b'), row(2, 10, 7, 'a')]

    expect(planKosztorysRenumber(gapped, byDescription, 'asc').before).toEqual([
      { id: 1, displayOrder: 0 },
      { id: 2, displayOrder: 7 },
    ])
  })

  it('reverses under desc', () => {
    const { after } = planKosztorysRenumber(ROWS, byDescription, 'desc')

    expect(after).toEqual([
      { id: 1, displayOrder: 0 },
      { id: 2, displayOrder: 1 },
      { id: 4, displayOrder: 2 },
      { id: 3, displayOrder: 0 },
    ])
  })
})
