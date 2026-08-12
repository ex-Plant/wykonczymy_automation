import type { KosztorysClientTotalsT } from '@/lib/kosztorys/settlement-client-totals'
import type { InvestmentFinancialsT } from '@/types/investment-financials'

/**
 * The only pair of figures the two readings of an investment disagree about. Materiały, wpłaty,
 * wypłaty and strata are cash movements the kosztorys knows nothing about, so they stay
 * transaction-sourced in both readings and never enter here.
 *
 * `laborCostsNetFromKosztorys` is POST-rabat and `rabatAmount` rides alongside it — the panel adds
 * them back where it needs the pre-rabat figure (`sumaPracPreRabat`). Both readings must land on that
 * same axis or the „Struktura kosztów" pie and the waterfall disagree between them.
 */
export type SummaryReadingT = {
  laborCostsNetFromKosztorys: number
  rabatAmount: number
}

/** v1 — Σ LABOR_COST (pre-rabat, like `sumaPracNet`) less Σ RABAT. */
export function readingFromTransactions(financials: InvestmentFinancialsT): SummaryReadingT {
  return {
    laborCostsNetFromKosztorys: financials.totalLaborCosts - financials.totalRabat,
    rabatAmount: financials.totalRabat,
  }
}

/** v2 — the kosztorys client-view nets, the same pair the reconciliation compares against v1. */
export function readingFromKosztorys({
  sumaPracNet,
  rabatClientNet,
}: KosztorysClientTotalsT): SummaryReadingT {
  return {
    laborCostsNetFromKosztorys: sumaPracNet - rabatClientNet,
    rabatAmount: rabatClientNet,
  }
}

/**
 * Which reading an investment is on. Two surfaces answer this — the Podsumowanie panel, which derives
 * the totals from the tree it already holds, and the investments listing, which reads them from the
 * SQL aggregate — and they must never answer it differently.
 *
 * ABSENCE of totals selects the transaction reading, not a zero total. An investment whose kosztorys
 * sums to zero (nothing executed yet) is still on the kosztorys plane and must read 0 zł robocizny
 * from it; only an investment with no kosztorys at all falls back. That is why
 * `selectKosztorysClientTotals` omits itemless investments rather than returning zero rows.
 */
export function resolveSummaryReading(
  clientTotals: KosztorysClientTotalsT | null | undefined,
  financials: InvestmentFinancialsT,
): SummaryReadingT {
  return clientTotals ? readingFromKosztorys(clientTotals) : readingFromTransactions(financials)
}

/**
 * The financials as the reading sees them: the robocizna/rabat pair swapped in, every cash-movement
 * figure untouched. Exists so `calculateBalance` and `calculateMargin` keep taking one object — a
 * switch threaded as parameters could be passed to one formula and forgotten at the other.
 *
 * `totalLaborCosts` is the PRE-rabat figure on both planes, which is why the reading's post-rabat
 * robocizna gets its rabat added back here.
 */
export function financialsOnReading(
  financials: InvestmentFinancialsT,
  reading: SummaryReadingT,
): InvestmentFinancialsT {
  return {
    ...financials,
    totalLaborCosts: reading.laborCostsNetFromKosztorys + reading.rabatAmount,
    totalRabat: reading.rabatAmount,
  }
}
