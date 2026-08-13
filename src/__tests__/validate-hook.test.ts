import { describe, it, expect } from 'vitest'
import { validateTransfer } from '@/hooks/transfers/validate'

// ── Mock factory ────────────────────────────────────────────────────────

/** Build a minimal Payload hook args object for validateTransfer. */
function hookArgs(
  data: Record<string, unknown>,
  opts: {
    operation?: 'create' | 'update'
    userId?: number
    originalDoc?: Record<string, unknown>
  } = {},
) {
  const { operation = 'create', userId, originalDoc } = opts
  return {
    data,
    operation,
    req: userId ? { user: { id: userId } } : { user: null },
    originalDoc,
    collection: undefined,
    context: {},
  } as unknown as Parameters<typeof validateTransfer>[0]
}

/** Base valid transfer data — override per type. */
const base = {
  amount: 100,
  date: '2026-02-19',
  paymentMethod: 'CASH',
}

const VALID_DATA: Record<string, Record<string, unknown>> = {
  INVESTOR_DEPOSIT: { ...base, type: 'INVESTOR_DEPOSIT', sourceRegister: 1, investment: 1 },
  COMPANY_FUNDING: { ...base, type: 'COMPANY_FUNDING', sourceRegister: 1 },
  OTHER_DEPOSIT: { ...base, type: 'OTHER_DEPOSIT', sourceRegister: 1 },
  INVESTMENT_EXPENSE: {
    ...base,
    type: 'INVESTMENT_EXPENSE',
    sourceRegister: 1,
    investment: 1,
    expenseCategory: 1,
  },
  INVESTMENT_EXPENSE_NET: {
    ...base,
    type: 'INVESTMENT_EXPENSE_NET',
    sourceRegister: 1,
    investment: 1,
    expenseCategory: 1,
    netAmount: 80,
  },
  LABOR_COST: { ...base, type: 'LABOR_COST', investment: 1 },
  LOSS: { ...base, type: 'LOSS', investment: 1 },
  REGISTER_TRANSFER: { ...base, type: 'REGISTER_TRANSFER', sourceRegister: 1, targetRegister: 2 },
  OTHER: { ...base, type: 'OTHER', sourceRegister: 1, otherCategory: 1 },
}

// ═══════════════════════════════════════════════════════════════════════
// All types with valid data → passes
// ═══════════════════════════════════════════════════════════════════════

