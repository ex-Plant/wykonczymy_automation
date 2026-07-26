'use client'

import { useState, type ReactNode } from 'react'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import {
  settlementModeToGridAxis,
  settlementModeToPanelAxis,
  type SettlementModeT,
} from '@/lib/kosztorys/settlement-mode'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import {
  bucketDepositsByPlane,
  computeDoZaplatyRM,
  type MaterialsT,
} from '@/lib/kosztorys/summary-economics'
import type { SubcontractorDueByPlaneT } from '@/lib/kosztorys/settlement'
import { SummaryStagesTab } from '@/components/kosztorys/summary/tabs/summary-stages-tab'
import { SummaryOverviewTab } from '@/components/kosztorys/summary/tabs/summary-overview-tab'
import { SummaryExpensesTab } from '@/components/kosztorys/summary/tabs/summary-expenses-tab'
import { SummaryDepositsTab } from '@/components/kosztorys/summary/tabs/summary-deposits-tab'
import { SubcontractorSummary } from '@/components/kosztorys/summary/blocks/subcontractor-summary'
import { SummaryScrollRegion } from '@/components/ui/summary-grid'
import { SettlementModeSelect } from '@/components/kosztorys/summary/settlement-mode-select'
import {
  useSummaryView,
  type SummaryViewT,
} from '@/components/kosztorys/summary/hooks/use-summary-view'
import { useMaterialsNetPricing } from '@/components/kosztorys/summary/hooks/use-materials-net-pricing'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'
import {
  buildSettlementPlaneVerdict,
  type KosztorysReconciliationT,
} from '@/lib/kosztorys/reconciliation'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import type { SectionSliceInputT } from '@/lib/kosztorys/chart-slices'
import type {
  SubcontractorPayoutRowT,
  PayoutTransactionRowT,
  DepositTransactionRowT,
  MaterialTransactionRowT,
} from '@/types/reference-data'

const SUMMARY_VIEW_OPTIONS: OptionT<SummaryViewT>[] = [
  { value: 'summary', label: 'Podsumowanie' },
  { value: 'wydatki', label: 'Wydatki' },
  { value: 'wplaty', label: 'Wpłaty' },
  { value: 'etapy', label: 'Robocizna' },
  { value: 'podwykonawcy', label: 'Podwykonawcy' },
]

const ALL_SUMMARY_VIEWS = SUMMARY_VIEW_OPTIONS.map((option) => option.value)

type PropsT = {
  investmentId: number
  // Only reaches the wydatki list, which names its invoice archive after the investment.
  investmentName: string
  // Individual deposit rows — feed the client Podsumowanie's sortable wpłaty list AND the VAT-plane
  // buckets every view's settlement reads, so this one is required on every host.
  depositTransactions: DepositTransactionRowT[]
  // Robocizna wartość netto — executed total AFTER rabat; the Podsumowanie waterfall's base.
  laborCostsNetFromKosztorys: number
  // Materiały brutto — server sum of the investment's unsettled brutto-billed transactions.
  materialsGrossBase: number
  // Σ netAmount of the netto-billed wydatki — frozen: the netto pricing toggle must not touch it.
  materialsNetBilled: number
  // Per-expense-category split of both buckets (v1 parity); Σ === materiały billed total.
  materialyBreakdown: MaterialyBreakdownRowT[]
  // Investor's wpłaty (totalIncome — every deposit on the investment) — subtracted to reach the
  // still-owed „Do zapłaty" total.
  wplatyNet: number
  rabatAmount: number
  // Robocizna/rabat reconciliation verdict — drives the Podsumowanie mismatch scream. Always supplied
  // (every host computes it unconditionally); clientView suppresses the scream downstream, not by
  // withholding the verdict.
  reconciliation: KosztorysReconciliationT
  vatRate: number
  settlementMode: SettlementModeT
  onSettlementModeChange: (mode: SettlementModeT) => void
  // Which views this host offers, in toggle order. A host that omits a view need not supply the props
  // that only feed it — hence every prop below is optional.
  views?: SummaryViewT[]
  // Rendered in the pinned top bar beside the view toggle (the investment page's v1/v2 reading toggle).
  topBarSlot?: ReactNode
  // VAT + rabat globalny editing. Reads the editor context, so only a host inside
  // KosztorysEditorProvider may turn it on.
  showSettingsBar?: boolean
  // Off on a host that already lists every transaction next to the panel (the investment page's
  // transfers table): wydatki drops its materiały list, wpłaty keeps only the Razem buckets.
  showTransactionLists?: boolean
  // Read-only client render: gate the mismatch scream and render internal links as plain text.
  clientView?: boolean
  stages?: KosztorysStageT[]
  stageTotals?: Map<number, number>
  // Realized PAYOUTs per worker — feeds the subcontractor summary block (Z/Bez narzędzi views only).
  payoutsByWorker?: SubcontractorPayoutRowT[]
  // Individual realized PAYOUT rows — feed the subcontractor block's sortable wypłaty list.
  payoutTransactions?: PayoutTransactionRowT[]
  // Individual materiały rows — feed the wydatki tab's transaction list (data · typ · kwota).
  materialTransactions?: MaterialTransactionRowT[]
  // View-independent subcontractor settlement — each etap at its own plane's price, split + combined
  // + unconfirmed flag. The subcontractor block's headline figures. Ignored in the client view.
  subcontractorDue?: SubcontractorDueByPlaneT
  // Suma prac wykonanych — the executed total BEFORE rabat (Σ etap totals); EtapTotals' readout.
  totalNet?: number
  // Client-priced, view-invariant per-section subtotals — the section pie's structure source.
  sectionSubtotals?: SectionSliceInputT[]
}

