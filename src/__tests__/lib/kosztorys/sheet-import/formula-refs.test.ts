import { describe, expect, it } from 'vitest'
import { referencesAnyColumn, referencesColumn } from '@/lib/kosztorys/sheet-import/formula-refs'

const D = 3
const M = 12
const N = 13
const R = 17

describe('referencesColumn', () => {
  it('matches a cell of that column, anchored or not', () => {
    expect(referencesColumn(N)('=N72')).toBe(true)
    expect(referencesColumn(N)('=$N$72')).toBe(true)
  })

  it('matches a whole-column range, which carries no row number at all', () => {
    expect(referencesColumn(D)('=SUM(D:M)')).toBe(true)
    expect(referencesColumn(D)('=SUM(D : M)')).toBe(true)
  })

  it('does not match its letter inside a two-letter column', () => {
    expect(referencesColumn(R)('=AR12*2')).toBe(false)
  })

  it('is not fooled by a value that merely looks like a formula', () => {
    expect(referencesColumn(N)('N72')).toBe(false)
    expect(referencesColumn(N)(72)).toBe(false)
    expect(referencesColumn(N)(null)).toBe(false)
  })
})

describe('referencesAnyColumn', () => {
  const readsStages = referencesAnyColumn([D, D + 1, D + 2, M])

  it('recognises the stage sum in both of the shapes the sheets write it', () => {
    expect(readsStages('=SUM(D5:M5)')).toBe(true)
    expect(readsStages('=SUM(D:M)')).toBe(true)
    expect(readsStages('=D5+E5')).toBe(true)
  })

  it('lets through a formula that reaches nowhere near the etapy', () => {
    expect(readsStages('=N72')).toBe(false)
    expect(readsStages('=2,5+3')).toBe(false)
  })

  it('answers false when there are no columns to reference', () => {
    expect(referencesAnyColumn([])('=SUM(D5:M5)')).toBe(false)
  })
})
