import { describe, it, expect } from 'vitest'
import * as transfersModule from '@/lib/constants/transfers'
import {
  TRANSFER_TYPES,
  TRANSFER_TYPE_LABELS,
  TRANSFER_TYPE_COLORS,
  TRANSACTION_TRANSFER_TYPES,
  DEPOSIT_TYPES,
  DEPOSIT_UI_TYPES,
  EXPENSES_TAB_TYPES,
  SHEET_TRANSFER_TAB_TYPES,
  TRANSFERS_SUMMARY_TYPES,
  isTransferType,
  isDepositType,
  needsSourceRegister,
  showsInvestment,
  requiresInvestment,
  needsTargetRegister,
  needsWorker,
  needsOtherCategory,
  showsOtherCategory,
  needsExpenseCategory,
  isSheetTransferTabType,
  isExpensesTabType,
  billsNetAmount,
  canBeSettled,
  isLaborCost,
  isCancellationType,
} from '@/lib/constants/transfers'

// CHARACTERIZATION SUITE (EX-573 phase 0). Everything here is pinned against the
// implementation as it stands BEFORE the spec-table rewrite. A test authored after the
// rewrite proves nothing about behaviour preservation, so these expectations are written
// as hand-typed literals — never derived from the same arrays they guard, which would
// make them tautologically green.

type HelperFn = (type: string) => boolean

// ── Truth table: every predicate × every type ───────────────────────────

const HELPERS: Record<string, { fn: HelperFn; trueFor: string[] }> = {
  isTransferType: {
    fn: isTransferType,
    trueFor: [...TRANSFER_TYPES],
  },
  isDepositType: {
    fn: isDepositType,
    trueFor: ['INVESTOR_DEPOSIT', 'COMPANY_FUNDING', 'OTHER_DEPOSIT'],
  },
  needsSourceRegister: {
    fn: needsSourceRegister,
    // Everything except the three P&L figures with no cash movement, plus CANCELLATION.
    // CANCELLATION was in this list until EX-573 phase 3 — a DELIBERATE behaviour change,
    // not a drift: a cancellation annotates the row it reverses and moves no cash of its
    // own, so offering it a „Kasa" picker only opened a path to draining that register.
    trueFor: [
      'OTHER_DEPOSIT',
      'OTHER',
      'CORRECTION',
      'REGISTER_TRANSFER',
      'INVESTOR_DEPOSIT',
      'INVESTMENT_EXPENSE',
      'INVESTMENT_EXPENSE_NET',
      'PAYOUT',
      'COMPANY_FUNDING',
    ],
  },
  showsInvestment: {
    fn: showsInvestment,
    trueFor: [
      'INVESTOR_DEPOSIT',
      'INVESTMENT_EXPENSE',
      'INVESTMENT_EXPENSE_NET',
      'LABOR_COST',
      'CORRECTION',
      'PAYOUT',
      'RABAT',
      'LOSS',
    ],
  },
  requiresInvestment: {
    fn: requiresInvestment,
    trueFor: [
      'INVESTOR_DEPOSIT',
      'INVESTMENT_EXPENSE',
      'INVESTMENT_EXPENSE_NET',
      'LABOR_COST',
      'RABAT',
    ],
  },
  needsTargetRegister: {
    fn: needsTargetRegister,
    trueFor: ['REGISTER_TRANSFER'],
  },
  needsWorker: {
    fn: needsWorker,
    trueFor: ['PAYOUT'],
  },
  needsOtherCategory: {
    fn: needsOtherCategory,
    trueFor: ['OTHER'],
  },
  showsOtherCategory: {
    fn: showsOtherCategory,
    trueFor: ['OTHER', 'INVESTMENT_EXPENSE', 'INVESTMENT_EXPENSE_NET', 'PAYOUT'],
  },
  needsExpenseCategory: {
    fn: needsExpenseCategory,
    trueFor: ['INVESTMENT_EXPENSE', 'INVESTMENT_EXPENSE_NET'],
  },
  isSheetTransferTabType: {
    fn: isSheetTransferTabType,
    trueFor: ['INVESTOR_DEPOSIT', 'LABOR_COST', 'RABAT', 'PAYOUT', 'LOSS'],
  },
  isExpensesTabType: {
    fn: isExpensesTabType,
    trueFor: ['INVESTMENT_EXPENSE', 'INVESTMENT_EXPENSE_NET', 'CORRECTION'],
  },
  billsNetAmount: {
    fn: billsNetAmount,
    trueFor: ['INVESTMENT_EXPENSE_NET'],
  },
  canBeSettled: {
    fn: canBeSettled,
    // No INVESTMENT_EXPENSE_NET: „wliczone w robociznę" routes an amount into
    // totalSettled, which marża reads — the netto figure must never reach it.
    trueFor: ['INVESTMENT_EXPENSE', 'CORRECTION'],
  },
  isLaborCost: {
    fn: isLaborCost,
    trueFor: ['LABOR_COST'],
  },
  isCancellationType: {
    fn: isCancellationType,
    trueFor: ['CANCELLATION'],
  },
}

