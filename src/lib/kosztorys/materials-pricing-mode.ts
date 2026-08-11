// Whether the investor is billed the receipt or a netto crossed from it. A view-level word, not a
// stored one: nothing persists it — the stored figure is the materiały rate, and null IS „brutto".
export type PricingModeT = 'gross' | 'net'

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
