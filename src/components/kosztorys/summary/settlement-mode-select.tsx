'use client'

import { Banknote, Coins, Split, type LucideIcon } from 'lucide-react'
import { SettingsSection } from '@/components/kosztorys/summary/settings-section'
import { SimpleSelect } from '@/components/ui/simple-select'
import { ZeroVatWarning } from '@/components/kosztorys/summary/zero-vat-warning'
import { SETTLEMENT_MODE_OPTIONS, type SettlementModeT } from '@/lib/kosztorys/settlement-mode'

// Only Mieszane earns a hint: „Brutto"/„Netto" say what they do, but Mieszane hands the owner a
// per-wydatek choice they have to make later, elsewhere.
const MODE_DESCRIPTIONS: Partial<Record<SettlementModeT, string>> = {
  MIXED:
    'Dodając wydatek inwestycyjny określasz czy ma on trafiać do puli netto czy puli brutto, suma liczy się na tej podstawie.',
}

// Hung here rather than on SETTLEMENT_MODE_OPTIONS itself: that module is reached from the Payload
// collection config, where a lucide value import would land in `payload generate:types`.
const MODE_ICONS: Record<SettlementModeT, LucideIcon> = {
  NET: Coins,
  GROSS: Banknote,
  MIXED: Split,
}

const MODE_OPTIONS = SETTLEMENT_MODE_OPTIONS.map((option) => ({
  ...option,
  icon: MODE_ICONS[option.value],
}))

type PropsT = {
  value: SettlementModeT
  onChange: (mode: SettlementModeT) => void
  vatRate: number
  disabled?: boolean
}

// The owner's only edit surface for the stored settlement mode — the panel renders it, the
// investment owns it. Pinned beside the view toggle rather than in the scrolling settings bar,
// because the reader who wonders why figures aren't moving is looking here.
//
// Never disabled at VAT 0% (EX-590): being the sole edit surface means a disable strands the
// investment in whatever mode it was stored as,  and the mode is not inert there anyway — Mieszane
// still splits the panel and doubles the grid's money columns, and the materiały netto rate is
// VAT-independent. The warning below explains the one thing VAT 0% *does* flatten.
export function SettlementModeSelect({ value, onChange, vatRate, disabled = false }: PropsT) {
  return (
    <SettingsSection
      title="Robocizna"
      subtitle="Wybierz sposób rozliczenia robocizny"
      hint={MODE_DESCRIPTIONS[value]}
    >
      <SimpleSelect
        value={value}
        onValueChange={(next) => onChange(next as SettlementModeT)}
        options={MODE_OPTIONS}
        disabled={disabled}
        variant="toolbarSm"
      />
      {vatRate === 0 && <ZeroVatWarning />}
    </SettingsSection>
  )
}
