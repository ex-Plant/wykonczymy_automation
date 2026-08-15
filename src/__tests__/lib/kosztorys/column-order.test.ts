import { describe, expect, it } from 'vitest'
import {
  baseRanksFromKeys,
  orderColumnKeys,
  orderColumns,
  placeMovables,
  rankForMove,
} from '@/lib/kosztorys/column-order'

// Assemble order as the grid builds it: actions leads, „Rozjazd" sits BEFORE the identity column.
const KEYS = ['actions', 'divergence', 'description', 'plannedQty', 'stages', 'price', 'net']
const MOVABLE = KEYS.filter((key) => key !== 'actions' && key !== 'description')

function movableOrder(ranks: Record<string, number>): string[] {
  return orderColumnKeys(KEYS, ranks).filter((key) => key !== 'actions' && key !== 'description')
}

describe('orderColumnKeys', () => {
  it('leaves the assemble order untouched when no rank was stored', () => {
    expect(orderColumnKeys(KEYS, {})).toEqual(KEYS)
  })

  it('keeps the anchors on their assemble slots however they are ranked', () => {
    const ordered = orderColumnKeys(KEYS, { actions: 99, description: -99, price: -5 })
    expect(ordered.indexOf('actions')).toBe(0)
    expect(ordered.indexOf('description')).toBe(2)
    // The ranked movable key still took the first movable slot.
    expect(ordered[1]).toBe('price')
  })

  it('ignores a rank for a key that is not in the list', () => {
    expect(orderColumnKeys(KEYS, { gross: -100 })).toEqual(KEYS)
  })

  it('sorts by stored rank, falling back to the assemble index', () => {
    // divergence assembles at index 1, so a rank of 0.5 lifts „net" past it to the front.
    expect(movableOrder({ net: 0.5 })).toEqual([
      'net',
      'divergence',
      'plannedQty',
      'stages',
      'price',
    ])
  })
})

describe('rankForMove', () => {
  const baseRanks = baseRanksFromKeys(KEYS)

  // The round-trip that matters: whatever rank a drop computes must actually place the key there.
  it.each([0, 1, 2, 3, 4])('places the moved key at index %i', (toIndex) => {
    const rank = rankForMove(MOVABLE, 'price', toIndex, {}, baseRanks)
    const ordered = movableOrder({ price: rank })
    expect(ordered.indexOf('price')).toBe(toIndex)
  })

  it('round-trips a second move against the ranks written by the first', () => {
    const first = rankForMove(MOVABLE, 'price', 0, {}, baseRanks)
    const afterFirst = movableOrder({ price: first })
    const second = rankForMove(afterFirst, 'net', 1, { price: first }, baseRanks)
    expect(movableOrder({ price: first, net: second })).toEqual([
      'price',
      'net',
      'divergence',
      'plannedQty',
      'stages',
    ])
  })

  it('leaves a single-key list alone', () => {
    expect(rankForMove(['price'], 'price', 0, {}, baseRanks)).toBe(baseRanks.price)
  })
})

describe('placeMovables', () => {
  // The one function the grid and the reorder window share: whatever the window draws, the grid must
  // build. Anchors hold their assemble slot; the dragged list fills what is left, in its own order.
  it('drops the movable order into the non-anchored slots', () => {
    expect(placeMovables(KEYS, ['price', 'net', 'divergence', 'plannedQty', 'stages'])).toEqual([
      'actions',
      'price',
      'description',
      'net',
      'divergence',
      'plannedQty',
      'stages',
    ])
  })

  it('reproduces the grid order it was extracted from', () => {
    expect(placeMovables(KEYS, movableOrder({ net: 0.5 }))).toEqual(
      orderColumnKeys(KEYS, { net: 0.5 }),
    )
  })
})

describe('orderColumns', () => {
  // Stage columns carry per-stage ids and answer to one group key — they have to travel as a block.
  const toKey = (id: string) => (id.startsWith('stage_') ? 'stages' : id)
  const columns = [
    { id: 'actions' },
    { id: 'description' },
    { id: 'stage_1' },
    { id: 'stage_2' },
    { id: 'price' },
  ]

  it('moves a stage group as one block, keeping its internal order', () => {
    expect(orderColumns(columns, { stages: 99 }, toKey).map((column) => column.id)).toEqual([
      'actions',
      'description',
      'price',
      'stage_1',
      'stage_2',
    ])
  })

  it('is a no-op without stored ranks', () => {
    expect(orderColumns(columns, {}, toKey)).toEqual(columns)
  })
})
