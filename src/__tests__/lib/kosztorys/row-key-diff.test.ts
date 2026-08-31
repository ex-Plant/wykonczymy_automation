import { describe, expect, it } from 'vitest'
import { firstChangedRowIndex } from '@/lib/kosztorys/row-key-diff'

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
