'use client'

import type { MoneyAxisT, PanelAxisT } from '@/lib/kosztorys/money-axis'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import {
  materialsPair,
  sumaPracPreRabat,
  type MaterialsT,
  type MoneyPairT,
} from '@/lib/kosztorys/summary-economics'
import { MixedSummary } from '@/components/kosztorys/summary/blocks/mixed-summary'
import { BruttoNettoSummary } from '@/components/kosztorys/summary/blocks/brutto-netto-summary'
import { SummaryDepositsTab } from '@/components/kosztorys/summary/tabs/summary-deposits-tab'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { SlicePie } from '@/components/ui/slice-pie'
import { SettlementPlaneWarning } from '@/components/kosztorys/summary/settlement-plane-warning'
import type { DepositTransactionRowT } from '@/types/transfers'
import type {
  KosztorysReconciliationT,
  SettlementPlaneVerdictT,
} from '@/lib/kosztorys/reconciliation'
import { costTotalsPieSlices } from '@/lib/kosztorys/chart-slices'
import { formatNet } from '@/lib/kosztorys/format'

type PropsT = {
  investmentId: number
  // netto/brutto/Mieszane axis — the control lives in the panel top bar (it governs every summary
  // tab); this tab only reads the value to pick Mixed vs Brutto/Netto.
  moneyAxis: PanelAxisT
  laborCostsNetFromKosztorys: number
  doZaplaty: MoneyPairT
  materials: MaterialsT
  wplatyNet: number
  rabatAmount: number
  reconciliation: KosztorysReconciliationT
  settlementVerdict: SettlementPlaneVerdictT
  priceView: PriceViewT
  vatRate: number
  // The investment's saved materiały netto rate (null = off), already gated on the settlement mode
  // by the panel — feeds every materiały figure in this tab.
  materialsNetRate: number | null
  // Wpłaty split by VAT plane — feeds the tryb mieszany settlement.
  paidNet: number
  paidGross: number
  // The individual wpłaty, for the folded list below the settlement.
  depositRows: DepositTransactionRowT[]
  // Off on a host whose own transfers table already lists every wpłata (the investment page), where a
  // second copy of the same list is noise rather than detail.
  showDeposits?: boolean
  clientView?: boolean
  showPie?: boolean
}

// The „Podsumowanie" view: its own axis control on top, then the settlement below. Mieszane swaps the
// two-column BruttoNettoSummary for the vertical netto→brutto MixedSummary; Netto/Brutto keep the table.
export function SummaryOverviewTab({
  investmentId,
  moneyAxis,
  laborCostsNetFromKosztorys,
  doZaplaty,
  materials,
  wplatyNet,
  rabatAmount,
  reconciliation,
  settlementVerdict,
  priceView,
  vatRate,
  materialsNetRate,
  paidNet,
  paidGross,
  depositRows,
  showDeposits = true,
  clientView = false,
  showPie = true,
}: PropsT) {
  const mixedMode = moneyAxis === 'mixed'
  const displayAxis: MoneyAxisT = mixedMode ? 'both' : moneyAxis
  // The „Struktura kosztów" pie is a netto robocizna/materiały split, identical in every mode — so it
  // sits here beside the settlement rather than inside any one mode's block. Robocizna enters PRZED
  // rabatem: a rabat is a concession on the price, not a change in what the job is made of, and a
  // rabat exceeding the executed work would otherwise feed the pie a negative slice.
  const materialsNet = materialsPair(materials, materialsNetRate).net

  return (
    <div className="flex w-full flex-col gap-y-4">
      {!clientView && settlementVerdict.mismatch && (
        <SettlementPlaneWarning verdict={settlementVerdict} investmentId={investmentId} />
      )}
      <div className="flex flex-col items-start gap-8 lg:flex-row">
        <div className="flex flex-col gap-y-4">
          {mixedMode ? (
            <MixedSummary
              laborCostsNetFromKosztorys={laborCostsNetFromKosztorys}
              materials={materials}
              vatRate={vatRate}
              materialsNetRate={materialsNetRate}
              paidNet={paidNet}
              paidGross={paidGross}
              rabatAmount={rabatAmount}
            />
          ) : (
            <BruttoNettoSummary
              investmentId={investmentId}
              laborCostsNetFromKosztorys={laborCostsNetFromKosztorys}
              doZaplaty={doZaplaty}
              materials={materials}
              wplatyNet={wplatyNet}
              rabatAmount={rabatAmount}
              reconciliation={reconciliation}
              priceView={priceView}
              vatRate={vatRate}
              moneyAxis={displayAxis}
              materialsNetRate={materialsNetRate}
              clientView={clientView}
            />
          )}
        </div>
        {showPie && (
          <SlicePie
            slices={costTotalsPieSlices(
              sumaPracPreRabat(laborCostsNetFromKosztorys, rabatAmount),
              materialsNet,
            )}
            formatValue={formatNet}
          />
        )}
      </div>
      {showDeposits && (
        <CollapsibleSection title="Lista wpłat" size="sm" className="w-fit">
          <div className="pt-4">
            <SummaryDepositsTab
              investmentId={investmentId}
              rows={depositRows}
              paidNet={paidNet}
              paidGross={paidGross}
              clientView={clientView}
              showPie={showPie}
            />
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}
