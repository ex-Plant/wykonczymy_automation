import { effectiveCoeff, subcontractorPrice } from '@/lib/kosztorys/calc'
import { formatNet } from '@/lib/kosztorys/format'
import type { ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

/**
 * The company's floor on its own cut: a subcontractor may be paid at most this share of the client
 * price. A code constant rather than a per-investment column — it is a business rule, not a
 * negotiated parameter, and one the owner never wants a per-sheet exception to.
 */
export const MAX_CLIENT_SHARE = 0.8

export type SubcontractorPriceIssueT = { severity: 'error' | 'warning'; message: string }

// Half a grosz. Both comparisons are strictly-greater, so without slack a kwota stała re-typed at the
// coefficient price (that price rounded to two decimals and entered by hand) reads as "above" on a
// floating-point remainder and goes amber for no reason the owner can see.
const TOLERANCE = 0.005

/** The ceiling in PLN — named by the rejection tooltip, so it must come from the same constant. */
export function maxSubcontractorPrice(row: ViewPricingT): number {
  return row.clientPrice * MAX_CLIENT_SHARE
}

/**
 * The one rule: what is wrong with this row's subcontractor price on this plane, if anything.
 *
 * Reads `subcontractorPrice` / `effectiveCoeff` rather than re-deriving either, so the guard can
 * never disagree with the price the grid actually shows. Carries its own Polish message — no
 * consumer composes a sentence, so the tooltip and the cell cannot word the same verdict differently.
 *
 * An 'auto' row can only ever be `error`, never `warning`: under a null override the price IS
 * `clientPrice × effectiveCoeff`, so the warning comparison is an equality. Its only failure mode is
 * a global coefficient above the ceiling, which the settings field now refuses — leaving red for the
 * coefficients that predate this guard.
 */
export function checkSubcontractorPrice(
  row: ViewPricingT,
  view: ToolPlaneT,
): SubcontractorPriceIssueT | null {
  // Both comparisons are against the client price; at zero the ceiling is zero and every non-zero
  // subcontractor price would read as an error on a row nobody has priced yet.
  if (!(row.clientPrice > 0)) return null

  const price = subcontractorPrice(row, view)
  const ceiling = maxSubcontractorPrice(row)
  if (price > ceiling + TOLERANCE) {
    return {
      severity: 'error',
      message: `Cena wykonawcy nie może przekroczyć ${MAX_CLIENT_SHARE * 100}% ceny klienta (maks. ${formatNet(ceiling)}).`,
    }
  }

  const coeffPrice = row.clientPrice * effectiveCoeff(row, view)
  if (price > coeffPrice + TOLERANCE) {
    return {
      severity: 'warning',
      message: `Cena powyżej stawki z globalnego mnożnika (${formatNet(coeffPrice)}). Pozycja liczy się normalnie.`,
    }
  }

  return null
}
