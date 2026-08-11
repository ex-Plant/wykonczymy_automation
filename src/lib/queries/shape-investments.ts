import type { InvestmentFinancialsMapT } from '@/lib/queries/balances'
import { calculateBalance } from '@/lib/db/calculate-balance'
import { calculateMargin } from '@/lib/db/calculate-margin'
import { effectiveMaterialsNetRate } from '@/lib/kosztorys/settlement-mode'
import {
  billedCategoryCosts,
  billedMaterials,
  grossBalance,
} from '@/lib/kosztorys/summary-economics'
import { ZERO_FINANCIALS } from '@/types/investment-financials'
import type { InvestmentRefT } from '@/types/reference-data'
import type { InvestmentRowT } from '@/components/tables/investments'

/** The listing row assembly, kept apart from the fetches in `queries/investments.ts` so the parity
 *  audit can run the REAL row builder from a plain node script — importing it through the query
 *  module drags in `server-only` and the audit falls back to re-deriving the formula, which is how
 *  the plane defect stayed invisible in the first place. */
export function shapeInvestments(
  investments: InvestmentRefT[],
  financialsRecord: InvestmentFinancialsMapT,
): InvestmentRowT[] {
  return investments.map((inv) => {
    const financials = financialsRecord[String(inv.id)] ?? ZERO_FINANCIALS
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
      // The transfers-plane labour is the right VAT base for a bilans built from transfers — the
      // Podsumowanie grosses its own kosztorys-plane robocizna, and the two planes are disconnected
      // by standing ruling. Where both are in sync the figures coincide, which is what makes them
      // comparable on screen; it is not an equality this code establishes.
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
