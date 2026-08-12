import type { InvestmentFinancialsMapT, KosztorysClientTotalsMapT } from '@/lib/queries/balances'
import { calculateBalance } from '@/lib/db/calculate-balance'
import { calculateMargin } from '@/lib/db/calculate-margin'
import { effectiveMaterialsNetRate } from '@/lib/kosztorys/settlement-mode'
import { financialsOnReading, resolveSummaryReading } from '@/lib/kosztorys/summary-reading'
import {
  billedCategoryCosts,
  billedMaterials,
  grossBalance,
} from '@/lib/kosztorys/summary-economics'
import { ZERO_FINANCIALS } from '@/types/investment-financials'
import type { InvestmentRefT } from '@/types/reference-data'
import type { InvestmentRowT } from '@/types/table-rows'

/** The listing row assembly, kept apart from the fetches in `queries/investments.ts` so the parity
 *  audit can run the REAL row builder from a plain node script — importing it through the query
 *  module drags in `server-only` and the audit falls back to re-deriving the formula, which is how
 *  the plane defect stayed invisible in the first place. */
export function shapeInvestments(
  investments: InvestmentRefT[],
  financialsRecord: InvestmentFinancialsMapT,
  kosztorysTotalsRecord: KosztorysClientTotalsMapT = {},
): InvestmentRowT[] {
  return investments.map((inv) => {
    const transactionFinancials = financialsRecord[String(inv.id)] ?? ZERO_FINANCIALS
    // The read-switch. Robocizna and rabat come from the kosztorys wherever there is one; every other
    // figure here is a cash movement the kosztorys knows nothing about and stays transaction-sourced.
    const reading = resolveSummaryReading(
      kosztorysTotalsRecord[String(inv.id)],
      transactionFinancials,
    )
    const financials = financialsOnReading(transactionFinancials, reading)
    const totalCosts = financials.totalMaterialCosts + financials.totalLaborCosts
    const netRate = effectiveMaterialsNetRate(inv.settlementMode, inv.materialsNetRate)
    // The two-bucket form rather than Σ of the columns: equal to the grosz, but it is the same call
    // the investment's own Podsumowanie makes, so the two surfaces cannot drift apart.
    const totalInvestmentExpense = billedMaterials(
      { grossBase: financials.materialsGrossBase, netBilled: financials.materialsNetBilled },
      netRate,
    )
    const billedCategories = billedCategoryCosts(
      financials.categoryCosts,
      financials.netCategoryCosts,
      netRate,
    )
    const balance = calculateBalance(financials)
    return {
      id: inv.id,
      name: inv.name,
      status: inv.status,
      totalCosts,
      totalMaterialCosts: financials.totalMaterialCosts,
      totalIncome: financials.totalIncome,
      totalLaborCosts: financials.totalLaborCosts,
      totalPayouts: financials.totalPayouts,
      totalInvestmentExpense,
      categoryCosts: billedCategories,
      totalSettled: financials.totalSettled,
      balance,
      // The VAT base must be the SAME pair the netto bilans was built from — whichever plane the
      // read-switch put this investment on. Grossing a kosztorys-sourced bilans with the transfers
      // robocizna would price the VAT on work the bilans never counted, so the brutto figure would
      // stop being the netto one plus its tax.
      balanceGross: grossBalance(
        balance,
        inv.vatRate,
        financials.totalLaborCosts,
        financials.totalRabat,
      ),
      margin: calculateMargin(financials),
      address: inv.address,
      phone: inv.phone,
      email: inv.email,
      contactPerson: inv.contactPerson,
      review: inv.review,
      notes: inv.notes,
      hasSheet: inv.hasSheet,
      materialsNetRate: inv.materialsNetRate,
      settlementMode: inv.settlementMode,
      vatRate: inv.vatRate,
    }
  })
}
