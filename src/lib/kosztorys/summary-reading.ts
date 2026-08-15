import type { KosztorysClientTotalsT } from '@/lib/kosztorys/settlement-client-totals'
import type { InvestmentFinancialsT } from '@/types/investment-financials'

/**
 * The only pair of figures the two readings of an investment disagree about. Materiały, wpłaty and
 * wypłaty are cash movements the kosztorys knows nothing about, and strata is booked on the
 * transfers even though no cash moves — so all four stay transaction-sourced in both readings and
 * never enter here.
 *
 * `laborCostsNet` is POST-rabat and `discountAmount` rides alongside it — the panel adds them back
 * where it needs the pre-rabat figure (`laborCostsNetPreDiscount`). Both readings must land on that same
 * axis or the „Struktura kosztów" pie and the waterfall disagree between them.
 */
export type SummaryReadingT = {
  laborCostsNet: number
  discountAmount: number
}

/** v1 — Σ LABOR_COST (pre-rabat, like `laborCostsNetFromKosztorys`) less Σ RABAT. */
export function readingFromTransactions(financials: InvestmentFinancialsT): SummaryReadingT {
  return {
    laborCostsNet: financials.totalLaborCosts - financials.totalDiscount,
    discountAmount: financials.totalDiscount,
  }
}

/**
 * v2 and the investments listing — the kosztorys is the entire source. No kosztorys means zero
 * robocizna and zero rabat; it never falls back to the transfers, because a figure that silently
 * swaps its source is a figure nobody can read. Legacy robocizna still booked as transfers is read
 * on **v1**, which exists for exactly that, until it is entered into the kosztorys.
 */
export function readingFromKosztorys(
  clientTotals: KosztorysClientTotalsT | null | undefined,
): SummaryReadingT {
  const discountAmount = clientTotals?.discountNetFromKosztorys ?? 0
  return {
    laborCostsNet: (clientTotals?.laborCostsNetFromKosztorys ?? 0) - discountAmount,
    discountAmount,
  }
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
    totalLaborCosts: reading.laborCostsNet + reading.discountAmount,
    totalDiscount: reading.discountAmount,
  }
}
