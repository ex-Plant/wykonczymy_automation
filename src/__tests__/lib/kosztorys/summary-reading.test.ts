import { describe, it, expect } from 'vitest'
import {
  financialsOnReading,
  readingFromKosztorys,
  readingFromTransactions,
} from '@/lib/kosztorys/summary-reading'
import type { KosztorysClientTotalsT } from '@/lib/kosztorys/settlement-client-totals'
import type { InvestmentFinancialsT } from '@/types/investment-financials'

// Only the four fields the two readings touch matter here; the rest of the shape is cash-movement
// data both readings pass through untouched.
const financials = {
  totalLaborCosts: 100_000,
  totalDiscount: 8_000,
  materialsGrossBase: 40_000,
  materialsNetBilled: 32_520,
} as InvestmentFinancialsT

const clientTotals = {
  sumaPracNet: 90_000,
  rabatClientNet: 5_000,
} as KosztorysClientTotalsT

describe('summary reading projection', () => {
  it('lands both readings on the same POST-rabat axis', () => {
    expect(readingFromTransactions(financials)).toEqual({
      laborCostsNet: 92_000,
      rabatAmount: 8_000,
    })
    expect(readingFromKosztorys(clientTotals)).toEqual({
      laborCostsNet: 85_000,
      rabatAmount: 5_000,
    })
  })

  it('keeps robocizna + rabat addable back to the pre-rabat figure the pie draws', () => {
    const v1 = readingFromTransactions(financials)
    const v2 = readingFromKosztorys(clientTotals)

    expect(v1.laborCostsNet + v1.rabatAmount).toBe(financials.totalLaborCosts)
    expect(v2.laborCostsNet + v2.rabatAmount).toBe(clientTotals.sumaPracNet)
  })

  it('reports no rabat when there is none to report', () => {
    expect(
      readingFromKosztorys({ sumaPracNet: 90_000, rabatClientNet: 0 } as KosztorysClientTotalsT),
    ).toEqual({ laborCostsNet: 90_000, rabatAmount: 0 })
  })
})

// No kosztorys is an ANSWER, not a question to forward to the transfers. The two surfaces on this
// reading — the Podsumowanie panel and the investments listing — must both report zero, however much
// robocizna the investment still carries as legacy LABOR_COST rows. v1 is where those are read.
describe('readingFromKosztorys without a kosztorys', () => {
  it('reads zero rather than the transactions plane', () => {
    expect(readingFromKosztorys(null)).toEqual({ laborCostsNet: 0, rabatAmount: 0 })
    expect(readingFromKosztorys(undefined)).toEqual({ laborCostsNet: 0, rabatAmount: 0 })
  })

  it('cannot be told apart from a kosztorys that sums to zero', () => {
    const nothingExecuted = { sumaPracNet: 0, rabatClientNet: 0 } as KosztorysClientTotalsT

    expect(readingFromKosztorys(nothingExecuted)).toEqual(readingFromKosztorys(null))
  })
})

// The swap both the listing rows and v2's Marża tab apply before calling calculateBalance /
// calculateMargin. Its whole job is to move exactly two figures and nothing else.
describe('financialsOnReading', () => {
  it('restores the pre-rabat robocizna the formulas expect', () => {
    const swapped = financialsOnReading(financials, readingFromKosztorys(clientTotals))

    expect(swapped.totalLaborCosts).toBe(90_000)
    expect(swapped.totalDiscount).toBe(5_000)
  })

  it('leaves every cash-movement figure alone', () => {
    // The guard against a swap that quietly rebases materiały or wypłaty onto the kosztorys plane,
    // which the kosztorys has no figure for at all.
    const swapped = financialsOnReading(financials, readingFromKosztorys(clientTotals))
    const { totalLaborCosts: _labor, totalDiscount: _rabat, ...untouched } = swapped
    const {
      totalLaborCosts: _originalLabor,
      totalDiscount: _originalRabat,
      ...originalUntouched
    } = financials

    expect(untouched).toEqual(originalUntouched)
  })

  it('is a no-op on the transactions reading', () => {
    // v1 must survive the seam byte-identical: 84 of 96 investments have no kosztorys.
    expect(financialsOnReading(financials, readingFromTransactions(financials))).toEqual(financials)
  })
})
