import { describe, it, expect } from 'vitest'
import {
  financialsOnReading,
  readingFromKosztorys,
  readingFromTransactions,
  resolveSummaryReading,
} from '@/lib/kosztorys/summary-reading'
import type { KosztorysClientTotalsT } from '@/lib/kosztorys/settlement-client-totals'
import type { InvestmentFinancialsT } from '@/types/investment-financials'

// Only the four fields the two readings touch matter here; the rest of the shape is cash-movement
// data both readings pass through untouched.
const financials = {
  totalLaborCosts: 100_000,
  totalRabat: 8_000,
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
      laborCostsNetFromKosztorys: 92_000,
      rabatAmount: 8_000,
    })
    expect(readingFromKosztorys(clientTotals)).toEqual({
      laborCostsNetFromKosztorys: 85_000,
      rabatAmount: 5_000,
    })
  })

  it('keeps robocizna + rabat addable back to the pre-rabat figure the pie draws', () => {
    const v1 = readingFromTransactions(financials)
    const v2 = readingFromKosztorys(clientTotals)

    expect(v1.laborCostsNetFromKosztorys + v1.rabatAmount).toBe(financials.totalLaborCosts)
    expect(v2.laborCostsNetFromKosztorys + v2.rabatAmount).toBe(clientTotals.sumaPracNet)
  })

  it('reports no rabat when there is none to report', () => {
    expect(
      readingFromKosztorys({ sumaPracNet: 90_000, rabatClientNet: 0 } as KosztorysClientTotalsT),
    ).toEqual({ laborCostsNetFromKosztorys: 90_000, rabatAmount: 0 })
  })
})

// The choice between the two readings, as opposed to their arithmetic above. Two surfaces make it —
// the Podsumowanie panel and the investments listing — and the point of extracting it is that they
// cannot make it differently.
describe('resolveSummaryReading', () => {
  it('reads the kosztorys when totals are present', () => {
    expect(resolveSummaryReading(clientTotals, financials)).toEqual(
      readingFromKosztorys(clientTotals),
    )
  })

  it('falls back to transactions when there is no kosztorys', () => {
    expect(resolveSummaryReading(null, financials)).toEqual(readingFromTransactions(financials))
    expect(resolveSummaryReading(undefined, financials)).toEqual(
      readingFromTransactions(financials),
    )
  })

  it('stays on the kosztorys plane when the kosztorys sums to zero', () => {
    // The trap this guards: a truthiness test on the figures rather than on their presence would
    // send an investment with a kosztorys but nothing executed yet back to the transactions plane,
    // where it would report the legacy LABOR_COST rows as its robocizna.
    const nothingExecuted = { sumaPracNet: 0, rabatClientNet: 0 } as KosztorysClientTotalsT

    expect(resolveSummaryReading(nothingExecuted, financials)).toEqual({
      laborCostsNetFromKosztorys: 0,
      rabatAmount: 0,
    })
  })
})

// The swap both the listing rows and v2's Marża tab apply before calling calculateBalance /
// calculateMargin. Its whole job is to move exactly two figures and nothing else.
describe('financialsOnReading', () => {
  it('restores the pre-rabat robocizna the formulas expect', () => {
    const swapped = financialsOnReading(financials, readingFromKosztorys(clientTotals))

    expect(swapped.totalLaborCosts).toBe(90_000)
    expect(swapped.totalRabat).toBe(5_000)
  })

  it('leaves every cash-movement figure alone', () => {
    // The guard against a swap that quietly rebases materiały or wypłaty onto the kosztorys plane,
    // which the kosztorys has no figure for at all.
    const swapped = financialsOnReading(financials, readingFromKosztorys(clientTotals))
    const { totalLaborCosts: _labor, totalRabat: _rabat, ...untouched } = swapped
    const {
      totalLaborCosts: _originalLabor,
      totalRabat: _originalRabat,
      ...originalUntouched
    } = financials

    expect(untouched).toEqual(originalUntouched)
  })

  it('is a no-op on the transactions reading', () => {
    // v1 must survive the seam byte-identical: 84 of 96 investments have no kosztorys.
    expect(financialsOnReading(financials, readingFromTransactions(financials))).toEqual(financials)
  })
})
