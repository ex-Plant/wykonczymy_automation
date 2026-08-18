import type {
  InvestmentFinancialsMapT,
  KosztorysClientTotalsMapT,
  KosztorysSubcontractorDueMapT,
} from '@/lib/queries/balances'
import { calculateBalance } from '@/lib/db/calculate-balance'
import { calculateMargin } from '@/lib/db/calculate-margin'
import { grossBalance } from '@/lib/db/gross-balance'
import { effectiveMaterialsNetRate } from '@/lib/kosztorys/settlement-mode'
import { financialsOnReading, readingFromKosztorys } from '@/lib/kosztorys/summary-reading'
import { billedCategoryCosts, billedMaterials } from '@/lib/kosztorys/summary-economics'
import { marginV2, type SubcontractorSettlementT } from '@/lib/kosztorys/margin-v2'
import { ZERO_FINANCIALS } from '@/types/investment-financials'
import type { InvestmentRefT } from '@/types/reference-data'
import type { InvestmentRowT } from '@/types/table-rows'

const NOTHING_DUE: SubcontractorSettlementT = { due: 0, hasUnconfirmedPlane: false }

/** The listing row assembly, kept apart from the fetches in `queries/investments.ts` so the parity
 *  audit can run the REAL row builder from a plain node script — importing it through the query
 *  module drags in `server-only` and the audit falls back to re-deriving the formula, which is how
 *  the plane defect stayed invisible in the first place. */
export function shapeInvestments(
  investments: InvestmentRefT[],
  financialsRecord: InvestmentFinancialsMapT,
  kosztorysTotalsRecord: KosztorysClientTotalsMapT = {},
  subcontractorDueRecord: KosztorysSubcontractorDueMapT = {},
): InvestmentRowT[] {
  return investments.map((inv) => {
    const transactionFinancials = financialsRecord[String(inv.id)] ?? ZERO_FINANCIALS
    // Robocizna and rabat come from the kosztorys, full stop — no kosztorys reads as zero. Every
    // other figure here is a cash movement the kosztorys knows nothing about and stays
    // transaction-sourced.
    const reading = readingFromKosztorys(kosztorysTotalsRecord[String(inv.id)])
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
      totalLaborCostsFromTransactions: transactionFinancials.totalLaborCosts,
      totalPayouts: financials.totalPayouts,
      totalInvestmentExpense,
      categoryCosts: billedCategories,
      totalSettled: financials.totalSettled,
      balance,
      // The VAT base must be the SAME pair the netto bilans was built from. Grossing a
      // kosztorys-sourced bilans with the transfers robocizna would price the VAT on work the bilans
      // never counted, so the brutto figure would stop being the netto one plus its tax.
      // Both planes, side by side, because neither is inferable from the other and an investment
      // whose kosztorys is still in a spreadsheet has its robocizna ONLY here. No brutto twin: the
      // transactions bilans has never had one.
      balanceFromTransactions: calculateBalance(transactionFinancials),
      balanceGross: grossBalance(
        balance,
        inv.vatRate,
        financials.totalLaborCosts,
        financials.totalDiscount,
      ),
      // The RAW financials, not the rebased ones: this is the v1 margin and v1 IS the transactions
      // plane. Run on the kosztorys robocizna it was a third figure that matched no surface in the
      // app — same name as the investment page's, 235 908,25 zl apart from it on „11 Listopada 40".
      margin: calculateMargin(transactionFinancials),
      // No kosztorys is an answer here as much as it is for robocizna: nothing is owed to a crew for
      // work nobody entered, so the zero settlement is a fact, not a missing input.
      marginV2: marginV2(financials, subcontractorDueRecord[String(inv.id)] ?? NOTHING_DUE),
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