describe('validateTransfer — all types valid', () => {
  for (const [type, data] of Object.entries(VALID_DATA)) {
    it(`${type} — does not throw`, () => {
      expect(() => validateTransfer(hookArgs({ ...data }))).not.toThrow()
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════
// Missing required fields per type → throws
// ═══════════════════════════════════════════════════════════════════════

describe('validateTransfer — missing required fields', () => {
  it('INVESTOR_DEPOSIT without sourceRegister → throws', () => {
    const { sourceRegister, ...data } = VALID_DATA.INVESTOR_DEPOSIT
    expect(() => validateTransfer(hookArgs(data))).toThrow(/[Cc]ash register/)
  })

  it('INVESTOR_DEPOSIT without investment → throws', () => {
    const { investment, ...data } = VALID_DATA.INVESTOR_DEPOSIT
    expect(() => validateTransfer(hookArgs(data))).toThrow(/[Ii]nvestment/)
  })

  it('COMPANY_FUNDING without sourceRegister → throws', () => {
    const { sourceRegister, ...data } = VALID_DATA.COMPANY_FUNDING
    expect(() => validateTransfer(hookArgs(data))).toThrow(/[Cc]ash register/)
  })

  it('OTHER_DEPOSIT without sourceRegister → throws', () => {
    const { sourceRegister, ...data } = VALID_DATA.OTHER_DEPOSIT
    expect(() => validateTransfer(hookArgs(data))).toThrow(/[Cc]ash register/)
  })

  it('INVESTMENT_EXPENSE without sourceRegister → throws', () => {
    const { sourceRegister, ...data } = VALID_DATA.INVESTMENT_EXPENSE
    expect(() => validateTransfer(hookArgs(data))).toThrow(/[Cc]ash register/)
  })

  it('INVESTMENT_EXPENSE without investment → throws', () => {
    const { investment, ...data } = VALID_DATA.INVESTMENT_EXPENSE
    expect(() => validateTransfer(hookArgs(data))).toThrow(/[Ii]nvestment/)
  })

  it('LABOR_COST without investment → throws', () => {
    const { investment, ...data } = VALID_DATA.LABOR_COST
    expect(() => validateTransfer(hookArgs(data))).toThrow(/[Ii]nvestment/)
  })

  // EX-675: a strata now lowers the investor's bilans, so it has to say whose.
  it('LOSS without investment → throws', () => {
    const { investment, ...data } = VALID_DATA.LOSS
    void investment
    expect(() => validateTransfer(hookArgs(data))).toThrow(/[Ii]nvestment/)
  })

  it('REGISTER_TRANSFER without sourceRegister → throws', () => {
    const { sourceRegister, ...data } = VALID_DATA.REGISTER_TRANSFER
    expect(() => validateTransfer(hookArgs(data))).toThrow(/[Cc]ash register/)
  })

  it('REGISTER_TRANSFER without targetRegister → throws', () => {
    const { targetRegister, ...data } = VALID_DATA.REGISTER_TRANSFER
    expect(() => validateTransfer(hookArgs(data))).toThrow(/[Tt]arget register/)
  })

  it('OTHER without sourceRegister → throws', () => {
    const { sourceRegister, ...data } = VALID_DATA.OTHER
    expect(() => validateTransfer(hookArgs(data))).toThrow(/[Cc]ash register/)
  })

  it('OTHER without otherCategory → throws', () => {
    const { otherCategory, ...data } = VALID_DATA.OTHER
    expect(() => validateTransfer(hookArgs(data))).toThrow(/[Cc]ategory/)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Auto-clear behavior
// ═══════════════════════════════════════════════════════════════════════

describe('validateTransfer — auto-clear behavior', () => {
  it('LABOR_COST → sourceRegister set to null', () => {
    const data = { ...VALID_DATA.LABOR_COST, sourceRegister: 5 }
    const result = validateTransfer(hookArgs(data))
    expect(result.sourceRegister).toBeNull()
  })

  // An investment-linked OTHER reaches no deriveFinancials bucket, yet still leaves the
  // register — cash and margin silently diverge. The form never offers the field
  // (showsInvestment), so only a script or the API can plant one.
  it('OTHER → investment set to null', () => {
    const data = { ...VALID_DATA.OTHER, investment: 31 }
    const result = validateTransfer(hookArgs(data))
    expect(result.investment).toBeNull()
  })

  it('REGISTER_TRANSFER → investment set to null', () => {
    const data = { ...VALID_DATA.REGISTER_TRANSFER, investment: 31 }
    const result = validateTransfer(hookArgs(data))
    expect(result.investment).toBeNull()
  })

  it('INVESTMENT_EXPENSE → investment preserved', () => {
    const result = validateTransfer(hookArgs(VALID_DATA.INVESTMENT_EXPENSE))
    expect(result.investment).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Expense category validation
// ═══════════════════════════════════════════════════════════════════════

describe('validateTransfer — expenseCategory', () => {
  it('INVESTMENT_EXPENSE without expenseCategory → throws', () => {
    const data = { ...VALID_DATA.INVESTMENT_EXPENSE, expenseCategory: undefined }
    expect(() => validateTransfer(hookArgs(data))).toThrow(/[Ee]xpense category/)
  })

  it('INVESTMENT_EXPENSE with expenseCategory → passes', () => {
    const data = { ...VALID_DATA.INVESTMENT_EXPENSE, expenseCategory: 1 }
    expect(() => validateTransfer(hookArgs(data))).not.toThrow()
  })

  it('CORRECTION with an investment but no expenseCategory → throws', () => {
    const data = { ...base, amount: -100, type: 'CORRECTION', sourceRegister: 1, investment: 1 }
    expect(() => validateTransfer(hookArgs(data))).toThrow(/[Ee]xpense category/)
  })

  it('CORRECTION with an investment + expenseCategory → passes', () => {
    const data = {
      ...base,
      amount: -100,
      type: 'CORRECTION',
      sourceRegister: 1,
      investment: 1,
      expenseCategory: 1,
    }
    expect(() => validateTransfer(hookArgs(data))).not.toThrow()
  })

  it('CORRECTION with NO investment and no expenseCategory → passes (type not required)', () => {
    const data = { ...base, amount: -100, type: 'CORRECTION', sourceRegister: 1 }
    expect(() => validateTransfer(hookArgs(data))).not.toThrow()
  })
})

// ═══════════════════════════════════════════════════════════════════════
// REGISTER_TRANSFER — same register check
// ═══════════════════════════════════════════════════════════════════════

describe('validateTransfer — REGISTER_TRANSFER', () => {
  it('targetRegister === sourceRegister → throws', () => {
    const data = { ...base, type: 'REGISTER_TRANSFER', sourceRegister: 1, targetRegister: 1 }
    expect(() => validateTransfer(hookArgs(data))).toThrow(/[Tt]arget register must be different/)
  })

  it('different registers → passes', () => {
    const data = { ...base, type: 'REGISTER_TRANSFER', sourceRegister: 1, targetRegister: 2 }
    expect(() => validateTransfer(hookArgs(data))).not.toThrow()
  })
})

// ═══════════════════════════════════════════════════════════════════════
// createdBy auto-set
// ═══════════════════════════════════════════════════════════════════════

describe('validateTransfer — createdBy auto-set', () => {
  it('operation=create with user → createdBy is set', () => {
    const data = { ...VALID_DATA.COMPANY_FUNDING }
    const result = validateTransfer(hookArgs(data, { operation: 'create', userId: 42 }))
    expect(result.createdBy).toBe(42)
  })

  it('operation=update → createdBy NOT overwritten', () => {
    const data = { ...VALID_DATA.COMPANY_FUNDING, createdBy: 10 }
    const result = validateTransfer(hookArgs(data, { operation: 'update', userId: 42 }))
    expect(result.createdBy).toBe(10)
  })

  it('operation=create without user → createdBy not set', () => {
    const data = { ...VALID_DATA.COMPANY_FUNDING }
    const result = validateTransfer(hookArgs(data, { operation: 'create' }))
    expect(result.createdBy).toBeUndefined()
  })
})

describe('validateTransfer — a CANCELLATION never keeps a register', () => {
  // EX-573 review gate. The spec table says a cancellation needs no register, but that
  // answer only reached the admin panel's field condition: the blanket early return below
  // skipped the auto-clear, so a REST/Local-API write could persist source_register_id on
  // a cancellation. sumRegisterBalance has no CANCELLATION arm — the row falls into
  // `ELSE -amount` and drains that register permanently, with nothing surfacing the cause.
  it('strips a sourceRegister smuggled in past the early return', () => {
    const data = {
      type: 'CANCELLATION',
      amount: 100,
      date: '2026-07-25',
      cancelledTransaction: 42,
      sourceRegister: 3,
    }
    const result = validateTransfer(hookArgs(data, { operation: 'create' }))
    expect(result.sourceRegister).toBeNull()
  })

  it('still refuses a cancellation with no original to point at', () => {
    const data = { type: 'CANCELLATION', amount: 100, date: '2026-07-25' }
    expect(() => validateTransfer(hookArgs(data, { operation: 'create' }))).toThrow(
      /Cancelled transaction reference is required/,
    )
  })
})

// EX-675. A PATCH of one field carries no relational fields at all, so every "required" check
// below must read through to the stored row or an invoice attachment would be rejected for a
// missing investment the row has had all along.
describe('validateTransfer — a partial update reads required fields from the stored row', () => {
  const storedExpense = {
    type: 'INVESTMENT_EXPENSE',
    amount: 222.88,
    date: '2026-02-19',
    investment: 62,
    expenseCategory: 4,
    sourceRegister: 1,
  }

  it('accepts an invoice-only PATCH on a row that already has its investment', () => {
    const args = hookArgs({ invoice: 5 }, { operation: 'update', originalDoc: storedExpense })
    expect(() => validateTransfer(args)).not.toThrow()
  })

  // The type that made the investment mandatory in the first place — attaching a faktura to an
  // existing strata must not re-litigate a link the row already carries.
  it('accepts an invoice-only PATCH on a stored LOSS', () => {
    const storedLoss = { type: 'LOSS', amount: 1000, date: '2026-02-19', investment: 62 }
    const args = hookArgs({ invoice: 5 }, { operation: 'update', originalDoc: storedLoss })
    expect(() => validateTransfer(args)).not.toThrow()
  })

  it('still refuses when neither the payload nor the stored row carries an investment', () => {
    const { investment, ...orphan } = storedExpense
    void investment
    const args = hookArgs({ invoice: 5 }, { operation: 'update', originalDoc: orphan })
    expect(() => validateTransfer(args)).toThrow(/[Ii]nvestment/)
  })
})

// GUARD B7 — the netto figure is what the investor is billed, and the hook is the single server-side
// authority on it (the form schema is a convenience mirror the API can bypass entirely).
describe('validateTransfer — netAmount (the netto expense type)', () => {
  const netExpense = VALID_DATA.INVESTMENT_EXPENSE_NET

  it('refuses a netto above the brutto that left the kasa', () => {
    const data = { ...netExpense, amount: 100, netAmount: 101 }
    expect(() => validateTransfer(hookArgs(data))).toThrow(
      /Kwota netto nie może przekraczać kwoty brutto/,
    )
  })

  it('accepts a netto equal to brutto (0% VAT is a real case)', () => {
    const data = { ...netExpense, amount: 100, netAmount: 100 }
    expect(() => validateTransfer(hookArgs(data))).not.toThrow()
  })

  it('refuses a missing netto — deriveFinancials would bill 0, never brutto', () => {
    const { netAmount, ...data } = netExpense
    void netAmount
    expect(() => validateTransfer(hookArgs(data))).toThrow(/Kwota netto jest wymagana/)
  })

  it('refuses a non-positive netto', () => {
    expect(() => validateTransfer(hookArgs({ ...netExpense, netAmount: 0 }))).toThrow(
      /Kwota netto musi być większa niż 0/,
    )
  })

  it('strips a netAmount smuggled onto a brutto-billed type', () => {
    const data = { ...VALID_DATA.INVESTMENT_EXPENSE, netAmount: 80 }
    expect(validateTransfer(hookArgs(data)).netAmount).toBeNull()
  })

  // A partial update sends only the changed field; the rule must still compare against the stored
  // twin, or raising just `netAmount` past the stored brutto would sail through.
  it('compares a partial update against the stored amount', () => {
    const args = hookArgs(
      { type: 'INVESTMENT_EXPENSE_NET', netAmount: 5000 },
      { operation: 'update', originalDoc: { ...netExpense, amount: 1230, netAmount: 1000 } },
    )
    expect(() => validateTransfer(args)).toThrow(/Kwota netto nie może przekraczać kwoty brutto/)
  })
})