// Not boolean, so it has no row in the truth table above — its per-type answers are
// pinned by the spec-table consistency suite instead (transfer-spec-table.test.ts).
const NOT_A_BOOLEAN_PREDICATE = ['financialBucketOf', 'billedAmountOf', 'billedAmountFor']

describe('transfer constants — helper truth table', () => {
  it('covers every exported predicate', () => {
    // Derived from the module, not a hand-typed count — a `toHaveLength(15)` stays green
    // forever while a newly exported predicate goes untested. Its one exclusion is named
    // and justified, so adding an export forces a decision here rather than silence.
    const covered = [...Object.keys(HELPERS), ...NOT_A_BOOLEAN_PREDICATE]
    const exported = Object.entries(transfersModule)
      .filter(([, value]) => typeof value === 'function')
      .map(([name]) => name)
    expect(covered.sort()).toEqual(exported.sort())
  })

  for (const [helperName, { fn, trueFor }] of Object.entries(HELPERS)) {
    describe(helperName, () => {
      for (const type of TRANSFER_TYPES) {
        const expected = trueFor.includes(type)
        it(`${type} → ${expected}`, () => {
          expect(fn(type)).toBe(expected)
        })
      }
    })
  }
})

describe('needsSourceRegister — CANCELLATION', () => {
  // Flipped from true in EX-573 phase 3. A cancellation is an audit stub with no cash
  // movement of its own — the register was already moved by the row being reversed. While
  // this was true, the admin panel offered a cancellation a „Kasa" picker whose value
  // nothing cleared (validate.ts returns early for CANCELLATION) and which would land in
  // the `ELSE -amount` arm of sum-transfers.ts, silently draining that register.
  //
  // Defence, not repair: 0 of the 257 cancellations in the production dataset carry a
  // register, which is why the golden master's 29 register balances are unmoved by this.
  it('is false — a cancellation gets no register picker', () => {
    expect(needsSourceRegister('CANCELLATION')).toBe(false)
  })
})

describe('canBeSettled vs isExpensesTabType — the equality that ended', () => {
  // The two agreed for all 12 pre-netto types, which is why they were once a single
  // predicate. That was a coincidence of the type set, not a rule, and
  // INVESTMENT_EXPENSE_NET broke it: an expenses-tab row that must NOT be settleable.
  it('INVESTMENT_EXPENSE_NET is the counterexample', () => {
    expect(isExpensesTabType('INVESTMENT_EXPENSE_NET')).toBe(true)
    expect(canBeSettled('INVESTMENT_EXPENSE_NET')).toBe(false)
  })

  it('settleable still implies an expenses-tab row — that direction IS a rule', () => {
    for (const type of TRANSFER_TYPES) {
      if (canBeSettled(type)) expect(isExpensesTabType(type), type).toBe(true)
    }
  })
})

describe('needsExpenseCategory — investment-aware', () => {
  it.each([
    ['INVESTMENT_EXPENSE', undefined, true],
    ['INVESTMENT_EXPENSE', false, true],
    ['INVESTMENT_EXPENSE', true, true],
    ['CORRECTION', true, true],
    ['CORRECTION', false, false],
    ['CORRECTION', undefined, false],
    ['LOSS', true, false],
    ['OTHER', true, false],
    ['', true, false],
    ['UNKNOWN_TYPE', true, false],
  ] as const)('needsExpenseCategory(%s, %s) === %s', (type, hasInvestment, expected) => {
    expect(needsExpenseCategory(type, hasInvestment)).toBe(expected)
  })
})

// ── Exact contents AND order of every membership array ──────────────────

