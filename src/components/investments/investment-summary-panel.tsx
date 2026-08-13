import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { perfStart } from '@/lib/perf'
import { fetchDepositTransactionsForInvestment } from '@/lib/queries/investment-transactions'
import {
  deriveWholeInvestmentFinancials,
  fetchWholeInvestmentFinancials,
} from '@/lib/queries/whole-investment-financials'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { kosztorysClientTotals } from '@/lib/kosztorys/settlement-client-totals'
import { buildKosztorysReconciliation } from '@/lib/kosztorys/reconciliation'
import { readingFromKosztorys } from '@/lib/kosztorys/summary-reading'
import { SummaryPanelContent } from '@/components/kosztorys/summary/summary-panel-content'
import type { SummaryViewT } from '@/components/kosztorys/summary/hooks/use-summary-view'
import type { ExpenseCategoryRefT } from '@/types/reference-data'

// Robocizna (etapy) stays editor-only — it needs the stage grid to make sense. Podwykonawcy is
// dropped for the opposite reason: the transfers table below this panel already lists every wypłata
// — as it does every wpłata, which is why `showTransactionLists={false}` also folds the wpłaty block
// out of Podsumowanie here. Marża renders for ADMIN/OWNER only.
//
// Scope rule on this host: every figure reports the WHOLE investment, so the panel scopes its own
// transaction-plane fetches to `{ investment }` and never sees the page's URL filters. The transfers
// table's own „Suma wybranych transakcji" is the one surface answering the filtered question.
const INVESTMENT_PANEL_VIEWS: SummaryViewT[] = ['summary', 'expenses', 'margin']

type PropsT = {
  investmentId: number
  investmentName: string
  // ADMIN/OWNER only. Gates whether `financials` crosses into the client component at all — the
  // „Marża" tab's figures must stay out of a MANAGER's RSC payload, not merely off their screen.
  canSeeMargin: boolean
  expenseCategories: ExpenseCategoryRefT[]
}

// Every fetch and derivation the v2 reading needs is owned here rather than by the page, so the v1
// reading keeps the exact query set and computations it ran before this panel existed.
export async function InvestmentSummaryPanel({
  investmentId,
  investmentName,
  canSeeMargin,
  expenseCategories,
}: PropsT) {
  const elapsed = perfStart()
  const [tree, depositTransactions, financialsSource] = await Promise.all([
    getKosztorysTree(investmentId),
    fetchDepositTransactionsForInvestment(investmentId),
    fetchWholeInvestmentFinancials(investmentId),
  ])
  const fetchMs = elapsed()

  const { financials, materialyBreakdown, settledBreakdown } = deriveWholeInvestmentFinancials(
    financialsSource,
    tree,
    expenseCategories,
  )

  const rows = treeToRows(tree)
  const clientTotals = kosztorysClientTotals(rows, tree.stages, tree.globalDiscount)
  const reading = readingFromKosztorys(clientTotals)

  // `derive` is the whole-tree → two-numbers reduction (treeToRows + kosztorysClientTotals). Logged
  // next to the row count it consumed, because that ratio is the argument for aggregating in SQL.
  const deriveMs = elapsed()
  console.log(
    `[PERF] InvestmentSummaryPanel ${fetchMs + deriveMs}ms ` +
      `(fetch ${fetchMs}ms, derive ${deriveMs}ms) [${rows.length} rows → sumaPracNet + rabatClientNet]`,
  )

  return (
    <SummaryPanelContent
      investmentId={investmentId}
      investmentName={investmentName}
      depositTransactions={depositTransactions}
      materialsGrossBase={financials.materialsGrossBase}
      materialsNetBilled={financials.materialsNetBilled}
      materialyBreakdown={materialyBreakdown}
      settledBreakdown={settledBreakdown}
      financials={canSeeMargin ? financials : undefined}
      // Its own prop, deliberately outside the `financials` gate above: a strata lowers what the
      // client owes, so every reader of the settlement must see it — only the marża figures are
      // owner-only.
      lossAmount={financials.totalLoss}
      {...reading}
      // An empty kosztorys against booked transfers is a REAL gap, not noise: it is legacy robocizna
      // nobody has entered here yet. It screams until someone does.
      reconciliation={buildKosztorysReconciliation({
        sumaPracNet: clientTotals.sumaPracNet,
        rabatClientNet: clientTotals.rabatClientNet,
        laborCostsNetFromTransactions: financials.totalLaborCosts,
        investmentRabat: financials.totalRabat,
      })}
      vatRate={tree.vatRate}
      settlementMode={tree.settlementMode}
      materialsNetRate={tree.materialsNetRate}
      // No writers passed on purpose: these settings are edited in the kosztorys editor only, so
      // this panel renders no settings trigger at all. That also keeps every write off the one
      // route that renders the transfers table, which a route-wide re-render would rebuild.
      views={INVESTMENT_PANEL_VIEWS}
      showTransactionLists={false}
      showPies={false}
    />
  )
}
