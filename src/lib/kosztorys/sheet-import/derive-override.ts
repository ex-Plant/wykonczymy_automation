import type { SubcontractorOverrideTypeT } from '@/lib/kosztorys/types'
import { round6 } from '@/lib/utils/round'

// One view's per-item subcontractor override, in the editor's two źródła: `null` („auto", the
// investment's mnożnik) or a flat `'amount'` at the rate the sheet shows.
//
// `tracksClientPrice` is what makes „auto" earnable at all, and it is not the same question as „does
// the ratio come out round". It says the sheet DERIVES the rate from Cena j.m. by formula (or chains
// off a cell that does). A rate the owner TYPED that happens to land on the same ratio is not a link
// the owner ever made — send it to auto and it would start moving on the next Cena j.m. edit.
// A blank rate means 0, NOT "inherit the default coeff": the sheet has no inherit concept, and its
// subcontractor total (`SUM` over per-etap wartości) drops such rows to zero — a `null` override would
// instead invent a section/global-coeff cost the sheet never has. So a blank rate freezes an explicit
// flat 0.
// `planeCoeff` is the markup the cennik applies to everything (see `sheetCoeffs`), which the import
// writes into the investment's own settings. A formula row running at exactly that markup is not a
// decision about that praca, so it hands itself to the global as `null`. This is the ONE case where
// `null` is safe: it means the same number either way, because the global was just set to the sheet's
// own. Every other formula row freezes at the sheet's own rate — the value is the RATE, never the
// ratio, so the stawka the owner reads in the sheet is the stawka the app shows.
export function deriveOverride(
  rate: number,
  clientPrice: number,
  { tracksClientPrice, planeCoeff }: { tracksClientPrice: boolean; planeCoeff: number | null },
): { type: SubcontractorOverrideTypeT | null; value: number } {
  if (rate <= 0) return { type: 'amount', value: 0 }
  if (tracksClientPrice && clientPrice > 0) {
    const coeff = round6(rate / clientPrice)
    if (coeff === planeCoeff) return { type: null, value: 0 }
  }
  return { type: 'amount', value: rate }
}
