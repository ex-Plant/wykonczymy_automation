import type { InvestmentFinancialsT } from '@/types/investment-financials'
import type { KosztorysClientTotalsT } from '@/lib/kosztorys/settlement'

/**
 * The transaction-sourced financials with robocizna and rabat swapped for their kosztorys
 * counterparts — the "v2" reading of an investment.
 *
 * A substituted financials object rather than a second set of formulas: every downstream figure
 * (bilans via `calculateBalance`, marża via `calculateMargin`, the tiles via `buildFinancialFields`)
 * then runs through the SAME code as v1, so the two versions can only ever differ by their inputs.
 *
 * Only these two figures exist on the kosztorys plane. Materiały, wpłaty, wypłaty and strata are cash
 * movements the kosztorys knows nothing about, so they stay transaction-sourced in both versions.
 */
export function financialsFromKosztorys(
  financials: InvestmentFinancialsT,
  { sumaPracNet, rabatClientNet }: KosztorysClientTotalsT,
): InvestmentFinancialsT {
  return { ...financials, totalLaborCosts: sumaPracNet, totalRabat: rabatClientNet }
}
