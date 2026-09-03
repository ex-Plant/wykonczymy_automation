import { describe, it, expect, vi, beforeEach } from 'vitest'

// The wrapper is the kosztorys plane's only chokepoint (raw SQL bypasses hooks and `access`), so
// three things are asserted: it refuses on a locked investment, it resolves a row id to its
// investment before asking, and it forwards `revalidate`/`opts` untouched — `ownerOnlyAction`, the
// shape this was copied from, drops both, and losing them here would silently kill cache
// invalidation in ~28 actions.
vi.mock('server-only', () => ({}))

const lockState = vi.hoisted(() => ({
  locked: false,
  investmentIdFor: undefined as number | undefined,
}))
const revalidateCollections = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    success: true,
    user: { id: 1, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: vi.fn(async () => ({})),
}))
vi.mock('@/lib/db/get-db', () => ({ getDb: vi.fn(async () => ({ execute: vi.fn() })) }))
vi.mock('@/lib/db/investment-lock', () => ({
  isInvestmentLocked: vi.fn(async () => lockState.locked),
  investmentIdFor: vi.fn(async () => lockState.investmentIdFor),
}))

const { investmentAction } = await import('@/lib/actions/investment-action')
const { INVESTMENT_LOCKED_MESSAGE } = await import('@/lib/constants/investment-lock')
const { isInvestmentLocked } = await import('@/lib/db/investment-lock')

describe('investmentAction', () => {
  beforeEach(() => {
    lockState.locked = false
    lockState.investmentIdFor = 5
    revalidateCollections.mockClear()
    vi.mocked(isInvestmentLocked).mockClear()
  })

  it('runs the handler on an unlocked investment', async () => {
    const handler = vi.fn(async () => ({ success: true as const }))
    const result = await investmentAction('t', { investmentId: 5 }, handler)
    expect(result).toEqual({ success: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('refuses on a locked investment without running the handler', async () => {
    lockState.locked = true
    const handler = vi.fn(async () => ({ success: true as const }))
    const result = await investmentAction('t', { investmentId: 5 }, handler)
    expect(result).toEqual({ success: false, error: INVESTMENT_LOCKED_MESSAGE })
    expect(handler).not.toHaveBeenCalled()
  })

  it('resolves a row id to its investment before checking the lock', async () => {
    lockState.investmentIdFor = 77
    const handler = vi.fn(async () => ({ success: true as const }))
    await investmentAction('t', { kind: 'item', id: 3 }, handler)
    expect(vi.mocked(isInvestmentLocked).mock.calls[0]?.[1]).toBe(77)
  })

  it('reports a row that does not exist instead of silently allowing the write', async () => {
    lockState.investmentIdFor = undefined
    const handler = vi.fn(async () => ({ success: true as const }))
    const result = await investmentAction('t', { kind: 'section', id: 3 }, handler)
    expect(result).toEqual({ success: false, error: 'Sekcja nie istnieje.' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('forwards revalidate and opts to protectedAction', async () => {
    await investmentAction(
      't',
      { investmentId: 5 },
      async () => ({ success: true }),
      ['kosztorysItems'],
      { deferRefresh: true },
    )
    expect(revalidateCollections).toHaveBeenCalledWith(['kosztorysItems'], { deferRefresh: true })
  })

  it('does not revalidate when the lock refuses', async () => {
    lockState.locked = true
    await investmentAction('t', { investmentId: 5 }, async () => ({ success: true }), [
      'kosztorysItems',
    ])
    expect(revalidateCollections).not.toHaveBeenCalled()
  })
})
