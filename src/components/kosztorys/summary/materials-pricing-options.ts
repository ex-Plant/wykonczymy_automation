import { Banknote, Coins } from 'lucide-react'
import type { SelectOptionT } from '@/components/ui/simple-select'

// Whether the investor is billed the receipt or a netto crossed from it. Local to the summary panel:
// nothing persists this word — the stored figure is the materiały rate, and null IS „brutto".
export type PricingModeT = 'gross' | 'net'

export const PRICING_MODE_OPTIONS: SelectOptionT[] = [
  { value: 'gross', label: 'Brutto', icon: Banknote },
  { value: 'net', label: 'Netto', icon: Coins },
]

export const PRICING_MODE_DESCRIPTIONS: Record<PricingModeT, string> = {
  gross: 'Wydatki inwestycyjne rozliczane po kwotach brutto z faktury (domyślne).',
  net: 'Wydatki inwestycyjne rozliczane po kwocie netto z faktury. \nStawkę vat ustawiasz poniżej. Kwota brutto zostanie pomniejszona o vat.',
}

// The server hard-zeroes the concession at tryb brutto (investment-financials.ts), so a stawka set
// there would persist, print a discount and move no figure. Shared by both surfaces that offer the
// choice, so neither can explain the lock differently.
export const MATERIALS_GROSS_LOCK_REASON =
  'Przy rozliczeniu brutto klient płaci pełne kwoty z faktur — nie ma czego odliczyć, więc stawka nie ruszyłaby żadnej kwoty. Zmień rozliczenie robocizny na netto lub mieszane, żeby ją ustawić.'

// null is not „no rate yet" but „settles brutto" — switching off clears the rate rather than storing
// 0, because „nigdy nie ustawiono" is the state that leaves marża exactly where it was.
export function pricingModeOf(materialsNetRate: number | null): PricingModeT {
  return materialsNetRate == null ? 'gross' : 'net'
}

// Switching to netto seeds the saved rate at VAT: billing materiały netto at the VAT rate is the case
// this feature was built for, so it is one click rather than a number to look up.
export function materialsNetRateForMode(mode: string, vatRate: number): number | null {
  return mode === 'net' ? vatRate : null
}
