'use client'

import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SettlementModeSelect } from '@/components/kosztorys/summary/settlement-mode-select'
import { MaterialsNetPricingControl } from '@/components/kosztorys/summary/materials-net-pricing-control'
import { VatRateField } from '@/components/kosztorys/summary/vat-rate-field'
import { GlobalDiscountControl } from '@/components/kosztorys/summary/global-discount-control'
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
  // One flag for all four: they are set-once decisions nobody edits two at a time, and none of them
  // is optimistic — the figures they move are recomputed on the server.
  isSaving?: boolean
  // VAT + rabat globalny editing. Reads the editor context, so only a host inside
  // KosztorysEditorProvider may turn it on.
  showSettingsBar?: boolean
}

// Every set-once decision about the deal — settlement mode, materiały netto pricing, VAT + rabat
// globalny — behind one trigger in the panel's pinned top bar.
//
// A Popover, not a DropdownMenu: these are form controls (selects, a number field), and a menu's
// roving focus and typeahead fight nested inputs. And an overlay rather than the inline collapsible
// this replaced — portalled content is out of flow, so the block can grow without adding height to
// the bar. That is the whole point: it lived in this bar once as an inline section and had to be
// evicted because growing it squeezed the scroll region below into a sliver.
export function SummaryInvestmentSettings({
  vatRate,
  settlementMode,
  onSettlementModeChange,
  materialsGrossBase,
  materialsNetRate,
  onMaterialsNetRateChange,
  isSaving = false,
  showSettingsBar = false,
}: PropsT) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          Opcje rozliczenia
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      {/* Capped at the space Radix measured between the trigger and the viewport edge, so a short
          window scrolls the options instead of clipping them. */}
      <PopoverContent
        align="start"
        className="max-h-(--radix-popover-content-available-height) w-96 overflow-y-auto"
      >
        {/* divide-y rather than explicit separators: a hidden section leaves no node, so the rules
            never double up or dangle when the brutto mode or the host drops one. */}
        <div className="divide-border flex flex-col divide-y">
          <div className="pb-3">
            <SettlementModeSelect
              value={settlementMode}
              onChange={onSettlementModeChange}
              vatRate={vatRate}
              disabled={isSaving}
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
                disabled={isSaving}
              />
            </div>
          )}
          {showSettingsBar && (
            <div className="py-3">
              <VatRateField disabled={isSaving} />
            </div>
          )}
          {showSettingsBar && (
            <div className="pt-3">
              <GlobalDiscountControl disabled={isSaving} />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
