'use client'

import { useState, type ReactNode } from 'react'
import { effectiveMaterialsNetRate, type SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import {
  bucketDepositsByPlane,
  computeDoZaplatyRM,
  type MaterialsT,
} from '@/lib/kosztorys/summary-economics'
import type { SubcontractorDueByPlaneT } from '@/lib/kosztorys/subcontractor-due'
import { SummaryStagesTab } from '@/components/kosztorys/summary/tabs/summary-stages-tab'
import { SummaryOverviewTab } from '@/components/kosztorys/summary/tabs/summary-overview-tab'
import { SummaryExpensesTab } from '@/components/kosztorys/summary/tabs/summary-expenses-tab'
import { SubcontractorSummary } from '@/components/kosztorys/summary/blocks/subcontractor-summary'
import { SummaryMarginTab } from '@/components/kosztorys/summary/tabs/summary-margin-tab'
import { SummaryScrollRegion } from '@/components/ui/summary-grid'
import { SummaryInvestmentSettings } from '@/components/kosztorys/summary/summary-investment-settings'
import { MATERIALS_GROSS_LOCK_REASON } from '@/components/kosztorys/summary/materials-pricing-options'
import {
  useSummaryView,
  type SummaryViewT,
} from '@/components/kosztorys/summary/hooks/use-summary-view'
import type { InvestmentFinancialsT, MaterialyBreakdownRowT } from '@/types/investment-financials'
import {
  buildSettlementPlaneVerdict,
  type KosztorysReconciliationT,
} from '@/lib/kosztorys/reconciliation'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import type { SectionSliceInputT } from '@/lib/kosztorys/chart-slices'
import type { WorkerRefT } from '@/types/reference-data'
import type {
  SubcontractorPayoutRowT,
  PayoutTransactionRowT,
  DepositTransactionRowT,
  MaterialTransactionRowT,
} from '@/types/transfers'

const SUMMARY_VIEW_OPTIONS: OptionT<SummaryViewT>[] = [
  { value: 'summary', label: 'Podsumowanie' },
  { value: 'expenses', label: 'Materiały' },
  { value: 'stages', label: 'Robocizna' },
  { value: 'subcontractors', label: 'Podwykonawcy' },
  { value: 'margin', label: 'Marża' },
]

const ALL_SUMMARY_VIEWS = SUMMARY_VIEW_OPTIONS.map((option) => option.value)

type PropsT = {
  investmentId: number
  // Only reaches the wydatki list, which names its invoice archive after the investment.
  investmentName: string
  // Individual deposit rows — the wpłaty list, the VAT-plane buckets every view's settlement reads,
  // AND the wpłaty total, which is summed from them rather than supplied beside them (EX-680).
  depositTransactions: DepositTransactionRowT[]
  // Robocizna wartość netto — executed total AFTER rabat; the Podsumowanie waterfall's base.
  laborCostsNet: number
  // Materiały brutto — server sum of the investment's unsettled brutto-billed transactions.
  materialsGrossBase: number
  // Σ netAmount of the netto-billed wydatki — frozen: the netto pricing toggle must not touch it.
  materialsNetBilled: number
  // Per-expense-category split of both buckets (v1 parity); Σ === materiały billed total.
  materialyBreakdown: MaterialyBreakdownRowT[]
  // Company-plane material folded into robocizna, split per category — its own table in the wydatki
  // view. Omitted by the client share, which never builds it.
  settledBreakdown?: MaterialyBreakdownRowT[]
  rabatAmount: number
  // Robocizna/rabat reconciliation verdict — drives the Podsumowanie mismatch scream. Always supplied
  // (every host computes it unconditionally); preview suppresses the scream downstream, not by
  // withholding the verdict.
  reconciliation: KosztorysReconciliationT
  vatRate: number
  settlementMode: SettlementModeT
  // Optional because supplying them is what makes a host an *editor* of these settings. A host that
  // omits them renders the figures without the „Opcje rozliczenia" block — see the gate below.
  onSettlementModeChange?: (mode: SettlementModeT) => void
  // The investment's persisted materiały netto rate as a fraction; null = the concession is off.
  // Server-owned on purpose — the panel and the marża the server computed read one value.
  materialsNetRate: number | null
  onMaterialsNetRateChange?: (rate: number | null) => void
  // A settings write is in flight. None of them is optimistic — the server recomputes every figure
  // they move — so the block is disabled until the fresh values arrive.
  isSavingSettings?: boolean
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
  // Off on a host where the panel is one block among several rather than a full-height overlay (the
  // investment page): the share pies are the first thing worth dropping when vertical space is tight.
  showPies?: boolean
  // Read-only client render: gate the mismatch scream and render internal links as plain text.
  preview?: boolean
  stages?: KosztorysStageT[]
  stageTotals?: Map<number, number>
  // Realized PAYOUTs per worker — feeds the subcontractor summary block (Z/Bez narzędzi views only).
  payoutsByWorker?: SubcontractorPayoutRowT[]
  // Name lookup for a worker who holds etapy but has no wypłata yet (EX-613) — such a worker exists
  // only in the settlement's `byWorker`, which carries ids and no names.
  workers?: WorkerRefT[]
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
  // Company-plane transfer aggregates — feeds the „Marża" tab. Supplying it IS the visibility gate:
  // every host omits it for anyone but ADMIN/OWNER, and the client share never builds it at all.
  financials?: InvestmentFinancialsT
}

// Deliberately holds no shell: the editor wraps it in a bottom-anchored Collapsible overlay, the
// investment page in an ordinary section, and neither layout leaks in here.
export function SummaryPanelContent({
  investmentId,
  investmentName,
  depositTransactions,
  laborCostsNet,
  materialsGrossBase,
  materialsNetBilled,
  materialyBreakdown,
  settledBreakdown,
  rabatAmount,
  reconciliation,
  vatRate,
  settlementMode,
  onSettlementModeChange,
  materialsNetRate,
  onMaterialsNetRateChange,
  isSavingSettings = false,
  views = ALL_SUMMARY_VIEWS,
  topBarSlot,
  showSettingsBar = false,
  showTransactionLists = true,
  showPies = true,
  preview = false,
  stages,
  stageTotals,
  payoutsByWorker,
  workers,
  payoutTransactions,
  materialTransactions,
  subcontractorDue,
  totalNet,
  sectionSubtotals,
  financials,
}: PropsT) {
  // Which view the panel shows — driven solely by the top toggle, fully independent of the grid's
  // price view (that only governs the grid columns now). „Podwykonawcy" is owner-only, so it drops out
  // of the client read-only toggle on top of whatever the host allowed. The persisted pick is shared
  // across hosts, so it can name a view this host doesn't offer — fall back to the first one it does,
  // rather than stranding the reader on a hidden view.
  const [persistedView, setPersistedView] = useSummaryView()
  // A preview reads the same `table-columns:` localStorage family EX-591 keeps out of the client's
  // grid, so it gets session-local state instead of the persisted pick: the owner's last tab can't
  // decide which panel the client's document opens on. Still state, not a pin — the client switches
  // tabs freely, the choice just dies with the tab.
  const [sessionView, setSessionView] = useState<SummaryViewT>('summary')
  const summaryView = preview ? sessionView : persistedView
  const setSummaryView = preview ? setSessionView : setPersistedView
  // „Marża" rides entirely on `financials` being present, and the hosts only build it for ADMIN/OWNER
  // — so the figures never reach a non-owner's RSC payload, which a client-side role check could not
  // have achieved. This component reads no session on purpose: it also renders under (share), which
  // mounts no CurrentUserProvider.
  const allowedViews = views.filter((value) => {
    if (value === 'subcontractors') return !preview
    // TODO(EX-649): „Marża" is hidden until we agree what it measures — the tab sources the
    // transactions plane while sitting inside the kosztorys panel, which v2 is disconnected from, so
    // its „Robocizna" row is a different figure from the one edited two tabs over. Un-hiding is
    // deleting this line; the tab, calculateMargin and the `financials` plumbing are all untouched.
    // Restore with: return !preview && financials !== undefined
    if (value === 'margin') return false
    return true
  })
  const viewOptions = SUMMARY_VIEW_OPTIONS.filter((option) => allowedViews.includes(option.value))
  const view: SummaryViewT = allowedViews.includes(summaryView)
    ? summaryView
    : (allowedViews[0] ?? 'summary')
  const isSubcontractorView = view === 'subcontractors'
  // Wpłaty split by VAT plane for tryb mieszany: NET (+ unmarked) settle the netto section,
  // GROSS the brutto section. Derived from the deposit list, never typed.
  const {
    paidNet,
    paidGross,
    total: depositsTotal,
    taggedNet,
    taggedGross,
  } = bucketDepositsByPlane(depositTransactions)
  // Computed here, where the mode and the bucketed deposits already are; the tab renders the verdict
  // rather than deciding it.
  const settlementVerdict = buildSettlementPlaneVerdict({
    mode: settlementMode,
    taggedNet,
    taggedGross,
  })
  // The same gate the server applies to `materialsNetDiscount`, so both sides fall silent together
  // rather than the panel discounting a figure marża never saw.
  const effectiveNetRate = effectiveMaterialsNetRate(settlementMode, materialsNetRate)
  // Derived once for both surfaces that offer the choice: the popover and the Materiały tab print
  // this same lock, so they can never disagree about whether the choice is available.
  const pricingLockedReason = settlementMode === 'GROSS' ? MATERIALS_GROSS_LOCK_REASON : undefined
  const materials: MaterialsT = { grossBase: materialsGrossBase, netBilled: materialsNetBilled }
  const doZaplaty = computeDoZaplatyRM(
    laborCostsNet,
    depositsTotal,
    materials,
    vatRate,
    effectiveNetRate,
  )
  return (
    <>
      {/* Pinned top bar — the view toggle plus the settings trigger, so its height never moves. The
          settings block sat here once as an inline section and had to be evicted: growing it squeezed
          SummaryScrollRegion into a sliver, two containers fighting over one fixed height. It is back
          as a popover, whose content is portalled out of flow and so adds no height to this bar. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-4">
        <ToggleGroup
          options={viewOptions}
          value={view}
          onChange={setSummaryView}
          aria-label="Widok podsumowania"
        />
        {/* A client reads the mode, never writes it — the same `preview` gate every other
            owner-only affordance in this panel uses. Supplying the two writers is what makes a host
            an editor of these settings; a read-only host (no writers) renders no trigger at all. */}
        {!preview && onSettlementModeChange && onMaterialsNetRateChange && (
          <SummaryInvestmentSettings
            vatRate={vatRate}
            settlementMode={settlementMode}
            onSettlementModeChange={onSettlementModeChange}
            // The EFFECTIVE rate, not the stored one: at tryb brutto the saved rate is inert, and the
            // popover printing „Netto" while the Materiały tab beside it printed „Brutto" made one
            // setting answer its own question two ways on one screen. Nothing is lost — the rate is
            // kept, so switching back to netto brings it and its figures back.
            materialsNetRate={effectiveNetRate}
            onMaterialsNetRateChange={onMaterialsNetRateChange}
            pricingLockedReason={pricingLockedReason}
            isSaving={isSavingSettings}
            showSettingsBar={showSettingsBar}
          />
        )}
        {topBarSlot}
      </div>
      <SummaryScrollRegion>
        {isSubcontractorView && subcontractorDue ? (
          <SubcontractorSummary
            investmentId={investmentId}
            subcontractorDue={subcontractorDue}
            payouts={payoutsByWorker ?? []}
            payoutTransactions={payoutTransactions ?? []}
            stages={stages}
            workers={workers}
            showGlobalSettings={showSettingsBar}
            showTransactions={showTransactionLists}
            // Same signal, not a second one: the host that drops the lists is the compact host, and
            // the plane split + per-worker table are detail of the same kind.
            showBreakdown={showTransactionLists}
          />
        ) : (
          <div className="flex w-full flex-col gap-y-4 px-4 pt-4 pb-4">
            {view === 'summary' && (
              <SummaryOverviewTab
                investmentId={investmentId}
                settlementMode={settlementMode}
                // Same gate as the settings trigger above: a client reads the mode, and only a host
                // that supplied the writer may edit it from inside the tab.
                onSettlementModeChange={preview ? undefined : onSettlementModeChange}
                isSavingSettings={isSavingSettings}
                laborCostsNet={laborCostsNet}
                doZaplaty={doZaplaty}
                materials={materials}
                depositsTotal={depositsTotal}
                rabatAmount={rabatAmount}
                reconciliation={reconciliation}
                settlementVerdict={settlementVerdict}
                priceView="client"
                vatRate={vatRate}
                materialsNetRate={effectiveNetRate}
                paidNet={paidNet}
                paidGross={paidGross}
                depositRows={depositTransactions}
                showDeposits={showTransactionLists}
                preview={preview}
                showPie={showPies}
              />
            )}
            {view === 'expenses' && (
              <SummaryExpensesTab
                investmentId={investmentId}
                investmentName={investmentName}
                materials={materials}
                materialyBreakdown={materialyBreakdown}
                // Owner plane — dropped here too, not only by the client share omitting it upstream:
                // marża-side spend must fail closed on every path into a client render.
                settledBreakdown={preview ? undefined : settledBreakdown}
                materialTransactions={materialTransactions ?? []}
                materialsNetRate={effectiveNetRate}
                vatRate={vatRate}
                onMaterialsNetRateChange={preview ? undefined : onMaterialsNetRateChange}
                isSavingSettings={isSavingSettings}
                pricingLockedReason={pricingLockedReason}
                preview={preview}
                showTransactions={showTransactionLists}
                showPie={showPies}
              />
            )}

            {view === 'stages' && stages && stageTotals && (
              <SummaryStagesTab
                stages={stages}
                stageTotals={stageTotals}
                wykonaneNet={totalNet ?? 0}
                sectionSubtotals={sectionSubtotals ?? []}
                vatRate={vatRate}
              />
            )}
            {view === 'margin' && financials && (
              <SummaryMarginTab
                financials={financials}
                laborCostsNet={laborCostsNet}
                rabatAmount={rabatAmount}
              />
            )}
          </div>
        )}
      </SummaryScrollRegion>
    </>
  )
}
