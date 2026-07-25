import { describe, it, expect } from 'vitest'
import { deriveFinancials, deriveCategoryBreakdowns } from '@/lib/db/investment-financials'
import { TRANSFER_TYPES } from '@/lib/constants/transfers'
import type { InvestmentFinancialsT } from '@/types/investment-financials'

// CHARACTERIZATION SUITE (EX-573 phase 0) — the bucketing rule, pinned before phase 2
// rewrites deriveFinancials to read the spec table.
//
// Shape: feed ONE (type, settled) pair at a time and assert which buckets pick it up.
// A whole-distribution snapshot would let two compensating errors cancel out; a single
// pair per run makes every cell of the matrix independently observable, and a failure
// names the exact pair that moved.

const AMOUNT = 100

type BucketNameT = Exclude<keyof InvestmentFinancialsT, 'categoryCosts' | 'settledCategoryCosts'>

/** Which (type, settled) pairs land in each bucket today. Hand-typed, not derived. */
const BUCKET_MEMBERSHIP: Record<BucketNameT, [string, boolean][]> = {
  totalMaterialCosts: [
    ['INVESTMENT_EXPENSE', false],
    ['CORRECTION', false],
  ],
  // Dead figure — computed, typed, zero-initialised, read nowhere. Phase 2 deletes it;
  // pinning it makes that deletion a visible diff instead of a silent disappearance.
  totalCorrections: [['CORRECTION', false]],
  // The deposit buckets ignore `settled` entirely — a settled deposit is not a concept,
  // but the predicate does not exclude it, and that tolerance is the pinned behaviour.
  totalIncome: [
    ['INVESTOR_DEPOSIT', false],
    ['INVESTOR_DEPOSIT', true],
    ['COMPANY_FUNDING', false],
    ['COMPANY_FUNDING', true],
    ['OTHER_DEPOSIT', false],
    ['OTHER_DEPOSIT', true],
  ],
  totalLaborCosts: [
    ['LABOR_COST', false],
    ['LABOR_COST', true],
  ],
  totalPayouts: [
    ['PAYOUT', false],
    ['PAYOUT', true],
  ],
  totalRabat: [
    ['RABAT', false],
    ['RABAT', true],
  ],
  totalLoss: [
    ['LOSS', false],
    ['LOSS', true],
  ],
  totalSettled: [
    ['INVESTMENT_EXPENSE', true],
    ['CORRECTION', true],
  ],
}

const ALL_PAIRS: [string, boolean][] = TRANSFER_TYPES.flatMap((type) => [
  [type, false] as [string, boolean],
  [type, true] as [string, boolean],
])

const isMember = (bucket: BucketNameT, [type, settled]: [string, boolean]) =>
  BUCKET_MEMBERSHIP[bucket].some(([t, s]) => t === type && s === settled)

describe('deriveFinancials — bucketing matrix', () => {
  it('covers every bucket', () => {
    const financials = deriveFinancials([])
    const buckets = Object.keys(financials).filter(
      (k) => k !== 'categoryCosts' && k !== 'settledCategoryCosts',
    )
    expect(buckets.sort()).toEqual(Object.keys(BUCKET_MEMBERSHIP).sort())
  })

  it('covers every (type × settled) pair', () => {
    expect(ALL_PAIRS).toHaveLength(24)
  })

  for (const pair of ALL_PAIRS) {
    const [type, settled] = pair
    describe(`${type} · settled=${settled}`, () => {
      const financials = deriveFinancials([{ type, settled, total: AMOUNT }])
      for (const bucket of Object.keys(BUCKET_MEMBERSHIP) as BucketNameT[]) {
        const expected = isMember(bucket, pair) ? AMOUNT : 0
        it(`${bucket} → ${expected}`, () => {
          expect(financials[bucket]).toBe(expected)
        })
      }
    })
  }
})

describe('deriveFinancials — unknown type falls into no bucket', () => {
  it.each(['UNKNOWN_TYPE', '', 'investment_expense'])('%j contributes nothing', (type) => {
    for (const settled of [false, true]) {
      const financials = deriveFinancials([{ type, settled, total: AMOUNT }])
      for (const bucket of Object.keys(BUCKET_MEMBERSHIP) as BucketNameT[]) {
        expect(financials[bucket], `${type}/${settled} leaked into ${bucket}`).toBe(0)
      }
    }
  })
})

describe('deriveFinancials — breakdowns pass through untouched', () => {
  it('returns the category arrays it was given', () => {
    const live = [{ categoryId: 1, total: 10 }]
    const settled = [{ categoryId: 2, total: 20 }]
    const financials = deriveFinancials([], live, settled)
    expect(financials.categoryCosts).toEqual(live)
    expect(financials.settledCategoryCosts).toEqual(settled)
  })

  it('defaults both to empty', () => {
    const financials = deriveFinancials([])
    expect(financials.categoryCosts).toEqual([])
    expect(financials.settledCategoryCosts).toEqual([])
  })
})

describe('deriveCategoryBreakdowns — same membership, split by settled', () => {
  it.each(TRANSFER_TYPES)('%s', (type) => {
    const isExpense = type === 'INVESTMENT_EXPENSE' || type === 'CORRECTION'
    const live = deriveCategoryBreakdowns([{ categoryId: 7, type, settled: false, total: AMOUNT }])
    const settled = deriveCategoryBreakdowns([{ categoryId: 7, type, settled: true, total: AMOUNT }])

    expect(live.categoryCosts).toEqual(isExpense ? [{ categoryId: 7, total: AMOUNT }] : [])
    expect(live.settledCategoryCosts).toEqual([])
    expect(settled.settledCategoryCosts).toEqual(isExpense ? [{ categoryId: 7, total: AMOUNT }] : [])
    expect(settled.categoryCosts).toEqual([])
  })

  it('sums repeated rows per category', () => {
    const { categoryCosts } = deriveCategoryBreakdowns([
      { categoryId: 7, type: 'INVESTMENT_EXPENSE', settled: false, total: 10 },
      { categoryId: 7, type: 'CORRECTION', settled: false, total: 5 },
      { categoryId: 8, type: 'INVESTMENT_EXPENSE', settled: false, total: 3 },
    ])
    expect(categoryCosts).toEqual([
      { categoryId: 7, total: 15 },
      { categoryId: 8, total: 3 },
    ])
  })

  // Σ settledCategoryCosts must equal totalSettled by construction — the invariant the
  // „Materiały wliczone w robociznę" buttons rely on to sum to the headline figure.
  it('reconciles with deriveFinancials over a mixed distribution', () => {
    const rows = [
      { categoryId: 1, type: 'INVESTMENT_EXPENSE', settled: false, total: 100 },
      { categoryId: 1, type: 'INVESTMENT_EXPENSE', settled: true, total: 40 },
      { categoryId: 2, type: 'CORRECTION', settled: false, total: 25 },
      { categoryId: 2, type: 'CORRECTION', settled: true, total: 5 },
      { categoryId: 3, type: 'PAYOUT', settled: false, total: 999 },
    ]
    const breakdowns = deriveCategoryBreakdowns(rows)
    const financials = deriveFinancials(
      rows.map(({ type, settled, total }) => ({ type, settled, total })),
      breakdowns.categoryCosts,
      breakdowns.settledCategoryCosts,
    )
    const sum = (costs: { total: number }[]) => costs.reduce((a, c) => a + c.total, 0)

    expect(sum(breakdowns.categoryCosts)).toBe(financials.totalMaterialCosts)
    expect(sum(breakdowns.settledCategoryCosts)).toBe(financials.totalSettled)
  })
})
