import type { InvestmentFinancialsMapT } from '@/lib/queries/balances'
import { calculateBalance } from '@/lib/db/calculate-balance'
import { calculateMargin } from '@/lib/db/calculate-margin'
import { effectiveMaterialsNetRate } from '@/lib/kosztorys/settlement-mode'
import { billedCategoryCosts, billedMaterials } from '@/lib/kosztorys/summary-economics'
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
    const fin = financialsRecord[String(inv.id)]
    const financials = fin ?? {
      categoryCosts: [],
      totalMaterialCosts: 0,
      materialsGrossBase: 0,
      materialsNetBilled: 0,
      totalIncome: 0,
      totalLaborCosts: 0,
      totalPayouts: 0,
      totalRabat: 0,
      totalLoss: 0,
      totalSettled: 0,
      materialsNetDiscount: 0,
      settledCategoryCosts: [],
      netCategoryCosts: [],
    }
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
    // Material spend booked to no category — carried as its own figure so the columns still add up
    // to the total. It is a remainder, so it takes no repricing: the billed total already reflects it.
    const uncategorisedCorrection =
      totalInvestmentExpense - billedCategories.reduce((sum, c) => sum + c.total, 0)
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
      uncategorisedCorrection,
      categoryCosts: billedCategories,
      totalSettled: financials.totalSettled,
      balance,
      // VAT rides the prace alone (context/reference/kosztorys-editor-domain-notes.md), so nothing
      // but robocizna is grossed up here — materiały and korekty enter both planes at face value.
      balanceGross: balance + inv.vatRate * financials.totalLaborCosts,
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
