import { describe, expect, it } from 'vitest'
import { firstChangedHeightIndex, firstChangedRowIndex } from '@/lib/kosztorys/row-key-diff'

describe('firstChangedRowIndex', () => {
  it('reports no change for identical row sets', () => {
    expect(firstChangedRowIndex(['a', 'b', 'c'], ['a', 'b', 'c'])).toBeNull()
  })

  it('reports the insertion point when a row lands mid-list', () => {
    expect(firstChangedRowIndex(['a', 'b', 'c'], ['a', 'x', 'b', 'c'])).toBe(1)
  })

  it('reports the deletion point when a row is removed mid-list', () => {
    expect(firstChangedRowIndex(['a', 'b', 'c'], ['a', 'c'])).toBe(1)
  })

  it('reports the tail when rows are appended', () => {
    expect(firstChangedRowIndex(['a', 'b'], ['a', 'b', 'c'])).toBe(2)
  })

  it('reports the tail when trailing rows are dropped', () => {
    expect(firstChangedRowIndex(['a', 'b', 'c'], ['a', 'b'])).toBe(2)
  })

  it('reports the first index of a reorder', () => {
    expect(firstChangedRowIndex(['a', 'b', 'c'], ['a', 'c', 'b'])).toBe(1)
  })

  it('reports index 0 when the list is replaced wholesale', () => {
    expect(firstChangedRowIndex(['a', 'b'], ['x', 'y'])).toBe(0)
  })

  it('treats a first load as no change — nothing was measured yet', () => {
    expect(firstChangedRowIndex([], [])).toBeNull()
  })

  it('reports the tail when the first rows arrive', () => {
    expect(firstChangedRowIndex([], ['a', 'b'])).toBe(0)
  })
})

describe('firstChangedHeightIndex', () => {
  const rowKeys = ['-1001', '10', '11', '12']

  it('is null when nothing moved', () => {
    expect(firstChangedHeightIndex({ '10': 52 }, { '10': 52 }, rowKeys)).toBeNull()
  })

  it('points at the dragged row, not at the top of the grid', () => {
    expect(firstChangedHeightIndex({}, { '12': 72 }, rowKeys)).toBe(3)
  })

  it('takes the earliest row when several heights changed at once', () => {
    expect(firstChangedHeightIndex({ '11': 52 }, { '12': 72 }, rowKeys)).toBe(2)
  })

  it('reports a dropped height, not only an added one', () => {
    expect(firstChangedHeightIndex({ '11': 92 }, {}, rowKeys)).toBe(2)
  })

  it('ignores a height for a row this view does not render', () => {
    // The header's own entry lives in the same map, and a filtered-out pozycja keeps its height.
    expect(firstChangedHeightIndex({}, { header: 96, '999': 52 }, rowKeys)).toBeNull()
  })
})
