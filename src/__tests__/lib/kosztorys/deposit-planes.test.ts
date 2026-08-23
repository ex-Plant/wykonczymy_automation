import { describe, expect, it } from 'vitest'
import {
  bucketDepositsByPlane,
  depositPairFromPlaneSums,
  depositRowPair,
  depositsStrandedBy,
  isOffPlaneDeposit,
  offPlaneDeposits,
  settledPlaneAmount,
  strandsDeposit,
  type DepositRowT,
} from '@/lib/kosztorys/deposit-planes'
import { SETTLEMENT_MODES, type SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import type { VatPlaneT } from '@/lib/constants/transfers'

const VAT = 0.23

const cash = (amount: number): DepositRowT => ({ amount, netAmount: null, vatPlane: 'NET' })
const untagged = (amount: number): DepositRowT => ({ amount, netAmount: null, vatPlane: null })
const transfer = (amount: number, netAmount: number): DepositRowT => ({
  amount,
  netAmount,
  vatPlane: 'GROSS',
})
/** A wpłata brutto booked before `netAmount` existed — the only row the legacy bridge touches. */
const legacyTransfer = (amount: number): DepositRowT => ({
  amount,
  netAmount: null,
  vatPlane: 'GROSS',
})

// A wpłata carries the kwoty it actually had and nothing is derived at VAT: gotówka is one kwota
// netto with no brutto twin, a przelew is booked with both off its faktura. These guard that the
// brutto plane never invents a kwota for a gotówka — the defect that made „Do zapłaty netto" read
// −2399,20 where zero was owed.
describe('depositRowPair', () => {
  it('a gotówka is netto only — its brutto is „nie dotyczy", never zero', () => {
    expect(depositRowPair(cash(1000), VAT)).toEqual({ net: 1000, gross: null })
  })

  it('an untagged wpłata counts as gotówka (owner: „brak wartości = netto")', () => {
    expect(depositRowPair(untagged(400), VAT)).toEqual({ net: 400, gross: null })
  })

  it('a przelew reads BOTH kwoty off its faktura, not one crossed at VAT', () => {
    // 1230 / 1,23 would be 1000 — the faktura says 950 because materiały entered it at their own
    // rate. Reading the row is the whole point of storing netAmount.
    expect(depositRowPair(transfer(1230, 950), VAT)).toEqual({ net: 950, gross: 1230 })
  })

  it('falls back to the VAT bridge only for a pre-spike przelew with no netAmount', () => {
    expect(depositRowPair(legacyTransfer(1230), VAT)).toEqual({ net: 1000, gross: 1230 })
  })
})

describe('bucketDepositsByPlane', () => {
  it('splits the four sums by what each row carries', () => {
    const sums = bucketDepositsByPlane([
      cash(100),
      untagged(50),
      transfer(1230, 950),
      legacyTransfer(246),
    ])

    expect(sums).toEqual({
      paidNet: 150,
      paidGrossNet: 950,
      paidGrossLegacy: 246,
      paidGross: 1476,
    })
  })

  it('keeps the legacy bucket empty when every przelew carries its netto', () => {
    expect(bucketDepositsByPlane([transfer(1230, 950)]).paidGrossLegacy).toBe(0)
  })

  it('empty list yields zeroed sums', () => {
    expect(bucketDepositsByPlane([])).toEqual({
      paidNet: 0,
      paidGrossNet: 0,
      paidGrossLegacy: 0,
      paidGross: 0,
    })
  })
})

// The one place raw sums become the pair the settlement subtracts, so the panel (which reduces rows)
// and the listing (which reduces in SQL) can never apply the legacy bridge by two rules.
describe('depositPairFromPlaneSums', () => {
  it('crosses the legacy bucket at VAT and nothing else', () => {
    const pair = depositPairFromPlaneSums(
      { paidNet: 150, paidGrossNet: 950, paidGrossLegacy: 246, paidGross: 1476 },
      VAT,
    )

    expect(pair.net).toBeCloseTo(150 + 950 + 200)
    expect(pair.gross).toBe(1476)
  })

  it('counts ONLY przelewy on the brutto plane', () => {
    // The plane tryb brutto renders. A gotówka contributes nothing here — which is exactly what
    // `strandsDeposit` warns about, rather than something the sum should paper over.
    expect(depositPairFromPlaneSums(bucketDepositsByPlane([cash(5000)]), VAT).gross).toBe(0)
  })
})

// Two predicates on two different questions, deliberately kept apart: `isOffPlaneDeposit` asks „is
// the tryb still telling the truth" (both directions), `strandsDeposit` asks „does this wpłata
// vanish" (only the half that loses money). The table below is what stops a later refactor from
// collapsing them into one.
describe('the two off-plane predicates', () => {
  const PLANES: (VatPlaneT | null)[] = ['NET', 'GROSS', null]
  const row = (vatPlane: VatPlaneT | null) => ({ vatPlane })

  const OFF_PLANE: Record<SettlementModeT, Record<string, boolean>> = {
    NET: { NET: false, GROSS: true, null: false },
    GROSS: { NET: true, GROSS: false, null: true },
    MIXED: { NET: false, GROSS: false, null: false },
  }

  const STRANDS: Record<SettlementModeT, Record<string, boolean>> = {
    NET: { NET: false, GROSS: false, null: false },
    GROSS: { NET: true, GROSS: false, null: true },
    MIXED: { NET: false, GROSS: false, null: false },
  }

  for (const mode of SETTLEMENT_MODES) {
    for (const plane of PLANES) {
      const key = String(plane)

      it(`tryb ${mode}, wpłata ${key}: off-plane=${OFF_PLANE[mode][key]}, strands=${STRANDS[mode][key]}`, () => {
        expect(isOffPlaneDeposit(row(plane), mode)).toBe(OFF_PLANE[mode][key])
        expect(strandsDeposit(plane, mode)).toBe(STRANDS[mode][key])
      })
    }
  }

  it('only tryb brutto strands anything — a przelew on a netto bill still pays the debt down', () => {
    // The asymmetry the warning copy turns on: wrong tryb in both directions, lost money in one.
    expect(isOffPlaneDeposit(row('GROSS'), 'NET')).toBe(true)
    expect(strandsDeposit('GROSS', 'NET')).toBe(false)
  })

  it('tryb mieszany is the answer, so it never raises either flag', () => {
    for (const plane of PLANES) {
      expect(isOffPlaneDeposit(row(plane), 'MIXED')).toBe(false)
      expect(strandsDeposit(plane, 'MIXED')).toBe(false)
    }
  })
})

describe('offPlaneDeposits', () => {
  it('returns the rows themselves, so a count can be traced back to wpłaty', () => {
    const rows = [cash(100), transfer(1230, 950), untagged(50)]
    expect(offPlaneDeposits(rows, 'NET')).toEqual([rows[1]])
    expect(offPlaneDeposits(rows, 'GROSS')).toEqual([rows[0], rows[2]])
    expect(offPlaneDeposits(rows, 'MIXED')).toEqual([])
  })
})

// What flipping the tryb would cost, counted BEFORE the flip — nothing is rewritten when the owner
// changes it, the rows simply stop counting.
describe('depositsStrandedBy', () => {
  it('sums the face value of what a switch to brutto would silence', () => {
    expect(depositsStrandedBy([cash(100), untagged(50), transfer(1230, 950)], 'GROSS')).toEqual({
      count: 2,
      amount: 150,
    })
  })

  it('a switch to netto or mieszane strands nothing', () => {
    const rows = [cash(100), transfer(1230, 950)]
    expect(depositsStrandedBy(rows, 'NET')).toEqual({ count: 0, amount: 0 })
    expect(depositsStrandedBy(rows, 'MIXED')).toEqual({ count: 0, amount: 0 })
  })
})

describe('settledPlaneAmount', () => {
  it('gives the kwota the single money column shows, or null where the wpłata has none', () => {
    expect(settledPlaneAmount(cash(1000), 'NET', VAT)).toBe(1000)
    expect(settledPlaneAmount(cash(1000), 'GROSS', VAT)).toBeNull()
    expect(settledPlaneAmount(transfer(1230, 950), 'GROSS', VAT)).toBe(1230)
    expect(settledPlaneAmount(transfer(1230, 950), 'NET', VAT)).toBe(950)
  })
})
