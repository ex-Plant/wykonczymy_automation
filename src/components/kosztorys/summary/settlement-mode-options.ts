import { Banknote, Coins, Split, type LucideIcon } from 'lucide-react'
import { SETTLEMENT_MODE_OPTIONS, type SettlementModeT } from '@/lib/kosztorys/settlement-mode'

// Only Mieszane earns a hint: „Brutto"/„Netto" say what they do, but Mieszane hands the owner a
// per-wydatek choice they have to make later, elsewhere.
export const SETTLEMENT_MODE_DESCRIPTIONS: Partial<Record<SettlementModeT, string>> = {
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

// One options array for every surface that edits the mode — the popover section and the inline
// control in the Podsumowanie tab — so the two can never offer different modes or different icons.
export const SETTLEMENT_MODE_SELECT_OPTIONS = SETTLEMENT_MODE_OPTIONS.map((option) => ({
  ...option,
  icon: MODE_ICONS[option.value],
}))
