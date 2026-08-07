'use client'

import { Banknote, Coins } from 'lucide-react'
import { SettingsSection } from '@/components/kosztorys/summary/settings-section'
import { SimpleSelect, type SelectOptionT } from '@/components/ui/simple-select'
import { DecimalField } from '@/components/ui/decimal-field'

type PricingModeT = 'gross' | 'net'

const PRICING_MODE_OPTIONS: SelectOptionT[] = [
  { value: 'gross', label: 'Brutto', icon: Banknote },
  { value: 'net', label: 'Netto', icon: Coins },
]

const PRICING_MODE_DESCRIPTIONS: Record<PricingModeT, string> = {
  gross: 'Wydatki inwestycyjne rozliczane po kwotach brutto z faktury (domyślne).',
  net: 'Wydatki inwestycyjne rozliczane po kwocie netto z faktury. \nStawkę vat ustawiasz poniżej. Kwota brutto zostanie pomniejszona o vat.',
}

type PropsT = {
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
  vatRate,
  materialsNetRate,
  onMaterialsNetRateChange,
  disabled = false,
}: PropsT) {
  const netPricingOn = materialsNetRate != null
  const mode: PricingModeT = netPricingOn ? 'net' : 'gross'
  const materialsNetPercent = Math.round((materialsNetRate ?? vatRate) * 100)

  function changeMode(next: string) {
    // Switching off clears the rate rather than storing 0: „nigdy nie ustawiono" is the state that
    // leaves marża exactly where it was.
    onMaterialsNetRateChange(next === 'net' ? vatRate : null)
  }

  return (
    <SettingsSection
      title="Materiały"
      subtitle="Wybierz sposób rozliczenia materiałów"
      hint={PRICING_MODE_DESCRIPTIONS[mode]}
    >
      <SimpleSelect
        value={mode}
        onValueChange={changeMode}
        options={PRICING_MODE_OPTIONS}
        disabled={disabled}
        variant="toolbarSm"
      />
      {netPricingOn && (
        <DecimalField
          label="Stawka vat na materiały"
          labelAbove
          suffix="%"
          withSave
          value={materialsNetPercent}
          disabled={disabled}
          // Clamped to the range the action's schema accepts, so a fat-fingered 230 lands on 100%
          // instead of bouncing back as a validation toast.
          onCommit={(percent) =>
            onMaterialsNetRateChange(Math.min(Math.max(percent, 0), 100) / 100)
          }
        />
      )}
    </SettingsSection>
  )
}
