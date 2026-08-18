import type { InvestmentFinancialsT } from '@/types/investment-financials'

/** The crew side of the margin, as `subcontractorDueByPlane` reports it — the amount and the reason
 *  it may be short. Taken as one object so a caller cannot pass the amount and drop the caveat. */
export type SubcontractorSettlementT = {
  /** Executed work valued pre-rabat, each etap at its own plane. */
  due: number
  /** Some etap holds executed work with no settlement plane, so `due` is short by an unknown amount. */
  hasUnconfirmedPlane: boolean
}

/**
 * The margin as of EX-649: robocizna less rabat, less what the kosztorys says the crew is owed, less
 * the material priced into robocizna, less strata.
 *
 * It stands BESIDE `calculateMargin`, which is untouched and still live on v1, `/raporty` and the
 * existing listing column — the owner wants the two readings side by side (2026-08-18). Two
 * deliberate differences from it:
 * - `totalPayouts` is gone, replaced by `due`. Σ PAYOUT is cash and moves on its own rhythm, so a
 *   crew paid late reads as profit and a crew paid ahead reads as a loss the kosztorys never
 *   predicted. What is owed moves with the work.
 * - `materialsNetDiscount` is gone. Billing materiały netto rather than at the brutto receipt is a
 *   concession on a pass-through, not a cost of doing the work. **Its removal is not the booking of
 *   reclaimed VAT as profit** — that reading was rejected twice (2026-07-26) and stays rejected; the
 *   term simply does not belong in a figure about robocizna.
 *
 * `totalSettled` and `totalLoss` remain transaction-sourced: the kosztorys cannot know either.
 *
 * **Returns `null`, not a number, when the crew side is incomplete.** An etap holding executed work
 * with no settlement plane contributes nothing to `due` while its robocizna still counts, so the
 * figure would read high by an unknown amount. Zero would assert the work was free and a default
 * plane would guess what the owner has to pick anyway — so there is no figure until the etapy are
 * set. `null` rather than a flag beside the amount, so no caller can render the number by accident.
 */
export function marginV2(
  f: InvestmentFinancialsT,
  subcontractor: SubcontractorSettlementT,
): number | null {
  if (subcontractor.hasUnconfirmedPlane) return null
  return f.totalLaborCosts - f.totalDiscount - subcontractor.due - f.totalSettled - f.totalLoss
}
