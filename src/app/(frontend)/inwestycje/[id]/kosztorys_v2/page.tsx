import { notFound } from 'next/navigation'
import { parseInvestmentId } from '@/lib/queries/investments'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import {
  fetchPayoutTransactionsForInvestment,
  fetchDepositTransactionsForInvestment,
  fetchMaterialTransactionsForInvestment,
} from '@/lib/queries/investment-transactions'
import {
  deriveWholeInvestmentFinancials,
  fetchWholeInvestmentFinancials,
} from '@/lib/queries/whole-investment-financials'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { requireManagementPage } from '@/lib/auth/require-management-page'
import { KosztorysEditorV2 } from '@/components/kosztorys/editor/kosztorys-editor-v2'
import { perfStart } from '@/lib/perf'

// The in-app kosztorys editor ("kosztorys_v2"). Always available — every investment has one,
// the editor renders its own empty state. The legacy Google Sheet lives at /kosztorys.
export default async function InvestmentKosztorysV2Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const elapsed = perfStart()
  const { id } = await params
  const investmentId = parseInvestmentId(id)
  // Awaited before the fan-out on purpose. Folded into the Promise.all it would race
  // getKosztorysTree's throw, and whichever rejects first decides whether a non-management session
  // sees the login page or an error screen. Serializing costs nothing: requireAuth is a cache()'d
  // JWT decode with no round trip, and getKosztorysTree reads it back from the same request cache.
  const user = await requireManagementPage()

  const treePromise = getKosztorysTree(investmentId)
  // Read-only bridge to the financial plane: the investment's live material spend (unsettled
  // INVESTMENT_EXPENSE + CORRECTION) plus its per-expense-category split, summed via the same
  // cached path the detail page uses.
  const financialsPromise = fetchWholeInvestmentFinancials(investmentId)
  // The realized PAYOUT rows — the subcontractor block's wypłaty list and, summed there, its
  // per-worker totals.
  const payoutTxPromise = fetchPayoutTransactionsForInvestment(investmentId)
  // The individual deposit rows — feed the client Podsumowanie's sortable wpłaty list.
  const depositTxPromise = fetchDepositTransactionsForInvestment(investmentId)
  // The individual materiały rows for the Podsumowanie's wydatki list — same fetch the client share
  // read uses, so both surfaces label and split the rows identically.
  const materialTxPromise = fetchMaterialTransactionsForInvestment(investmentId)
  const [
    tree,
    financialsSource,
    refData,
    payoutTransactions,
    depositTransactions,
    materialTransactions,
  ] = await Promise.all([
    treePromise,
    financialsPromise,
    fetchReferenceData(),
    payoutTxPromise,
    depositTxPromise,
    materialTxPromise,
  ])
  console.log(
    `[PERF] kosztorys_v2/${investmentId} 6-fetch fan-out ${elapsed()}ms ` +
      `(tree + financials source + referenceData + 3 transaction lists)`,
  )
  const { financials, materialsBreakdown, settledBreakdown } = deriveWholeInvestmentFinancials(
    financialsSource,
    tree,
    refData.expenseCategories,
  )
  // The investment's name, its existence and whether a Google sheet is linked all ride along on the
  // reference data already fetched above — a dedicated findByID bought none of the three.
  const investment = refData.investments.find((i) => i.id === investmentId)
  if (!investment) notFound()

  return (
    <KosztorysEditorV2
      investmentId={investmentId}
      tree={tree}
      investmentName={investment.name}
      materialsGrossBase={financials.materialsGrossBase}
      materialsNetBilled={financials.materialsNetBilled}
      materialsBreakdown={materialsBreakdown}
      settledBreakdown={settledBreakdown}
      financials={isAdminOrOwnerRole(user.role) ? financials : undefined}
      // Transaction-sourced robocizna/rabat (Σ LABOR_COST / Σ RABAT) for the in-editor reconciliation
      // scream — compared against the kosztorys figures during the population/verification transition.
      laborCostsNetFromTransactions={financials.totalLaborCosts}
      discountNetFromTransactions={financials.totalDiscount}
      investmentLoss={financials.totalLoss}
      payoutTransactions={payoutTransactions}
      depositTransactions={depositTransactions}
      materialTransactions={materialTransactions}
      workers={refData.workers}
      hasSheet={investment.hasSheet}
    />
  )
}
