import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { calculateMargin } from '@/lib/db/calculate-margin'
import { buildFinancialFields } from '@/lib/db/map-category-costs'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { kosztorysClientTotals } from '@/lib/kosztorys/settlement'
import { financialsFromKosztorys } from '@/lib/kosztorys/kosztorys-driven-financials'
import { FinancialStats } from '@/components/investments/financial-stats'
import { StatsVersionToggle } from '@/components/investments/stats-version-toggle'
import type { FinancialFieldT } from '@/types/export'
import type { InvestmentFinancialsT } from '@/types/investment-financials'

type PropsT = {
  investmentId: number
  financials: InvestmentFinancialsT
  expenseCategories: { id: number; name: string }[]
  settledFields: FinancialFieldT[]
}

// Async server component owning the whole financial header: v1 is the transaction-driven reading,
// v2 the same block with robocizna and rabat taken from the kosztorys. Rendered behind <Suspense>
// (fallback = the bare v1 block) so the tree fetch — the page's long-pole query — stays off the
// critical render path.
//
// No kosztorys rows ⇒ v1 alone, with no toggle: there is no second reading to offer.
export async function InvestmentStatsVersions({
  investmentId,
  financials,
  expenseCategories,
  settledFields,
}: PropsT) {
  const tree = await getKosztorysTree(investmentId)
  const rows = treeToRows(tree)

  // `hideZeroCosts` is v2-only on purpose: v1 keeps the full, stable tile set it has always shown,
  // so the two readings stay comparable tile-for-tile wherever there is actually spend.
  const statsFor = (versionFinancials: InvestmentFinancialsT, hideZeroCosts = false) => (
    <FinancialStats
      fields={buildFinancialFields(versionFinancials, expenseCategories, { hideZeroCosts })}
      margin={calculateMargin(versionFinancials)}
      totalPayouts={versionFinancials.totalPayouts}
      totalLoss={versionFinancials.totalLoss}
      settledFields={settledFields}
    />
  )

  if (rows.length === 0) return statsFor(financials)

  const clientTotals = kosztorysClientTotals(rows, tree.stages, tree.globalDiscount)
  const kosztorysFinancials = financialsFromKosztorys(financials, clientTotals)

  return <StatsVersionToggle v1={statsFor(financials)} v2={statsFor(kosztorysFinancials, true)} />
}
