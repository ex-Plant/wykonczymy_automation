import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

/**
 * Does this etap belong to the active price view? The client view shows every etap (it never filters,
 * only reprices). A subcontractor view is that crew's bill, so it accepts only `stage.plane === view`
 * — per etap the relationship is OR: one crew executed it, at one price.
 *
 * An undecided plane (`null`) is NOT a plane and matches neither view: charging it to a crew nobody
 * picked would be a fabricated debt. The accepted cost is that while any etap is unassigned the two
 * crews' bills no longer sum to the executed work — `hasUnconfirmedPlane` is what says so.
 *
 * Owned here so the settlement math and the grid's column set can never disagree on the rule.
 */
export function stageAppliesToView(stage: KosztorysStageT, view: PriceViewT): boolean {
  if (view === 'client') return true
  return stage.plane === view
}

/**
 * The view's own etapy as a named collection, so view-scoped code iterates something that says it is
 * view-scoped. Every per-stage aggregation used to re-derive this inline, which made a plain
 * `for (const st of stages)` inside view-scoped code look normal — that shape is exactly how
 * `stageAxisForView` came to price one crew's etap at the other crew's rate.
 *
 * Idempotent, so it is safe to hand the filtered array back to `rowTotalQtyDone` et al.
 */
export function stagesForView(stages: KosztorysStageT[], view: PriceViewT): KosztorysStageT[] {
  return view === 'client' ? stages : stages.filter((st) => stageAppliesToView(st, view))
}
