import { describe, it, expect } from 'vitest'
import { readingFromKosztorys, readingFromTransactions } from '@/lib/kosztorys/summary-reading'
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
