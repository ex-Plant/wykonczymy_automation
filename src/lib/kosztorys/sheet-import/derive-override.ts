import type { SubcontractorOverrideTypeT } from '@/lib/kosztorys/types'
import { round6 } from '@/lib/utils/round'

// One view's per-item subcontractor override, mirroring what the cell does in the sheet rather than
// what its number happens to equal. A rate the sheet DERIVES from Cena j.m. becomes a `'coeff'`, so
// it keeps following that price here too; a rate the owner typed (or one chained off a typed cell,
// see `tracksClientPrice`) is frozen as a flat `'amount'` at face value. Dividing a typed rate by the
// client price instead would invent a multiplier nobody chose, re-multiply to a value short of the
// typed one by the rounding tail, and move the stawka on the next Cena j.m. edit.
// A blank rate means 0, NOT "inherit the default coeff": the sheet has no inherit concept, and its
// subcontractor total (`SUM` over per-etap wartości) drops such rows to zero — a `null` override would
// instead invent a section/global-coeff cost the sheet never has. So a blank rate freezes an explicit
// flat 0.
// `planeCoeff` is the markup the cennik applies to everything (see `sheetCoeffs`), which the import
// writes into the investment's own settings. A row running at exactly that markup is not a decision
// about that praca, so it hands itself to the global as `null` — „auto" — and the „Mnożnik" column is
// left showing only genuine exceptions. This is the ONE case where `null` is safe: it means the same
// number either way, because the global was just set to the sheet's own.
export function deriveOverride(
  rate: number,
  clientPrice: number,
  { tracksClientPrice, planeCoeff }: { tracksClientPrice: boolean; planeCoeff: number | null },
): { type: SubcontractorOverrideTypeT | null; value: number } {
  if (rate <= 0) return { type: 'amount', value: 0 }
  if (tracksClientPrice && clientPrice > 0) {
    const coeff = round6(rate / clientPrice)
    return coeff === planeCoeff ? { type: null, value: 0 } : { type: 'coeff', value: coeff }
  }
  return { type: 'amount', value: rate }
}
