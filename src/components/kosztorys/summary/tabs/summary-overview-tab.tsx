'use client'

import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import {
  billedMaterials,
  computeMixedSettlement,
  laborCostsNetPreDiscount,
  type MaterialsT,
  type MoneyPairT,
} from '@/lib/kosztorys/summary-economics'
import { SettlementSummary } from '@/components/kosztorys/summary/blocks/settlement-summary'
import { InlineModeSelect } from '@/components/ui/inline-mode-select'
import {
  SETTLEMENT_MODE_DESCRIPTIONS,
  SETTLEMENT_MODE_SELECT_OPTIONS,
} from '@/components/kosztorys/summary/settlement-mode-options'
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
  // Picks Mixed vs Brutto/Netto here, and is the value the inline control writes. Supplying the
  // writer is what turns that control on — same gate as the popover's: a read-only host passes the
  // value and no writer.
  settlementMode: SettlementModeT
  onSettlementModeChange?: (mode: SettlementModeT) => void
  isSavingSettings?: boolean
  laborCostsNet: number
  amountDue: MoneyPairT
  materials: MaterialsT
  depositsTotal: number
  discountAmount: number
  // Σ LOSS — the deduction step between the wpłaty and the closing figure. Face value on both axes.
  lossAmount: number
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
}

// The „Podsumowanie" view: the settlement block, then the folded wpłaty list.
export function SummaryOverviewTab({
  investmentId,
  settlementMode,
  onSettlementModeChange,
  isSavingSettings = false,
  laborCostsNet,
  amountDue,
  materials,
  depositsTotal,
  discountAmount,
  lossAmount,
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
}: PropsT) {
  // Tryb mieszany settles part in cash (no invoice → no VAT) and invoices only the rest, so its
  // „Do zapłaty" can't come from the plain Łącznie − wpłaty the other tryby use. Both readings of the
  // remaining debt already exist on the settlement, so the pair is a re-labelling, not new arithmetic.
  const mixed =
    settlementMode === 'MIXED'
      ? computeMixedSettlement(
          laborCostsNet,
          materials,
          vatRate,
          paidNet,
          paidGross,
          materialsNetRate,
          lossAmount,
        )
      : null
  const settlementGroups = buildSettlementGroups({
    mixed,
    amountDue,
    depositsTotal,
    lossAmount,
    vatRate,
  })
  // What the investor is billed for materiały — one figure, feeding both the Podsumowanie row and the
  // „Struktura kosztów" pie so the two can never disagree. The pie is a netto robocizna/materiały
  // split, identical in every mode, so it sits here beside the settlement rather than inside any one
  // mode's block. Robocizna enters the pie PRZED rabatem: a rabat is a concession on the price, not a
  // change in what the job is made of, and a rabat exceeding the executed work would otherwise feed
  // the pie a negative slice.
  const materialsBilled = billedMaterials(materials, materialsNetRate)

  return (
    <div className="flex w-full flex-col gap-y-4">
      {!preview && settlementVerdict.mismatch && (
        <SettlementPlaneWarning verdict={settlementVerdict} investmentId={investmentId} />
      )}
      {/* Above the row, not inside its left column: nested there it pushed the settlement table down
          while the pie stayed put, and the tab lost its top edge. */}
      {onSettlementModeChange && (
        <InlineModeSelect
          label="Rozliczenie robocizny"
          value={settlementMode}
          onValueChange={(next) => onSettlementModeChange(next as SettlementModeT)}
          options={SETTLEMENT_MODE_SELECT_OPTIONS}
          description={SETTLEMENT_MODE_DESCRIPTIONS[settlementMode]}
          disabled={isSavingSettings}
        />
      )}
      <div className="flex flex-col items-start gap-8 lg:flex-row">
        <div className="flex flex-col gap-y-4">
          <SettlementSummary
            investmentId={investmentId}
            laborCostsNet={laborCostsNet}
            materialsBilled={materialsBilled}
            settlementGroups={settlementGroups}
            discountAmount={discountAmount}
            reconciliation={reconciliation}
            priceView={priceView}
            vatRate={vatRate}
            preview={preview}
          />
        </div>
        {showPie && (
          <SlicePie
            slices={costTotalsPieSlices(
              laborCostsNetPreDiscount(laborCostsNet, discountAmount),
              materialsBilled,
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
