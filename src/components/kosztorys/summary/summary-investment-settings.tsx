'use client'

import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { SettlementModeSelect } from '@/components/kosztorys/summary/settlement-mode-select'
import { MaterialsNetPricingControl } from '@/components/kosztorys/summary/materials-net-pricing-control'
import { VatRateField } from '@/components/kosztorys/summary/vat-rate-field'
import { GlobalDiscountControl } from '@/components/kosztorys/summary/global-discount-control'
import { Separator } from '@/components/ui/separator'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'

type PropsT = {
  vatRate: number
  settlementMode: SettlementModeT
  onSettlementModeChange: (mode: SettlementModeT) => void
  // Materiały brutto — server sum of the investment's unsettled brutto-billed transactions; the base
  // the netto pricing concession can reach.
  materialsGrossBase: number
  // The investment's persisted materiały netto rate as a fraction; null = the concession is off.
  materialsNetRate: number | null
  onMaterialsNetRateChange: (rate: number | null) => void
  // VAT + rabat globalny editing. Reads the editor context, so only a host inside
  // KosztorysEditorProvider may turn it on.
  showSettingsBar?: boolean
  // Expanded on arrival when the investment page linked here to change a setting — otherwise the
  // reader lands on the panel with the thing they came for still collapsed.
  defaultOpen?: boolean
}

// Every set-once decision about the deal — settlement mode, materiały netto pricing, VAT + rabat
// globalny — grouped under one collapsed trigger in the panel's pinned top bar, so the reader isn't
// paying vertical space for them on every visit.
export function SummaryInvestmentSettings({
  vatRate,
  settlementMode,
  onSettlementModeChange,
  materialsGrossBase,
  materialsNetRate,
  onMaterialsNetRateChange,
  showSettingsBar = false,
  defaultOpen = false,
}: PropsT) {
  return (
    <CollapsibleSection title="Opcje rozliczenia" size="sm" defaultOpen={defaultOpen}>
      {/* divide-y rather than explicit separators: a hidden section leaves no node, so the rules
          never double up or dangle when the brutto mode or the host drops one. */}
      <div className="divide-border flex flex-col divide-y">
        <div className="py-3">
          <SettlementModeSelect
            value={settlementMode}
            onChange={onSettlementModeChange}
            vatRate={vatRate}
          />
        </div>
        {/* Brutto settlement prices at brutto by design, so the concession has nothing to strip —
            the saved rate stays stored (switching back restores it) but the control is hidden rather
            than offered as a switch that changes nothing. */}
        {settlementMode !== 'GROSS' && (
          <div className="py-3">
            <MaterialsNetPricingControl
              materialsGrossBase={materialsGrossBase}
              vatRate={vatRate}
              materialsNetRate={materialsNetRate}
              onMaterialsNetRateChange={onMaterialsNetRateChange}
            />
          </div>
        )}
        {showSettingsBar && (
          <div className="py-3">
            <VatRateField />
          </div>
        )}
        {showSettingsBar && (
          <div className="py-3">
            <GlobalDiscountControl />
          </div>
        )}
      </div>
      <Separator orientation="horizontal" className="mt-3" />
    </CollapsibleSection>
  )
}
