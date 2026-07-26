'use client'

import { useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
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
import { useTotalsPanelOpen } from '@/components/kosztorys/summary/hooks/use-totals-panel-open'
import {
  useSummaryAxis,
  type PanelAxisT,
} from '@/components/kosztorys/summary/hooks/use-summary-axis'
import { SimpleSelect, type SelectOptionT } from '@/components/ui/simple-select'
import { Description } from '@/components/ui/description'
import {
  useSummaryView,
  type SummaryViewT,
} from '@/components/kosztorys/summary/hooks/use-summary-view'
import { useMaterialsNetPricing } from '@/components/kosztorys/summary/hooks/use-materials-net-pricing'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'
import type { KosztorysReconciliationT } from '@/lib/kosztorys/reconciliation'
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

const AXIS_SELECT_OPTIONS: SelectOptionT[] = [
  { value: 'net', label: 'Netto' },
  { value: 'gross', label: 'Brutto' },
  { value: 'mixed', label: 'Mix' },
]

type PropsT = {
  investmentId: number
  stages: KosztorysStageT[]
  stageTotals: Map<number, number>
  // Realized PAYOUTs per worker — feeds the subcontractor summary block (Z/Bez narzędzi views only).
  payoutsByWorker: SubcontractorPayoutRowT[]
  // Individual realized PAYOUT rows — feed the subcontractor block's sortable wypłaty list.
  payoutTransactions: PayoutTransactionRowT[]
  // Individual deposit rows — feed the client Podsumowanie's sortable wpłaty list.
  depositTransactions: DepositTransactionRowT[]
  // Individual materiały rows — feed the Podsumowanie's wydatki list (data · typ · kwota).
  materialTransactions: MaterialTransactionRowT[]
  // View-independent subcontractor settlement — each etap at its own plane's price, split + combined
  // + unconfirmed flag. The subcontractor block's headline figures. Ignored in the client view.
  subcontractorDue: SubcontractorDueByPlaneT
  // Suma prac wykonanych — the executed total BEFORE rabat (Σ etap totals); EtapTotals' readout.
  totalNet: number
  // Robocizna wartość netto — executed total AFTER rabat; the Podsumowanie waterfall's base.
  laborCostsNetFromKosztorys: number
  // Materiały brutto — server sum of the investment's unsettled brutto-billed transactions.
  materialsGrossBase: number
  // Σ netAmount of the netto-billed wydatki — frozen: the netto pricing toggle must not touch it.
  materialsNetBilled: number
  // Per-expense-category split of both buckets (v1 parity); Σ === materiały billed total.
  materialyBreakdown: MaterialyBreakdownRowT[]
  // Client-priced, view-invariant per-section subtotals — the section pie's structure source.
  sectionSubtotals: SectionSliceInputT[]
  // Investor's wpłaty (totalIncome — every deposit on the investment) — subtracted to reach the
  // still-owed „Do zapłaty" total.
  wplatyNet: number
  rabatAmount: number
  // Robocizna/rabat reconciliation verdict — drives the Podsumowanie mismatch scream. Always supplied
  // (the body computes it unconditionally); clientView suppresses the scream downstream, not by
  // withholding the verdict.
  reconciliation: KosztorysReconciliationT
  vatRate: number
  // Read-only client render: gate the mismatch scream and render internal links as plain text.
  clientView?: boolean
}

// The bottom totals block: Suma transzy per etap + the merged Podsumowanie table (Suma prac →
// Rabat → Robocizna / Materiały / Łącznie − Zaliczki), folded into one collapsible panel.
// Collapsed, it keeps the still-owed „Do zapłaty" total visible so the headline never disappears.
export function KosztorysTotalsPanel({
  investmentId,
  stages,
  stageTotals,
  payoutsByWorker,
  payoutTransactions,
  depositTransactions,
  materialTransactions,
  subcontractorDue,
  totalNet,
  laborCostsNetFromKosztorys,
  materialsGrossBase,
  materialsNetBilled,
  materialyBreakdown,
  sectionSubtotals,
  wplatyNet,
  rabatAmount,
  reconciliation,
  vatRate,
  clientView = false,
}: PropsT) {
  const [open, setOpen] = useTotalsPanelOpen()
  // The panel's own netto/brutto axis, independent of the Widok dropdown — that one keeps
  // governing the grid columns only; this switch governs every figure inside the panel.
  const [moneyAxis, setMoneyAxis] = useSummaryAxis()
  // Which view the panel shows — driven solely by the top toggle, fully independent of the grid's
  // price view (that only governs the grid columns now). „Podwykonawcy" is owner-only: filtered from
  // the client read-only toggle, and a persisted pick of it falls back to „Podsumowanie" there so a
  // client is never stranded on a hidden view.
  const [summaryView, setSummaryView] = useSummaryView()
  const viewOptions = clientView
    ? SUMMARY_VIEW_OPTIONS.filter((option) => option.value !== 'podwykonawcy')
    : SUMMARY_VIEW_OPTIONS
  const view: SummaryViewT = clientView && summaryView === 'podwykonawcy' ? 'summary' : summaryView
  const isSubcontractorView = view === 'podwykonawcy'
  // Wpłaty split by VAT plane for tryb mieszany: NET (+ unmarked) settle the netto section,
  // GROSS the brutto section. Derived from the deposit list, never typed.
  const { paidNet, paidGross } = bucketDepositsByPlane(depositTransactions)
  // The toggle shows one money column — the chosen one. Mieszane is the exception: it's a mixed
  // netto+brutto settlement, so it shows both columns alongside the gotówka block.
  const displayAxis: MoneyAxisT = moneyAxis === 'mixed' ? 'both' : moneyAxis
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
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      // The open/close animation lives on the ROOT's height (0 ↔ 100%), not on the Content's Radix
      // keyframes — those animate the measured natural content height, which disagrees with the
      // flex-stretched full height and made the close look two-phased. Content stays mounted
      // (forceMount) so it can't blink out mid-transition; visibility flips only once closed.
      // Collapsed it takes no height at all: with the toolbar owning the toggle, the panel has
      // nothing left to show down here, so the border goes transparent too rather than leaving a
      // hairline ruled across the bottom of the grid.
      className="border-border bg-background text-foreground shadow-panel absolute inset-x-0 bottom-0 z-20 flex h-0 flex-col overflow-hidden border-t transition-[height] duration-200 ease-out data-[state=closed]:border-transparent data-[state=open]:h-full"
    >
      <Collapsible.Content
        forceMount
        className="flex min-h-0 flex-1 flex-col overflow-hidden transition-[visibility] duration-200 data-[state=closed]:invisible"
      >
        {/* Pinned top bar — the view toggle (Podsumowanie / Wydatki / Wpłaty / Robocizna /
            Podwykonawcy) stays visible while the content scrolls below it. „Podwykonawcy" is dropped
            from the options in the client read-only view. */}
        <div className="flex flex-col items-start gap-2 px-4 pt-4">
          <ToggleGroup
            options={viewOptions}
            value={view}
            onChange={setSummaryView}
            aria-label="Widok podsumowania"
          />
          {!isSubcontractorView && !clientView && (
            <div className="my-2 flex flex-col gap-2">
              <Description className="max-w-xs" size="sm" withIcon={false}>
                Wybierz jak rozliczana będzie inwestycja.
              </Description>
              <SimpleSelect
                value={moneyAxis}
                onValueChange={(next) => setMoneyAxis(next as PanelAxisT)}
                options={AXIS_SELECT_OPTIONS}
                className="w-40"
              />
            </div>
          )}
        </div>
        <SummaryScrollRegion>
          {isSubcontractorView ? (
            <SubcontractorSummary
              investmentId={investmentId}
              subcontractorDue={subcontractorDue}
              payouts={payoutsByWorker}
              payoutTransactions={payoutTransactions}
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
                  priceView="client"
                  vatRate={vatRate}
                  deriveMaterialsNet={materialsAsNet}
                  materialsReduction={materialsReduction}
                  paidNet={paidNet}
                  paidGross={paidGross}
                  clientView={clientView}
                />
              )}
              {view === 'wydatki' && (
                <SummaryExpensesTab
                  investmentId={investmentId}
                  materials={materials}
                  materialyBreakdown={materialyBreakdown}
                  materialTransactions={materialTransactions}
                  nettoShown={nettoShown}
                  materialsAsNet={materialsAsNet}
                  onMaterialsAsNetChange={setMaterialsAsNet}
                  materialsReductionPercent={materialsReductionPercent}
                  onMaterialsReductionPercentChange={setMaterialsReductionPercent}
                  clientView={clientView}
                />
              )}

              {view === 'wplaty' && (
                <SummaryDepositsTab
                  investmentId={investmentId}
                  rows={depositTransactions}
                  paidNet={paidNet}
                  paidGross={paidGross}
                  clientView={clientView}
                />
              )}
              {view === 'etapy' && (
                <SummaryStagesTab
                  stages={stages}
                  stageTotals={stageTotals}
                  wykonaneNet={totalNet}
                  sectionSubtotals={sectionSubtotals}
                  vatRate={vatRate}
                  moneyAxis={displayAxis}
                />
              )}
            </div>
          )}
        </SummaryScrollRegion>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
