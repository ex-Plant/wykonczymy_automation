import { parseInvestmentId, requireInvestmentOr404 } from '@/lib/queries/investments'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import {
  fetchCategoryBreakdowns,
  fetchFilteredByType,
  fetchPayoutsByWorkerForInvestment,
  fetchPayoutTransactionsForInvestment,
  fetchDepositTransactionsForInvestment,
  fetchMaterialTransactionsForInvestment,
  fetchReferenceData,
} from '@/lib/queries/reference-data'
import { deriveFinancials } from '@/lib/db/sum-transfers'
import { resolvePayoutWorkerNames } from '@/lib/kosztorys/subcontractor-summary'
import { buildMaterialyBreakdown, buildSettledBreakdown } from '@/lib/db/map-category-costs'
import { KosztorysEditorV2 } from '@/components/kosztorys/editor/kosztorys-editor-v2'

// The in-app kosztorys editor ("kosztorys_v2"). Always available — every investment has one,
// the editor renders its own empty state. The legacy Google Sheet lives at /kosztorys.
export default async function InvestmentKosztorysV2Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const investmentId = parseInvestmentId(id)

  const investmentWhere = { investment: { equals: investmentId } }
  const treePromise = getKosztorysTree(investmentId)
  // Read-only bridge to the financial plane: the investment's live material spend (unsettled
  // INVESTMENT_EXPENSE + CORRECTION), summed via the same cached path the detail page uses.
  const financialsPromise = fetchFilteredByType(investmentWhere)
  // Per-expense-category split for the „Materiały" breakdown (v1 mirror parity).
  const breakdownsPromise = fetchCategoryBreakdowns(investmentWhere)
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
    { investment },
    tree,
    typeDistribution,
    breakdowns,
    refData,
    payouts,
    payoutTransactions,
    depositTransactions,
    materialTransactions,
  ] = await Promise.all([
    investmentPromise,
    treePromise,
    financialsPromise,
    breakdownsPromise,
    fetchReferenceData(),
    payoutsPromise,
    payoutTxPromise,
    depositTxPromise,
    materialTxPromise,
  ])
  // categoryCosts feed the Materiały split; settledCategoryCosts stay OUT of `financials` — the
  // „Materiały" breakdown figure mirrors v1, which counts unsettled only. They render as their own
  // company-plane table instead. (The wydatki LIST is a separate surface and carries both states.)
  const financials = deriveFinancials(typeDistribution, breakdowns.categoryCosts)
  // v1 client-facing „Materiały" split by expense category; Σ === totalMaterialCosts, so the
  // podsumowanie stays byte-identical to the investment page's materiały.
  const materialyBreakdown = buildMaterialyBreakdown(
    financials,
    refData.expenseCategories,
    breakdowns.netCategoryCosts,
  )
  // „Wpłaty" = only INVESTOR_DEPOSIT rows — the same base the deposit list, Wpłaty tab, plane pie,
  // and Mieszane draw (COMPANY_FUNDING / OTHER_DEPOSIT are legacy and stay out of client wpłaty, per
  // getDepositTransactionsForInvestment). Drives the podsumowanie „Wpłaty"/„Do zapłaty".
  const wplatyNet = depositTransactions.reduce((sum, deposit) => sum + deposit.amount, 0)
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
      settledBreakdown={buildSettledBreakdown(
        breakdowns.settledCategoryCosts,
        refData.expenseCategories,
      )}
      wplatyNet={wplatyNet}
      // Transaction-sourced robocizna/rabat (Σ LABOR_COST / Σ RABAT) for the in-editor reconciliation
      // scream — compared against the kosztorys figures during the population/verification transition.
      laborCostsNetFromTransactions={financials.totalLaborCosts}
      investmentRabat={financials.totalRabat}
      payoutsByWorker={payoutsByWorker}
      payoutTransactions={payoutTransactions}
      depositTransactions={depositTransactions}
      materialTransactions={materialTransactions}
    />
  )
}
