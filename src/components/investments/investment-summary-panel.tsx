import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { perfStart } from '@/lib/perf'
import { fetchFilteredDepositTransactions } from '@/lib/queries/investment-transactions'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { kosztorysClientTotals } from '@/lib/kosztorys/settlement'
import { buildKosztorysReconciliation } from '@/lib/kosztorys/reconciliation'
import { readingFromKosztorys, readingFromTransactions } from '@/lib/kosztorys/summary-reading'
import { buildMaterialyBreakdown, buildSettledBreakdown } from '@/lib/db/map-category-costs'
import { SummaryPanelContent } from '@/components/kosztorys/summary/summary-panel-content'
import type { SummaryViewT } from '@/components/kosztorys/summary/hooks/use-summary-view'
import type { Where } from 'payload'
import type { InvestmentFinancialsT } from '@/types/investment-financials'
import type { CategoryCostT } from '@/types/investment-financials'
import type { ExpenseCategoryRefT } from '@/types/reference-data'

// Robocizna (etapy) stays editor-only — it needs the stage grid to make sense. Podwykonawcy is
// dropped for the opposite reason: the transfers table below this panel already lists every wypłata
// — as it does every wpłata, which is why `showTransactionLists={false}` also folds the wpłaty block
// out of Podsumowanie here. Marża renders only when the page hands the panel `financials`, which it
// does for ADMIN/OWNER only.
//
// Scope rule on this host (EX-600): every transaction-plane figure — materiały, marża and wpłaty —
// reads the page's `transferWhere`, so it follows the URL filters, while the kosztorys plane stays
// whole. `filtersActive` is what tells the content to mark that seam.
const INVESTMENT_PANEL_VIEWS: SummaryViewT[] = ['summary', 'expenses', 'margin']

type PropsT = {
  investmentId: number
  investmentName: string
  // The page's stats scope (URL filters + this investment) — the same `Where` behind `financials`,
  // so wpłaty narrow with the rest of the transaction plane instead of reading the whole investment.
  statsWhere: Where
  filtersActive: boolean
  financials: InvestmentFinancialsT
  // ADMIN/OWNER only. Gates whether `financials` crosses into the client component at all — the
  // „Marża" tab's figures must stay out of a MANAGER's RSC payload, not merely off their screen.
  canSeeMargin: boolean
  expenseCategories: ExpenseCategoryRefT[]
  netCategoryCosts: CategoryCostT[]
}

// Everything the v2 reading needs — both fetches and every derivation — is owned here rather than by
// the page, so the v1 reading runs the exact query set and computations it ran before this panel
// existed. Rendered behind <Suspense>; the tree is the page's long-pole query.
export async function InvestmentSummaryPanel({
  investmentId,
  investmentName,
  statsWhere,
  filtersActive,
  financials,
  canSeeMargin,
  expenseCategories,
  netCategoryCosts,
}: PropsT) {
  const elapsed = perfStart()
  const [tree, depositTransactions] = await Promise.all([
    getKosztorysTree(investmentId),
    fetchFilteredDepositTransactions(statsWhere),
  ])
  const fetchMs = elapsed()

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
      materialyBreakdown={buildMaterialyBreakdown(financials, expenseCategories, netCategoryCosts)}
      settledBreakdown={buildSettledBreakdown(financials.settledCategoryCosts, expenseCategories)}
      wplatyNet={wplatyNet}
      financials={canSeeMargin ? financials : undefined}
      {...reading}
      // Nothing to reconcile without a kosztorys: feeding the transaction figures to both sides keeps
      // the verdict silent rather than screaming a gap against an empty kosztorys.
      reconciliation={buildKosztorysReconciliation({
        sumaPracNet: clientTotals?.sumaPracNet ?? financials.totalLaborCosts,
        rabatClientNet: clientTotals?.rabatClientNet ?? financials.totalRabat,
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
      // Without a kosztorys the reading falls back to the transaction plane, where every figure DOES
      // follow the filters — marking them would assert the opposite of the truth.
      filtersActive={filtersActive && clientTotals !== null}
    />
  )
}
