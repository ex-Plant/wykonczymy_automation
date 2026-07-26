import { getKosztorysTree } from '@/lib/queries/kosztorys'
import {
  fetchDepositTransactionsForInvestment,
  fetchPayoutsByWorkerForInvestment,
} from '@/lib/queries/reference-data'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { kosztorysClientTotals, subcontractorDueByPlane } from '@/lib/kosztorys/settlement'
import { resolvePayoutWorkerNames } from '@/lib/kosztorys/subcontractor-summary'
import { buildKosztorysReconciliation } from '@/lib/kosztorys/reconciliation'
import { readingFromKosztorys, readingFromTransactions } from '@/lib/kosztorys/summary-reading'
import { buildMaterialyBreakdown } from '@/lib/db/map-category-costs'
import { InvestmentSummaryPanelClient } from '@/components/investments/investment-summary-panel-client'
import type { InvestmentFinancialsT } from '@/types/investment-financials'
import type { CategoryCostT } from '@/types/investment-financials'
import type { ExpenseCategoryRefT, WorkerRefT } from '@/types/reference-data'

type PropsT = {
  investmentId: number
  investmentName: string
  financials: InvestmentFinancialsT
  expenseCategories: ExpenseCategoryRefT[]
  netCategoryCosts: CategoryCostT[]
  // Relayed from the page's own fetchReferenceData rather than re-read here: the panel needs nothing
  // else off that company-wide payload.
  workers: WorkerRefT[]
}

// Everything the v2 reading needs — both fetches and every derivation — is owned here rather than by
// the page, so the v1 reading runs the exact query set and computations it ran before this panel
// existed. Rendered behind <Suspense>; the tree is the page's long-pole query.
export async function InvestmentSummaryPanel({
  investmentId,
  investmentName,
  financials,
  expenseCategories,
  netCategoryCosts,
  workers,
}: PropsT) {
  const [tree, depositTransactions, payouts] = await Promise.all([
    getKosztorysTree(investmentId),
    // Same cached fetcher the kosztorys page uses, so both surfaces read wpłaty from one source.
    fetchDepositTransactionsForInvestment(investmentId),
    // Realized PAYOUTs per worker — the „Podwykonawcy" view's zaliczki side.
    fetchPayoutsByWorkerForInvestment(investmentId),
  ])

  const rows = treeToRows(tree)
  // No kosztorys rows ⇒ the transaction reading: there is no kosztorys to read from.
  const clientTotals =
    rows.length === 0 ? null : kosztorysClientTotals(rows, tree.stages, tree.globalDiscount)
  const reading = clientTotals
    ? readingFromKosztorys(clientTotals)
    : readingFromTransactions(financials)

  // „Wpłaty" = only INVESTOR_DEPOSIT rows, mirroring the kosztorys page — the same base the panel's
  // plane buckets and „Do zapłaty" draw from.
  const wplatyNet = depositTransactions.reduce((sum, deposit) => sum + deposit.amount, 0)

  return (
    <InvestmentSummaryPanelClient
      investmentId={investmentId}
      investmentName={investmentName}
      depositTransactions={depositTransactions}
      materialsGrossBase={financials.materialsGrossBase}
      materialsNetBilled={financials.materialsNetBilled}
      materialyBreakdown={buildMaterialyBreakdown(financials, expenseCategories, netCategoryCosts)}
      wplatyNet={wplatyNet}
      {...reading}
      // Nothing to reconcile without a kosztorys: feeding the transaction figures to both sides keeps
      // the verdict silent rather than screaming a gap against an empty kosztorys.
      reconciliation={buildKosztorysReconciliation({
        sumaPracNet: clientTotals?.sumaPracNet ?? financials.totalLaborCosts,
        rabatClientNet: clientTotals?.rabatClientNet ?? financials.totalRabat,
        laborCostsNetFromTransactions: financials.totalLaborCosts,
        investmentRabat: financials.totalRabat,
      })}
      // The subcontractor plane — computed here from the same rows the client settlement reads, so
      // the two views can't disagree about what was executed. No payout list on this host: the
      // transfers table below already carries every wypłata.
      subcontractorDue={subcontractorDueByPlane(rows, tree.stages)}
      payoutsByWorker={resolvePayoutWorkerNames(payouts, workers)}
      vatRate={tree.vatRate}
      settlementMode={tree.settlementMode}
    />
  )
}
