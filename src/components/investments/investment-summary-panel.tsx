import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { kosztorysClientTotals } from '@/lib/kosztorys/settlement'
import { buildKosztorysReconciliation } from '@/lib/kosztorys/reconciliation'
import { InvestmentSummaryPanelClient } from '@/components/investments/investment-summary-panel-client'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import type { InvestmentFinancialsT, MaterialyBreakdownRowT } from '@/types/investment-financials'
import type { DepositTransactionRowT } from '@/types/reference-data'

type PropsT = {
  investmentId: number
  investmentName: string
  financials: InvestmentFinancialsT
  materialyBreakdown: MaterialyBreakdownRowT[]
  depositTransactions: DepositTransactionRowT[]
  wplatyNet: number
  vatRate: number
  settlementMode: SettlementModeT
}

// Async server component owning the panel's kosztorys reading. Rendered behind <Suspense> (fallback
// = the same panel on the transaction figures) so the tree fetch — the page's long-pole query —
// stays off the critical render path.
//
// No kosztorys rows ⇒ the transaction reading alone: there is no second reading to offer.
export async function InvestmentSummaryPanel({
  investmentId,
  investmentName,
  financials,
  materialyBreakdown,
  depositTransactions,
  wplatyNet,
  vatRate,
  settlementMode,
}: PropsT) {
  const tree = await getKosztorysTree(investmentId)
  const rows = treeToRows(tree)
  const clientTotals =
    rows.length === 0 ? null : kosztorysClientTotals(rows, tree.stages, tree.globalDiscount)

  // The panel's robocizna figure is POST-rabat and its rabat is carried alongside — the pie adds them
  // back (`sumaPracPreRabat`). Σ LABOR_COST is pre-rabat like `sumaPracNet`, so the transaction
  // reading subtracts Σ RABAT to land on the same axis the kosztorys reading uses.
  const laborCostsNetFromKosztorys = clientTotals
    ? clientTotals.sumaPracNet - clientTotals.rabatClientNet
    : financials.totalLaborCosts - financials.totalRabat

  return (
    <InvestmentSummaryPanelClient
      investmentId={investmentId}
      investmentName={investmentName}
      depositTransactions={depositTransactions}
      laborCostsNetFromKosztorys={laborCostsNetFromKosztorys}
      materialsGrossBase={financials.materialsGrossBase}
      materialsNetBilled={financials.materialsNetBilled}
      materialyBreakdown={materialyBreakdown}
      wplatyNet={wplatyNet}
      rabatAmount={clientTotals?.rabatClientNet ?? financials.totalRabat}
      // Nothing to reconcile without a kosztorys: feeding the transaction figures to both sides keeps
      // the verdict silent rather than screaming a gap against an empty kosztorys.
      reconciliation={buildKosztorysReconciliation({
        sumaPracNet: clientTotals?.sumaPracNet ?? financials.totalLaborCosts,
        rabatClientNet: clientTotals?.rabatClientNet ?? financials.totalRabat,
        laborCostsNetFromTransactions: financials.totalLaborCosts,
        investmentRabat: financials.totalRabat,
      })}
      vatRate={vatRate}
      settlementMode={settlementMode}
    />
  )
}
