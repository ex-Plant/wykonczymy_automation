'use client'

import type { PanelAxisT } from '@/lib/kosztorys/money-axis'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import {
  computeMixedSettlement,
  materialsPair,
  sumaPracPreRabat,
  type MaterialsT,
  type MoneyPairT,
} from '@/lib/kosztorys/summary-economics'
import { SettlementSummary } from '@/components/kosztorys/summary/blocks/settlement-summary'
import { buildSettlementGroups } from '@/components/kosztorys/summary/settlement-groups'
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
  preview?: boolean
  showPie?: boolean
  // Withholds the plane warning for the same reason the mismatch scream goes quiet: it compares the
  // whole kosztorys against a filtered ledger, so under a filter it would report the filter as a gap.
  filtersActive?: boolean
}

// The „Podsumowanie" view: the settlement block, then the folded wpłaty list.
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
  preview = false,
  showPie = true,
  filtersActive = false,
}: PropsT) {
  // Tryb mieszany settles part in cash (no invoice → no VAT) and invoices only the rest, so its
  // „Do zapłaty" can't come from the plain Łącznie − wpłaty the other tryby use. Both readings of the
  // remaining debt already exist on the settlement, so the pair is a re-labelling, not new arithmetic.
  const mixed =
    moneyAxis === 'mixed'
      ? computeMixedSettlement(
          laborCostsNetFromKosztorys,
          materials,
          vatRate,
          paidNet,
          paidGross,
          materialsNetRate,
        )
      : null
  const settlementGroups = buildSettlementGroups({
    mixed,
    doZaplaty,
    wplatyNet,
    vatRate,
    filtersActive,
  })
  // The „Struktura kosztów" pie is a netto robocizna/materiały split, identical in every mode — so it
  // sits here beside the settlement rather than inside any one mode's block. Robocizna enters PRZED
  // rabatem: a rabat is a concession on the price, not a change in what the job is made of, and a
  // rabat exceeding the executed work would otherwise feed the pie a negative slice.
  const materialsNet = materialsPair(materials, materialsNetRate, vatRate).net

  return (
    <div className="flex w-full flex-col gap-y-4">
      {!preview && !filtersActive && settlementVerdict.mismatch && (
        <SettlementPlaneWarning verdict={settlementVerdict} investmentId={investmentId} />
      )}
      <div className="flex flex-col items-start gap-8 lg:flex-row">
        <div className="flex flex-col gap-y-4">
          <SettlementSummary
            investmentId={investmentId}
            laborCostsNetFromKosztorys={laborCostsNetFromKosztorys}
            materials={materials}
            settlementGroups={settlementGroups}
            rabatAmount={rabatAmount}
            reconciliation={reconciliation}
            priceView={priceView}
            vatRate={vatRate}
            materialsNetRate={materialsNetRate}
            preview={preview}
            filtersActive={filtersActive}
          />
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
        <CollapsibleSection title="Lista wpłat" size="sm" defaultOpen={false}>
          <div className="pt-4">
            <SummaryDepositsTab
              investmentId={investmentId}
              rows={depositRows}
              paidNet={paidNet}
              paidGross={paidGross}
              preview={preview}
              showPie={showPie}
            />
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}
