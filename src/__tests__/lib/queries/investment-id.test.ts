import { describe, expect, it, vi } from 'vitest'

// Only `notFound()` — the module is otherwise pure, which is why it was split out of investments.ts
// (that one top-level-imports the whole server graph and forced this spec to stub it).
vi.mock('next/navigation', () => ({ notFound: vi.fn() }))

const { isInvestmentId } = await import('@/lib/queries/investment-id')

// The rule had drifted: the @investmentCrumb slot re-inlined it as /^\d+$/, which disagrees with
// parseInvestmentId on both ends. These two cases are the disagreement — they are why the predicate
// was extracted rather than the regex left alone.
describe('isInvestmentId — the cases the re-inlined /^\\d+$/ got wrong', () => {
  it('accepts a zero-padded id (the regex accepted it too, but Number() is what the query uses)', () => {
    expect(isInvestmentId('07')).toBe(true)
  })

  it('rejects "0" — there is no investment 0, and the regex let it through', () => {
    expect(isInvestmentId('0')).toBe(false)
  })
})

describe('isInvestmentId', () => {
  it.each(['1', '42', '999999'])('accepts %s', (id) => {
    expect(isInvestmentId(id)).toBe(true)
  })

  it.each(['', '  ', 'abc', '1a', '-1', '1.5e400', 'NaN', 'Infinity'])('rejects %j', (id) => {
    expect(isInvestmentId(id)).toBe(false)
  })
})
