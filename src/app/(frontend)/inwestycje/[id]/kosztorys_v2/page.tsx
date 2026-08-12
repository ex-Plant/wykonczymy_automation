import { parseInvestmentId, requireInvestmentOr404 } from '@/lib/queries/investments'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import {
  fetchPayoutsByWorkerForInvestment,
  fetchPayoutTransactionsForInvestment,
  fetchDepositTransactionsForInvestment,
  fetchMaterialTransactionsForInvestment,
} from '@/lib/queries/investment-transactions'
import {
  deriveWholeInvestmentFinancials,
  fetchWholeInvestmentFinancials,
} from '@/lib/queries/whole-investment-financials'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { resolvePayoutWorkerNames } from '@/lib/kosztorys/payout-worker-names'
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

  const treePromise = getKosztorysTree(investmentId)
  // Read-only bridge to the financial plane: the investment's live material spend (unsettled
  // INVESTMENT_EXPENSE + CORRECTION) plus its per-expense-category split, summed via the same
  // cached path the detail page uses.
  const financialsPromise = fetchWholeInvestmentFinancials(investmentId)
  // Realized PAYOUTs per worker (null-worker bucket kept) for the subcontractor summary block.
  const payoutsPromise = fetchPayoutsByWorkerForInvestment(investmentId)
  // The individual realized PAYOUT rows — feed the subcontractor block's sortable wypłaty list.
  const payoutTxPromise = fetchPayoutTransactionsForInvestment(investmentId)
  // The individual deposit rows — feed the client Podsumowanie's sortable wpłaty list.
  const depositTxPromise = fetchDepositTransactionsForInvestment(investmentId)
  // The individual materiały rows for the Podsumowanie's wydatki list — same fetch the client share
  // read uses, so both surfaces label and split the rows identically.
  const materialTxPromise = fetchMaterialTransactionsForInvestment(investmentId)
  // Folded into the same Promise.all as everything else so the 404 lookup runs concurrently with the
  // data fetches rather than gating them; its notFound() rejection propagates through Promise.all.
  const investmentPromise = requireInvestmentOr404(id)
  const [
    { investment, user },
    tree,
    financialsSource,
    refData,
    payouts,
    payoutTransactions,
    depositTransactions,
    materialTransactions,
  ] = await Promise.all([
    investmentPromise,
    treePromise,
    financialsPromise,
    fetchReferenceData(),
    payoutsPromise,
    payoutTxPromise,
    depositTxPromise,
    materialTxPromise,
  ])
  console.log(
    `[PERF] kosztorys_v2/${investmentId} 9-fetch fan-out ${elapsed()}ms ` +
      `(tree + financials source + referenceData + payouts + 3 transaction lists + investment)`,
  )
  const { financials, materialyBreakdown, settledBreakdown } = deriveWholeInvestmentFinancials(
    financialsSource,
    tree,
    refData.expenseCategories,
  )
  // Names join here (not in the cached query): resolve each worker id against reference data.
  // Sorting/totals live in the pure block helper.
  const payoutsByWorker = resolvePayoutWorkerNames(payouts, refData.workers)

  return (
    <KosztorysEditorV2
      investmentId={investmentId}
      tree={tree}
      investmentName={investment.name}
      materialsGrossBase={financials.materialsGrossBase}
      materialsNetBilled={financials.materialsNetBilled}
      materialyBreakdown={materialyBreakdown}
      settledBreakdown={settledBreakdown}
      financials={isAdminOrOwnerRole(user.role) ? financials : undefined}
      // Transaction-sourced robocizna/rabat (Σ LABOR_COST / Σ RABAT) for the in-editor reconciliation
      // scream — compared against the kosztorys figures during the population/verification transition.
      laborCostsNetFromTransactions={financials.totalLaborCosts}
      investmentRabat={financials.totalRabat}
      payoutsByWorker={payoutsByWorker}
      payoutTransactions={payoutTransactions}
      depositTransactions={depositTransactions}
      materialTransactions={materialTransactions}
      workers={refData.workers}
    />
  )
}
