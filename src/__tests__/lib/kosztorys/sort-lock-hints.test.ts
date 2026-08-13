import { describe, expect, it } from 'vitest'

import { persistOrderBlockReason, reorderLockHint } from '@/lib/kosztorys/sort-lock-hints'

describe('persistOrderBlockReason', () => {
  it('allows the bake only under a section-scoped sort', () => {
    expect(persistOrderBlockReason('section')).toBeUndefined()
  })

  it('blocks the bake under a global sort, naming the way out', () => {
    const reason = persistOrderBlockReason('global')
    expect(reason).toBeDefined()
    expect(reason).toContain('w sekcjach')
  })

  it('blocks the bake with no sort at all', () => {
    expect(persistOrderBlockReason(null)).toBeDefined()
  })
})

describe('reorderLockHint', () => {
  it('has nothing to say without a sort — ▲▼ and „Wstaw" are live', () => {
    expect(reorderLockHint(null)).toBeUndefined()
  })

  it('explains the lock under either scope, differing on the escape route', () => {
    const section = reorderLockHint('section')
    const global = reorderLockHint('global')
    expect(section).toContain('Utrwal kolejność')
    expect(global).toContain('w całym kosztorysie')
    expect(section).not.toBe(global)
  })
})
