'use client'

import { LabeledModeSelect } from '@/components/ui/labeled-mode-select'
import type { SelectOptionT } from '@/components/ui/simple-select'
import { DecimalField } from '@/components/ui/decimal-field'
import { formatNet } from '@/lib/kosztorys/format'
import { materialsNetDiscount } from '@/lib/kosztorys/summary-economics'

type PricingModeT = 'gross' | 'net'

const PRICING_MODE_OPTIONS: SelectOptionT[] = [
  { value: 'gross', label: 'Brutto' },
  { value: 'net', label: 'Netto' },
]

const PRICING_MODE_DESCRIPTIONS: Record<PricingModeT, string> = {
  gross: 'Wydatki inwestycyjne rozliczane po kwotach z paragonu/faktury (domyślne).',
  net: 'Wydatki inwestycyjne rozliczane po kwocie netto zamiast po kwocie z paragonu/faktury. \nStawkę ustawiasz poniżej. Od kwoty brutto transakcji zostanie odjęty określony procent. Domyślnie jest to stawka vat inwestycji ale możesz ustawić dowolny.',
}

type PropsT = {
  // Brutto base of the investor's wydatki — only what the concession can reach, hence the readout's base.
  materialsGrossBase: number
  // Opening value when the owner switches the concession on: billing materiały netto at the VAT rate
  // is the case this feature was built for, so it is one click rather than a number to look up.
  vatRate: number
  // The investment's saved netto rate (fraction) and its writer — persisted, not browser-local.
  materialsNetRate: number | null
  onMaterialsNetRateChange: (rate: number | null) => void
  disabled?: boolean
}

// Sits with the settlement mode rather than in the wydatki view: which plane the investment settles on
// and whether its wydatki are billed netto are one decision about the deal. Brutto settlement adds VAT
// on top, so there is nothing to strip — the panel hides this control there entirely.
export function MaterialsNetPricingControl({
  materialsGrossBase,
  vatRate,
  materialsNetRate,
  onMaterialsNetRateChange,
  disabled = false,
}: PropsT) {
  const netPricingOn = materialsNetRate != null
  const mode: PricingModeT = netPricingOn ? 'net' : 'gross'
  const materialsNetPercent = Math.round((materialsNetRate ?? vatRate) * 100)
  const discountAmount = materialsNetDiscount(materialsGrossBase, materialsNetRate)

  function changeMode(next: string) {
    // Switching off clears the rate rather than storing 0: „nigdy nie ustawiono" is the state that
    // leaves marża exactly where it was.
    onMaterialsNetRateChange(next === 'net' ? vatRate : null)
  }

  return (
    <LabeledModeSelect
      label="Rozliczanie materiałów"
      value={mode}
      onValueChange={changeMode}
      options={PRICING_MODE_OPTIONS}
      description={PRICING_MODE_DESCRIPTIONS[mode]}
      disabled={disabled}
    >
      {netPricingOn && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Stawka netto wydatków</span>
          <DecimalField
            label=""
            value={materialsNetPercent}
            disabled={disabled}
            // Clamped to the range the action's schema accepts, so a fat-fingered 230 lands on 100%
            // instead of bouncing back as a validation toast.
            onCommit={(percent) =>
              onMaterialsNetRateChange(Math.min(Math.max(percent, 0), 100) / 100)
            }
          />
          <span className="text-muted-foreground text-xs">% (−{formatNet(discountAmount)} zł)</span>
        </div>
      )}
    </LabeledModeSelect>
  )
}
