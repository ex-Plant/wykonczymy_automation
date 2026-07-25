'use client'

import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import { materialyPair, type MoneyPairT } from '@/lib/kosztorys/summary-economics'
import { MixedSummary } from '@/components/kosztorys/summary/blocks/mixed-summary'
import { BruttoNettoSummary } from '@/components/kosztorys/summary/blocks/brutto-netto-summary'
import { SummarySettingsBar } from '@/components/kosztorys/summary/summary-settings-bar'
import { SlicePie } from '@/components/ui/slice-pie'
import { type PanelAxisT } from '@/components/kosztorys/summary/hooks/use-summary-axis'
import type { KosztorysReconciliationT } from '@/lib/kosztorys/reconciliation'
import { costTotalsPieSlices } from '@/lib/kosztorys/chart-slices'
import { formatNet } from '@/lib/kosztorys/format'

type PropsT = {
  investmentId: number
  // netto/brutto/Mieszane axis — the control lives in the panel top bar (it governs every summary
  // tab); this tab only reads the value to pick Mixed vs Brutto/Netto.
  moneyAxis: PanelAxisT
  laborCostsNetFromKosztorys: number
  doZaplaty: MoneyPairT
  materialsGross: number
  wplatyNet: number
  rabatAmount: number
  reconciliation: KosztorysReconciliationT
  priceView: PriceViewT
  vatRate: number
  // Materiały-netto pricing (checkbox + reduction %) — shared panel state, feeds both figures.
  deriveMaterialsNet: boolean
  materialsReduction: number
  // Wpłaty split by VAT plane — feeds the tryb mieszany settlement.
  paidNet: number
  paidGross: number
  clientView?: boolean
}

// The „Podsumowanie" view: its own axis control on top, then the settlement below. Mieszane swaps the
// two-column BruttoNettoSummary for the vertical netto→brutto MixedSummary; Netto/Brutto keep the table.
export function SummaryOverviewTab({
  investmentId,
  moneyAxis,
  laborCostsNetFromKosztorys,
  doZaplaty,
  materialsGross,
  wplatyNet,
  rabatAmount,
  reconciliation,
  priceView,
  vatRate,
  deriveMaterialsNet,
  materialsReduction,
  paidNet,
  paidGross,
  clientView = false,
}: PropsT) {
  const mixedMode = moneyAxis === 'mixed'
  const displayAxis: MoneyAxisT = mixedMode ? 'both' : moneyAxis
  // The „Struktura kosztów" pie is a netto robocizna/materiały split, identical in every mode — so it
  // sits here beside the settlement rather than inside any one mode's block.
  const materialsNet = materialyPair(
    materialsGross,
    vatRate,
    deriveMaterialsNet,
    materialsReduction,
  ).net

  return (
    <div className="flex w-full flex-col gap-y-4">
      <div className="flex flex-col items-start gap-8 lg:flex-row">
        {mixedMode ? (
          <MixedSummary
            laborCostsNetFromKosztorys={laborCostsNetFromKosztorys}
            materialsGross={materialsGross}
            vatRate={vatRate}
            deriveMaterialsNet={deriveMaterialsNet}
            materialsReduction={materialsReduction}
            paidNet={paidNet}
            paidGross={paidGross}
            rabatAmount={rabatAmount}
          />
        ) : (
          <BruttoNettoSummary
            investmentId={investmentId}
            laborCostsNetFromKosztorys={laborCostsNetFromKosztorys}
            doZaplaty={doZaplaty}
            materialsGross={materialsGross}
            wplatyNet={wplatyNet}
            rabatAmount={rabatAmount}
            reconciliation={reconciliation}
            priceView={priceView}
            vatRate={vatRate}
            moneyAxis={displayAxis}
            deriveMaterialsNet={deriveMaterialsNet}
            materialsReduction={materialsReduction}
            clientView={clientView}
          />
        )}
        <SlicePie
          caption="Struktura kosztów"
          slices={costTotalsPieSlices(laborCostsNetFromKosztorys, materialsNet)}
          formatValue={formatNet}
        />
      </div>
      {!clientView && <SummarySettingsBar />}
    </div>
  )
}
