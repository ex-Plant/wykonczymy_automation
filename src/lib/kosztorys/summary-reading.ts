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
