import { rowPlannedNetPreDiscountForView } from '@/lib/kosztorys/calc'
import type { ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

export type MarginForecastT = {
  /** The przedmiar at the client price, pre-rabat. */
  clientNet: number
  /** The same przedmiar priced at the chosen crew's rate. */
  subcontractorNet: number
  margin: number
}

/**
 * The forecast margin: the whole offered scope priced for the investor, less the same scope priced
 * for one crew. A scenario, not a projection — the reader picks a plane and the number holds still
 * (EX-649). Rows carrying a hand-typed subcontractor amount are per-plane already, so the toggle
 * distinguishes them without any special case here.
 *
 * Stage-blind on purpose, and that is the whole difference from `marginV2`: the przedmiar is what
 * was offered, so no etap, no executed qty and no etap's plane enters — which is also why the
 * forecast still renders when `marginV2` is withheld for want of a settlement plane.
 *
 * Three terms of the actual margin are deliberately absent: rabat (not granted up front), strata and
 * settled material (neither is forecastable). The consequence to state wherever this is rendered —
 * it is **marża before material**: on a row whose client price includes material, the przedmiar
 * carries that material's revenue and none of its cost, so the forecast sits structurally above the
 * actual and the two never converge. The kosztorys cannot know which rows those are.
 */
export function marginForecast(rows: ViewPricingT[], plane: ToolPlaneT): MarginForecastT {
  let clientNet = 0
  let subcontractorNet = 0
  for (const row of rows) {
    clientNet += rowPlannedNetPreDiscountForView(row, 'client')
    subcontractorNet += rowPlannedNetPreDiscountForView(row, plane)
  }
  return { clientNet, subcontractorNet, margin: clientNet - subcontractorNet }
}
