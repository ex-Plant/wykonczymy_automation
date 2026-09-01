import { overrideTypeFor, subcontractorPrice } from '@/lib/kosztorys/calc'
import type { ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

/**
 * The cennik stawka one plane of a rozpiska pozycja implies, and the ONE place that rule lives.
 *
 * Its own nadpisanie — kwota or mnożnik — is a decision somebody made, so the effective kwota is
 * frozen into the cennik. No nadpisanie means the pozycja was only riding the inwestycja's global
 * współczynnik, and freezing that would weld one investment's współczynnik into a cennik every
 * future investment reads — so the plane goes in as `null` = „auto".
 */
export function impliedCatalogueRate(row: ViewPricingT, plane: ToolPlaneT): number | null {
  return overrideTypeFor(row, plane) === null ? null : subcontractorPrice(row, plane)
}