describe('membership arrays — exact contents and order', () => {
  it('TRANSFER_TYPES', () => {
    expect(TRANSFER_TYPES).toEqual([
      'CANCELLATION',
      'OTHER_DEPOSIT',
      'OTHER',
      'CORRECTION',
      'LABOR_COST',
      'RABAT',
      'LOSS',
      'REGISTER_TRANSFER',
      'INVESTOR_DEPOSIT',
      'INVESTMENT_EXPENSE',
      'INVESTMENT_EXPENSE_NET',
      'PAYOUT',
      'COMPANY_FUNDING',
    ])
  })

  it('DEPOSIT_TYPES', () => {
    expect(DEPOSIT_TYPES).toEqual(['INVESTOR_DEPOSIT', 'COMPANY_FUNDING', 'OTHER_DEPOSIT'])
  })

  it('DEPOSIT_UI_TYPES', () => {
    expect(DEPOSIT_UI_TYPES).toEqual(['OTHER_DEPOSIT', 'INVESTOR_DEPOSIT', 'COMPANY_FUNDING'])
  })

  it('TRANSACTION_TRANSFER_TYPES', () => {
    // LABOR_COST and RABAT are absent by design (EX-555): both figures are read off the kosztorys,
    // so the dialog must not offer a second way to book them. They remain in TRANSFER_TYPES and in
    // every other list here — this array alone governs what the dialog offers.
    expect(TRANSACTION_TRANSFER_TYPES).toEqual([
      'OTHER',
      'CORRECTION',
      'LOSS',
      'INVESTMENT_EXPENSE',
      'INVESTMENT_EXPENSE_NET',
      'PAYOUT',
    ])
  })

  it('EXPENSES_TAB_TYPES', () => {
    expect(EXPENSES_TAB_TYPES).toEqual([
      'INVESTMENT_EXPENSE',
      'INVESTMENT_EXPENSE_NET',
      'CORRECTION',
    ])
  })

  it('SHEET_TRANSFER_TAB_TYPES', () => {
    expect(SHEET_TRANSFER_TAB_TYPES).toEqual([
      'INVESTOR_DEPOSIT',
      'LABOR_COST',
      'RABAT',
      'PAYOUT',
      'LOSS',
    ])
  })

  // Order IS the sheet's summary-block column layout (I–N), rewritten verbatim by
  // setupTab on a reset/relink. A reorder here silently rewrites live client
  // spreadsheets, with no failure preceding the damage.
  it('TRANSFERS_SUMMARY_TYPES — order is a live sheet column layout', () => {
    expect(TRANSFERS_SUMMARY_TYPES).toEqual([
      'INVESTOR_DEPOSIT',
      'LABOR_COST',
      'RABAT',
      'PAYOUT',
      'CORRECTION',
      'LOSS',
    ])
  })

  it('TRANSACTION_TRANSFER_TYPES excludes deposits and REGISTER_TRANSFER', () => {
    for (const depositType of DEPOSIT_TYPES) {
      expect(TRANSACTION_TRANSFER_TYPES).not.toContain(depositType)
    }
    expect(TRANSACTION_TRANSFER_TYPES).not.toContain('REGISTER_TRANSFER')
  })

  it('every array entry is a valid TransferTypeT', () => {
    const arrays = {
      DEPOSIT_TYPES,
      DEPOSIT_UI_TYPES,
      TRANSACTION_TRANSFER_TYPES,
      EXPENSES_TAB_TYPES,
      SHEET_TRANSFER_TAB_TYPES,
      TRANSFERS_SUMMARY_TYPES,
    }
    for (const [name, arr] of Object.entries(arrays)) {
      for (const t of arr) {
        expect(TRANSFER_TYPES, `${name} contains unknown type ${t}`).toContain(t)
      }
    }
  })
})

// ── Label and colour maps ───────────────────────────────────────────────

describe('TRANSFER_TYPE_LABELS / TRANSFER_TYPE_COLORS', () => {
  it.each([
    ['CANCELLATION', 'Anulowanie', 'muted-foreground'],
    ['OTHER_DEPOSIT', 'Inna wpłata', 'chart-green'],
    ['OTHER', 'Inny wydatek', 'chart-red'],
    ['CORRECTION', 'Korekta', 'chart-orange'],
    ['LABOR_COST', 'Koszty robocizny', 'chart-orange'],
    ['RABAT', 'Rabat', 'chart-green'],
    ['LOSS', 'Strata', 'chart-purple'],
    ['REGISTER_TRANSFER', 'Transfer między kasami', 'chart-turquoise'],
    ['INVESTOR_DEPOSIT', 'Wpłata od inwestora', 'chart-green'],
    ['INVESTMENT_EXPENSE', 'Wydatek inwestycyjny', 'chart-red'],
    ['INVESTMENT_EXPENSE_NET', 'Wydatek inwestycyjny netto', 'chart-blue'],
    ['PAYOUT', 'Wypłata', 'chart-red'],
    ['COMPANY_FUNDING', 'Zasilenie z konta firmowego', 'chart-green'],
  ] as const)('%s → %s / %s', (type, label, color) => {
    expect(TRANSFER_TYPE_LABELS[type]).toBe(label)
    expect(TRANSFER_TYPE_COLORS[type]).toBe(color)
  })

  it('TRANSFER_TYPES is sorted by its Polish label', () => {
    const labels = TRANSFER_TYPES.map((t) => TRANSFER_TYPE_LABELS[t])
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'pl')))
  })
})

// ── Unknown input ───────────────────────────────────────────────────────

describe('every predicate returns false for unknown input', () => {
  for (const [name, { fn }] of Object.entries(HELPERS)) {
    it.each(['', 'UNKNOWN_TYPE', 'investment_expense'])(`${name}(%j) → false`, (input) => {
      expect(fn(input)).toBe(false)
    })
  }
})

describe('unknown-tolerant predicates reject non-string input', () => {
  // These three take `unknown` (collections/transfers.ts:250 relies on it) — the rest
  // take `string`. Pinned so the rewrite can't quietly narrow the signature.
  const unknownTolerant: [string, (t: unknown) => boolean][] = [
    ['isSheetTransferTabType', isSheetTransferTabType],
    ['isExpensesTabType', isExpensesTabType],
    ['canBeSettled', canBeSettled],
  ]
  for (const [name, fn] of unknownTolerant) {
    it.each([null, undefined, 0, {}, []])(`${name}(%j) → false`, (input) => {
      expect(fn(input)).toBe(false)
    })
  }
})
