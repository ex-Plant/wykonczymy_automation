'use client'

import type { ReactNode } from 'react'
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
import { SubcontractorSummary } from '@/components/kosztorys/summary/blocks/subcontractor-summary'
import { SummaryMarginTab } from '@/components/kosztorys/summary/tabs/summary-margin-tab'
import { SummaryScrollRegion } from '@/components/ui/summary-grid'
import { SummaryInvestmentSettings } from '@/components/kosztorys/summary/summary-investment-settings'
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
import type {
  SubcontractorPayoutRowT,
  PayoutTransactionRowT,
  DepositTransactionRowT,
  MaterialTransactionRowT,
} from '@/types/transfers'

const SUMMARY_VIEW_OPTIONS: OptionT<SummaryViewT>[] = [
  { value: 'summary', label: 'Podsumowanie' },
  { value: 'expenses', label: 'Wydatki' },
  { value: 'stages', label: 'Robocizna' },
  { value: 'subcontractors', label: 'Podwykonawcy' },
  { value: 'margin', label: 'Marża' },
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
  // Company-plane material folded into robocizna, split per category — its own table in the wydatki
  // view. Omitted by the client share, which never builds it.
  settledBreakdown?: MaterialyBreakdownRowT[]
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
  // Expanded on arrival when the investment page's settings link was followed here.
  settingsDefaultOpen?: boolean
  // Off on a host that already lists every transaction next to the panel (the investment page's
  // transfers table): wydatki drops its materiały list, wpłaty keeps only the Razem buckets.
  showTransactionLists?: boolean
  // Off on a host where the panel is one block among several rather than a full-height overlay (the
  // investment page): the share pies are the first thing worth dropping when vertical space is tight.
  showPies?: boolean
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
  laborCostsNetFromKosztorys,
  materialsGrossBase,
  materialsNetBilled,
  materialyBreakdown,
  settledBreakdown,
  wplatyNet,
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
  settingsDefaultOpen = false,
  showTransactionLists = true,
  showPies = true,
  clientView = false,
  stages,
  stageTotals,
  payoutsByWorker,
  payoutTransactions,
  materialTransactions,
  subcontractorDue,
  totalNet,
  sectionSubtotals,
  financials,
}: PropsT) {
  const moneyAxis = settlementModeToPanelAxis(settlementMode)
  // Which view the panel shows — driven solely by the top toggle, fully independent of the grid's
  // price view (that only governs the grid columns now). „Podwykonawcy" is owner-only, so it drops out
  // of the client read-only toggle on top of whatever the host allowed. The persisted pick is shared
  // across hosts, so it can name a view this host doesn't offer — fall back to the first one it does,
  // rather than stranding the reader on a hidden view.
  const [summaryView, setSummaryView] = useSummaryView()
  // „Marża" rides entirely on `financials` being present, and the hosts only build it for ADMIN/OWNER
  // — so the figures never reach a non-owner's RSC payload, which a client-side role check could not
  // have achieved. This component reads no session on purpose: it also renders under (share), which
  // mounts no CurrentUserProvider.
  const allowedViews = views.filter((value) => {
    if (value === 'subcontractors') return !clientView
    if (value === 'margin') return !clientView && financials !== undefined
    return true
  })
  const viewOptions = SUMMARY_VIEW_OPTIONS.filter((option) => allowedViews.includes(option.value))
  const view: SummaryViewT = allowedViews.includes(summaryView)
    ? summaryView
    : (allowedViews[0] ?? 'summary')
  const isSubcontractorView = view === 'subcontractors'
  // Wpłaty split by VAT plane for tryb mieszany: NET (+ unmarked) settle the netto section,
  // GROSS the brutto section. Derived from the deposit list, never typed.
  const { paidNet, paidGross, taggedNet, taggedGross } = bucketDepositsByPlane(depositTransactions)
  // Computed here, where the mode and the bucketed deposits already are; the tab renders the verdict
  // rather than deciding it.
  const settlementVerdict = buildSettlementPlaneVerdict({
    mode: settlementMode,
    taggedNet,
    taggedGross,
  })
  // The tables show one money column — the settled one. Mieszane is the exception: it's a mixed
  // netto+brutto settlement, so it shows both columns alongside the gotówka block. Same projection
  // the grid uses, so a table and a column can't disagree about what „Mieszane" means.
  const displayAxis: MoneyAxisT = settlementModeToGridAxis(settlementMode)
  const nettoShown = moneyAxis !== 'gross'
  // A brutto-settled investment adds VAT on top, so there is nothing to strip and the saved rate goes
  // inert — the same gate the server applies to `materialsNetDiscount`. Both sides fall silent
  // together rather than the panel discounting a figure marża never saw. The rate itself is kept, not
  // cleared: switching back to netto restores the old figures with nothing to re-enter.
  const effectiveNetRate = settlementMode === 'GROSS' ? null : materialsNetRate
  // Computed here and passed down: the collapsed headline and the Podsumowanie row show the same
  // „Do zapłaty", so it has one source rather than two calls that must be kept in step.
  const materials: MaterialsT = { grossBase: materialsGrossBase, netBilled: materialsNetBilled }
  const doZaplaty = computeDoZaplatyRM(
    laborCostsNetFromKosztorys,
    wplatyNet,
    materials,
    vatRate,
    effectiveNetRate,
  )
  return (
    <>
      {/* Pinned top bar — only the view toggle, so its height never moves. "Opcje rozliczenia" scrolls
          with the rest of the content instead of sharing this bar: it used to live here, and growing
          it squeezed SummaryScrollRegion into a sliver — two containers fighting over one fixed
          height. One scrolling container below a fixed-height bar has nothing left to fight over. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-4">
        <ToggleGroup
          options={viewOptions}
          value={view}
          onChange={setSummaryView}
          aria-label="Widok podsumowania"
        />
        {topBarSlot}
      </div>
      <SummaryScrollRegion>
        {/* A client reads the mode, never writes it — the same `clientView` gate every other
            owner-only affordance in this panel uses. Collapsed by default: these are set-once
            decisions about the deal, not something the reader needs on every visit.
            Supplying the two writers is what makes a host an editor of these settings; a
            read-only host (no writers) renders no settings block at all — the investment page
            links to the editor from its own action row instead. */}
        {!clientView && onSettlementModeChange && onMaterialsNetRateChange && (
          <div className="max-w-lg px-4 pt-4">
            <SummaryInvestmentSettings
              vatRate={vatRate}
              settlementMode={settlementMode}
              onSettlementModeChange={onSettlementModeChange}
              materialsGrossBase={materialsGrossBase}
              materialsNetRate={materialsNetRate}
              onMaterialsNetRateChange={onMaterialsNetRateChange}
              isSaving={isSavingSettings}
              showSettingsBar={showSettingsBar}
              defaultOpen={settingsDefaultOpen}
            />
          </div>
        )}
        {isSubcontractorView && subcontractorDue ? (
          <SubcontractorSummary
            investmentId={investmentId}
            subcontractorDue={subcontractorDue}
            payouts={payoutsByWorker ?? []}
            payoutTransactions={payoutTransactions ?? []}
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
                materialsNetRate={effectiveNetRate}
                paidNet={paidNet}
                paidGross={paidGross}
                depositRows={depositTransactions}
                showDeposits={showTransactionLists}
                clientView={clientView}
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
                settledBreakdown={clientView ? undefined : settledBreakdown}
                materialTransactions={materialTransactions ?? []}
                nettoShown={nettoShown}
                materialsNetRate={materialsNetRate}
                clientView={clientView}
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
                moneyAxis={displayAxis}
              />
            )}
            {view === 'margin' && financials && <SummaryMarginTab financials={financials} />}
          </div>
        )}
      </SummaryScrollRegion>
    </>
  )
}
