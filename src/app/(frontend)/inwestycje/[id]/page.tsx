import { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { parsePagination } from '@/lib/utils/pagination'
import {
  fetchReferenceData,
  fetchFilteredByType,
  fetchCategoryBreakdowns,
  fetchDepositTransactionsForInvestment,
} from '@/lib/queries/reference-data'
import { deriveFinancials } from '@/lib/db/sum-transfers'
import { calculateMargin } from '@/lib/db/calculate-margin'
import { InvestmentSummaryPanel } from '@/components/investments/investment-summary-panel'
import { InvestmentSummaryPanelClient } from '@/components/investments/investment-summary-panel-client'
import { buildKosztorysReconciliation } from '@/lib/kosztorys/reconciliation'
import { DEFAULT_VAT } from '@/lib/kosztorys/constants'
import { SETTLEMENT_MODE_DEFAULT } from '@/lib/kosztorys/settlement-mode'
import { buildTransferFilters, stripCancelledFilters } from '@/lib/queries/transfer-filters'
import {
  buildFinancialFields,
  buildMaterialyBreakdown,
  buildSettledFields,
} from '@/lib/db/map-category-costs'
import { perfStart } from '@/lib/perf'
import { buildFilterConfig } from '@/lib/utils/build-filter-config'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { InfoList } from '@/components/ui/info-list'
import { ContactLink } from '@/components/ui/contact-link'
import { FinancialStats } from '@/components/investments/financial-stats'
import { STATUS_LABELS } from '@/components/investments/investment-status-badge'
import { EditInvestmentDialog } from '@/components/dialogs/edit-investment-dialog'
import { SheetButton } from '@/components/dialogs/sheet-button'
import { OpenKosztorysV2Button } from '@/components/kosztorys/open-kosztorys-v2-button'
import type { HeaderFieldT } from '@/types/export'
import type { DynamicPagePropsT } from '@/types/page'

export default async function InvestmentDetailPage({ params, searchParams }: DynamicPagePropsT) {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/zaloguj')
  const { user } = session

  const step = perfStart()

  const { id } = await params
  const sp = await searchParams
  const { page, limit } = parsePagination(sp)

  const investmentId = Number(id)
  const urlFilters = buildTransferFilters(sp, { id: user.id })
  const transferWhere = { ...urlFilters, investment: { equals: investmentId } }

  // Stats ignore cancelled toggle — SQL already excludes cancelled via hardcoded WHERE clause
  const statsWhere = stripCancelledFilters(transferWhere)

  const [refData, typeDistribution, breakdowns, depositTransactions] = await Promise.all([
    fetchReferenceData(),
    fetchFilteredByType(statsWhere),
    fetchCategoryBreakdowns(statsWhere),
    // Same cached fetcher the kosztorys page uses, so both surfaces read wpłaty from one source.
    fetchDepositTransactionsForInvestment(investmentId),
  ])
  console.log(`[PERF] inwestycje/${id} data fetch ${step()}ms`)

  const investment = refData.investments.find((inv) => inv.id === investmentId)
  if (!investment) notFound()

  const financials = deriveFinancials(
    typeDistribution,
    breakdowns.categoryCosts,
    breakdowns.settledCategoryCosts,
  )

  const financialFields = buildFinancialFields(financials, refData.expenseCategories)
  const settledFields = buildSettledFields(
    financials.settledCategoryCosts,
    refData.expenseCategories,
  )
  const headerFields: HeaderFieldT[] = [
    { label: 'Inwestycja', value: investment.name },
    ...financialFields,
  ]
  const materialyBreakdown = buildMaterialyBreakdown(
    financials,
    refData.expenseCategories,
    breakdowns.netCategoryCosts,
  )
  // „Wpłaty" = only INVESTOR_DEPOSIT rows, mirroring the kosztorys page — the same base the panel's
  // plane buckets and „Do zapłaty" draw from.
  const wplatyNet = depositTransactions.reduce((sum, deposit) => sum + deposit.amount, 0)
  const vatRate = investment.vatRate ?? DEFAULT_VAT
  const settlementMode = investment.settlementMode ?? SETTLEMENT_MODE_DEFAULT

  const infoFields = [
    { label: 'Adres', value: investment.address },
    { label: 'Telefon', value: <ContactLink type="phone" value={investment.phone} /> },
    { label: 'Email', value: <ContactLink type="email" value={investment.email} /> },
    { label: 'Osoba kontaktowa', value: investment.contactPerson },
    { label: 'Notatki', value: investment.notes },
    { label: 'Opinia', value: investment.review || '—' },
    { label: 'Status', value: STATUS_LABELS[investment.status] },
  ]

  return (
    <PageWrapper title={investment.name}>
      <div className="flex flex-wrap items-center gap-2">
        <EditInvestmentDialog investment={investment} />
        <SheetButton investmentId={investmentId} hasSheet={investment.hasSheet} />
        <OpenKosztorysV2Button investmentId={investmentId} />
      </div>
      <InfoList items={infoFields.filter((f) => f.value)} />

      <FinancialStats
        fields={financialFields}
        margin={calculateMargin(financials)}
        totalPayouts={financials.totalPayouts}
        totalLoss={financials.totalLoss}
        settledFields={settledFields}
      />

      <CollapsibleSection title="Podsumowanie">
        {/* Streamed off the critical path: only this block awaits the kosztorys tree (the page's
            long-pole fetch), so until it lands the fallback shows the same panel on the
            transaction-driven figures. */}
        <Suspense
          fallback={
            <InvestmentSummaryPanelClient
              investmentId={investmentId}
              investmentName={investment.name}
              depositTransactions={depositTransactions}
              laborCostsNetFromKosztorys={financials.totalLaborCosts - financials.totalRabat}
              materialsGrossBase={financials.materialsGrossBase}
              materialsNetBilled={financials.materialsNetBilled}
              materialyBreakdown={materialyBreakdown}
              wplatyNet={wplatyNet}
              rabatAmount={financials.totalRabat}
              reconciliation={buildKosztorysReconciliation({
                sumaPracNet: financials.totalLaborCosts,
                rabatClientNet: financials.totalRabat,
                laborCostsNetFromTransactions: financials.totalLaborCosts,
                investmentRabat: financials.totalRabat,
              })}
              vatRate={vatRate}
              settlementMode={settlementMode}
            />
          }
        >
          <InvestmentSummaryPanel
            investmentId={investmentId}
            investmentName={investment.name}
            financials={financials}
            materialyBreakdown={materialyBreakdown}
            depositTransactions={depositTransactions}
            wplatyNet={wplatyNet}
            vatRate={vatRate}
            settlementMode={settlementMode}
          />
        </Suspense>
      </CollapsibleSection>

      {/* Transactions table */}
      <TransfersSection
        config={{
          query: { where: transferWhere, page, limit },
          baseUrl: `/inwestycje/${id}`,
          excludeColumns: ['investment'],
          filters: buildFilterConfig(refData, 'investments'),
          context: 'investment',
          contextId: investmentId,
          headerFields,
          totalPayouts: financials.totalPayouts,
          cancelledTransactionAudit: sp.cancelledTransactionAudit === '1',
        }}
      />
    </PageWrapper>
  )
}
