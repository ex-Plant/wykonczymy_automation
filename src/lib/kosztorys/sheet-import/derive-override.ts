import type { SubcontractorOverrideTypeT } from '@/lib/kosztorys/types'

// Six places is what the editor's own coefficient field stores (`subcontractor-price-edit`), so a
// derived coefficient survives a round-trip through it unchanged.
export const round6 = (value: number): number => Math.round(value * 1e6) / 1e6

// One view's per-item subcontractor override. A rate over a positive client price becomes a `'coeff'`
// (tracks the client price); a rate with no client price is frozen as a flat `'amount'`. A blank rate
// means 0, NOT "inherit the default coeff": the sheet has no inherit concept, and its subcontractor
// total (`SUM` over per-etap wartości) drops such rows to zero — a `null` override would instead invent
// a section/global-coeff cost the sheet never has. So a blank rate freezes an explicit flat 0.
export function deriveOverride(
  rate: number,
  clientPrice: number,
): { type: SubcontractorOverrideTypeT | null; value: number } {
  if (rate <= 0) return { type: 'amount', value: 0 }
  if (clientPrice > 0) return { type: 'coeff', value: round6(rate / clientPrice) }
  return { type: 'amount', value: rate }
}