// The portable body of the summary panel — pinned top bar + the scrolling view. Deliberately holds no
// shell: the editor wraps it in a bottom-anchored Collapsible overlay, the investment page in an
// ordinary section, and neither layout leaks in here.
export function SummaryPanelContent({
  investmentId,
  investmentName,
  depositTransactions,
  laborCostsNetFromKosztorys,
  materialsGrossBase,
  materialsNetBilled,
  materialyBreakdown,
  wplatyNet,
  rabatAmount,
  reconciliation,
  vatRate,
  settlementMode,
  onSettlementModeChange,
  views = ALL_SUMMARY_VIEWS,
  topBarSlot,
  showSettingsBar = false,
  showTransactionLists = true,
  clientView = false,
  stages,
  stageTotals,
  payoutsByWorker,
  payoutTransactions,
  materialTransactions,
  subcontractorDue,
  totalNet,
  sectionSubtotals,
}: PropsT) {
  const moneyAxis = settlementModeToPanelAxis(settlementMode)
  // Which view the panel shows — driven solely by the top toggle, fully independent of the grid's
  // price view (that only governs the grid columns now). „Podwykonawcy" is owner-only, so it drops out
  // of the client read-only toggle on top of whatever the host allowed. The persisted pick is shared
  // across hosts, so it can name a view this host doesn't offer — fall back to the first one it does,
  // rather than stranding the reader on a hidden view.
  const [summaryView, setSummaryView] = useSummaryView()
  const allowedViews = views.filter((value) => !(clientView && value === 'podwykonawcy'))
  const viewOptions = SUMMARY_VIEW_OPTIONS.filter((option) => allowedViews.includes(option.value))
  const view: SummaryViewT = allowedViews.includes(summaryView)
    ? summaryView
    : (allowedViews[0] ?? 'summary')
  const isSubcontractorView = view === 'podwykonawcy'
  // Wpłaty split by VAT plane for tryb mieszany: NET (+ unmarked) settle the netto section,
  // GROSS the brutto section. Derived from the deposit list, never typed.
  const { paidNet, paidGross } = bucketDepositsByPlane(depositTransactions)
  // Computed here, where the mode and the bucketed deposits already are; the tab renders the verdict
  // rather than deciding it.
  const settlementVerdict = buildSettlementPlaneVerdict({
    mode: settlementMode,
    paidNet,
    paidGross,
  })
  // The tables show one money column — the settled one. Mieszane is the exception: it's a mixed
  // netto+brutto settlement, so it shows both columns alongside the gotówka block. Same projection
  // the grid uses, so a table and a column can't disagree about what „Mieszane" means.
  const displayAxis: MoneyAxisT = settlementModeToGridAxis(settlementMode)
  // Materiały netto pricing: when on, netto = brutto − VAT (the historical default); when off,
  // materiały stay at their raw brutto amount on both axes. Only moves netto figures, so the toggle
  // is offered only where netto is on show and there are materiały to reprice.
  const [materialsAsNet, setMaterialsAsNet] = useMaterialsNetPricing()
  const nettoShown = moneyAxis !== 'gross'
  const vatPercent = Math.round(vatRate * 100)
  // Temporary client-side experiment (server-persisted later, so the transactions balance can
  // reconcile): by how many % to knock brutto down to reach materiały netto. Seeded from the VAT
  // rate, then the owner moves it to test whether a straight brutto reduction is the right model.
  const [materialsReductionPercent, setMaterialsReductionPercent] = useState(vatPercent)
  const materialsReduction = materialsReductionPercent / 100
  // Computed here and passed down: the collapsed headline and the Podsumowanie row show the same
  // „Do zapłaty", so it has one source rather than two calls that must be kept in step.
  const materials: MaterialsT = { grossBase: materialsGrossBase, netBilled: materialsNetBilled }
  const doZaplaty = computeDoZaplatyRM(
    laborCostsNetFromKosztorys,
    wplatyNet,
    materials,
    vatRate,
    materialsAsNet,
    materialsReduction,
  )
  return (
    <>
      {/* Pinned top bar — the view toggle stays visible while the content scrolls below it. */}
      <div className="flex flex-col items-start gap-2 px-4 pt-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ToggleGroup
            options={viewOptions}
            value={view}
            onChange={setSummaryView}
            aria-label="Widok podsumowania"
          />
          {topBarSlot}
        </div>
        {/* A client reads the mode, never writes it — the same `clientView` gate every other
            owner-only affordance in this panel uses. */}
        {!isSubcontractorView && !clientView && (
          <SettlementModeSelect
            value={settlementMode}
            onChange={onSettlementModeChange}
            vatRate={vatRate}
          />
        )}
      </div>
      <SummaryScrollRegion>
        {isSubcontractorView && subcontractorDue ? (
          <SubcontractorSummary
            investmentId={investmentId}
            subcontractorDue={subcontractorDue}
            payouts={payoutsByWorker ?? []}
            payoutTransactions={payoutTransactions ?? []}
          />
        ) : (
          <div className="flex w-full flex-col gap-y-4 px-4 pt-4 pb-10">
            {view === 'summary' && (
              <SummaryOverviewTab
                investmentId={investmentId}
                moneyAxis={moneyAxis}
                laborCostsNetFromKosztorys={laborCostsNetFromKosztorys}
                doZaplaty={doZaplaty}
                materials={materials}
                wplatyNet={wplatyNet}
                rabatAmount={rabatAmount}
                reconciliation={reconciliation}
                settlementVerdict={settlementVerdict}
                priceView="client"
                vatRate={vatRate}
                deriveMaterialsNet={materialsAsNet}
                materialsReduction={materialsReduction}
                paidNet={paidNet}
                paidGross={paidGross}
                showSettingsBar={showSettingsBar}
                clientView={clientView}
              />
            )}
            {view === 'wydatki' && (
              <SummaryExpensesTab
                investmentId={investmentId}
                investmentName={investmentName}
                materials={materials}
                materialyBreakdown={materialyBreakdown}
                materialTransactions={materialTransactions ?? []}
                nettoShown={nettoShown}
                materialsAsNet={materialsAsNet}
                onMaterialsAsNetChange={setMaterialsAsNet}
                materialsReductionPercent={materialsReductionPercent}
                onMaterialsReductionPercentChange={setMaterialsReductionPercent}
                clientView={clientView}
                showTransactions={showTransactionLists}
              />
            )}

            {view === 'wplaty' && (
              <SummaryDepositsTab
                investmentId={investmentId}
                rows={depositTransactions}
                paidNet={paidNet}
                paidGross={paidGross}
                clientView={clientView}
                totalsOnly={!showTransactionLists}
              />
            )}
            {view === 'etapy' && stages && stageTotals && (
              <SummaryStagesTab
                stages={stages}
                stageTotals={stageTotals}
                wykonaneNet={totalNet ?? 0}
                sectionSubtotals={sectionSubtotals ?? []}
                vatRate={vatRate}
                moneyAxis={displayAxis}
              />
            )}
          </div>
        )}
      </SummaryScrollRegion>
    </>
  )
}
