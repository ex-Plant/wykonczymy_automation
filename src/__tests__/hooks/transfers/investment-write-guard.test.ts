import { describe, it, expect } from 'vitest'
import { validateTransfer } from '@/hooks/transfers/validate'

// „Inna wpłata" and „Zasilenie z konta firmowego" are company-level cash. Both bucket as
// income, so an investment on either would raise that investment's bilans with money the
// client never paid (EX-557). The forms hide the picker, but the admin panel, the REST/
// GraphQL API and any script write straight through the hook — this pins the hook itself,
// which is the last gate before the row lands.

const base = { amount: 100, date: '2026-02-19', paymentMethod: 'CASH' }

function hookArgs(
  data: Record<string, unknown>,
  opts: { operation?: 'create' | 'update'; originalDoc?: Record<string, unknown> } = {},
) {
  const { operation = 'create', originalDoc } = opts
  return {
    data,
    operation,
    req: { user: null },
    originalDoc,
    collection: undefined,
    context: {},
  } as unknown as Parameters<typeof validateTransfer>[0]
}

const investmentAfter = (
  data: Record<string, unknown>,
  opts?: { operation?: 'create' | 'update'; originalDoc?: Record<string, unknown> },
) => (validateTransfer(hookArgs(data, opts)) as Record<string, unknown>).investment

describe('investment write guard — types that may never carry an investment', () => {
  const CLEARED = {
    OTHER_DEPOSIT: { ...base, type: 'OTHER_DEPOSIT', sourceRegister: 1 },
    COMPANY_FUNDING: { ...base, type: 'COMPANY_FUNDING', sourceRegister: 1 },
    OTHER: { ...base, type: 'OTHER', sourceRegister: 1, otherCategory: 1 },
    REGISTER_TRANSFER: { ...base, type: 'REGISTER_TRANSFER', sourceRegister: 1, targetRegister: 2 },
  }

  for (const [type, data] of Object.entries(CLEARED)) {
    it(`${type} — a create carrying an investment is cleared`, () => {
      expect(investmentAfter({ ...data, investment: 7 })).toBeNull()
    })

    it(`${type} — an update carrying an investment is cleared`, () => {
      expect(
        investmentAfter(
          { ...data, investment: 7 },
          { operation: 'update', originalDoc: { ...data, id: 1 } },
        ),
      ).toBeNull()
    })

    // An update that carries no `type` of its own falls back to the stored one, so the
    // clear must still fire rather than reading `''` and skipping.
    it(`${type} — an update with no type of its own still clears`, () => {
      const { type: _stored, ...withoutType } = data
      expect(
        investmentAfter(
          { ...withoutType, investment: 7 },
          { operation: 'update', originalDoc: { ...data, id: 1 } },
        ),
      ).toBeNull()
    })
  }
})

describe('investment write guard — INVESTOR_DEPOSIT is the one deposit that keeps it', () => {
  const investorDeposit = {
    ...base,
    type: 'INVESTOR_DEPOSIT',
    sourceRegister: 1,
    investment: 7,
  }

  it('a create keeps the investment', () => {
    expect(investmentAfter(investorDeposit)).toBe(7)
  })

  it('an update keeps the investment', () => {
    expect(
      investmentAfter(investorDeposit, {
        operation: 'update',
        originalDoc: { ...investorDeposit, id: 1 },
      }),
    ).toBe(7)
  })
})
