import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { ADMIN_OR_OWNER_ROLES } from '@/lib/auth/roles'
import { parsePagination } from '@/lib/utils/pagination'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { fetchFilteredByType, fetchCategoryBreakdowns } from '@/lib/queries/transfer-totals'
import { deriveFinancials } from '@/lib/db/sum-transfers'
import { calculateMargin } from '@/lib/db/calculate-margin'
import { buildTransferFilters, stripCancelledFilters } from '@/lib/queries/transfer-filters'
import { buildFinancialFields, buildSettledFields } from '@/lib/queries/investment-financial-fields'
import { perfStart } from '@/lib/perf'
import { buildFilterConfig } from '@/lib/utils/build-filter-config'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { FinancialStats } from '@/components/investments/financial-stats'
import { WarningBanner } from '@/components/ui/warning-banner'
import type { PagePropsT } from '@/types/page'

export default async function TransactionsReportPage({ searchParams }: PagePropsT) {
  const session = await requireAuth(ADMIN_OR_OWNER_ROLES)
  if (!session.success) redirect('/zaloguj')
  const { user } = session

  const step = perfStart()

  const sp = await searchParams
  const { page, limit } = parsePagination(sp)

  const urlFilters = buildTransferFilters(sp, { id: user.id })

  // Stats ignore cancelled toggle — SQL already excludes cancelled via hardcoded WHERE clause
  const statsWhere = stripCancelledFilters(urlFilters)

  const [refData, typeDistribution, breakdowns] = await Promise.all([
    fetchReferenceData(),
    fetchFilteredByType(statsWhere),
    fetchCategoryBreakdowns(statsWhere),
  ])
  console.log(`[PERF] raporty data fetch ${step()}ms`)

  // No rate/mode: this is an aggregate across investments, which have no single rate between them.
  // The netto subset still travels, because the type promises it always accompanies `categoryCosts`
  // — a reader that later prices these categories would otherwise bill the netto rows a second time.
  const financials = deriveFinancials(
    typeDistribution,
    breakdowns.categoryCosts,
    breakdowns.settledCategoryCosts,
    undefined,
    undefined,
    breakdowns.netCategoryCosts,
  )

  const financialFields = buildFinancialFields(financials, refData.expenseCategories)
  const settledFields = buildSettledFields(
    financials.settledCategoryCosts,
    refData.expenseCategories,
  )
  return (
    <PageWrapper title="Raporty">
      {/* The report aggregates many investments at once, so there is no single netto rate to apply —
          the discount is per-investment and is simply left out here. That makes Marża and Bilans
          disagree with the same figures on each investment's own page, so say it out loud rather than
          serve a number nobody can reconcile. Remove this banner together with EX-598. */}
      <WarningBanner>
        Marża i bilans nie uwzględniają obniżek za rozliczanie wydatków po kwocie netto, więc nie
        zgadzają się z sumą wartości z kart poszczególnych inwestycji.
      </WarningBanner>

      <FinancialStats
        fields={financialFields}
        margin={calculateMargin(financials)}
        totalPayouts={financials.totalPayouts}
        settledFields={settledFields}
      />

      <TransfersSection
        config={{
          query: { where: urlFilters, page, limit },
          baseUrl: '/raporty',
          filters: buildFilterConfig(refData),
          invoiceDownload: true,
          cancelledTransactionAudit: sp.cancelledTransactionAudit === '1',
        }}
      />
    </PageWrapper>
  )
}
