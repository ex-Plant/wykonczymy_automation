import { globalDiscountAmount } from '@/lib/kosztorys/calc'
import { sectionSubtotalsForView } from '@/lib/kosztorys/settlement-aggregates'
import type {
  GlobalDiscountT,
  KosztorysStageT,
  KosztorysV2RowT,
  SectionSubtotalT,
} from '@/lib/kosztorys/types'

export type KosztorysClientTotalsT = {
  // Executed value at client prices, POST-rabat (Σ section net). The progress counter divides it by
  // the equally post-rabat plannedNet, so both sides of the ratio carry the rabat consistently.
  doneNet: number
  // „Suma prac wykonanych" at client prices, PRE-rabat — the executed value before any discount, so
  // it lines up with Σ LABOR_COST (a pre-rabat billing figure; rabat is a separate transfer). Under a
  // global discount the rows are already gross, so this is Σ net; under per-item rabat it adds the
  // taken discount back (Σ net + Σ discount) — the same figure the Podsumowanie „Suma prac" row shows.
  laborCostsNetFromKosztorys: number
  // The client-view rabat: the global discount when active, else Σ per-item rabat. The two are
  // mutually exclusive (a live global discount forces every row gross, zeroing its per-item rabat),
  // so their sum is whichever mode is active.
  discountNetFromKosztorys: number
  // The global half of `discountNetFromKosztorys` on its own — robocizna is `doneNet − this`, and the per-item
  // rabat is already inside `doneNet`, so subtracting the whole `discountNetFromKosztorys` would take it twice.
  // Returned rather than recomputed by the caller: the base a global discount is taken against is one
  // decision, and the argument for it is written once, here.
  globalDiscountNet: number
}

/**
 * The two client-view figures the robocizna/rabat reconciliation compares against, computed here so
 * BOTH verification surfaces share one code path: the editor (client-side, live rows) and the
 * investment page (server-side, persisted rows). A second copy of this formula on either surface is
 * exactly the two-planes-both-green drift `context/foundation/lessons.md` records — so there is one.
 *
 * Client view, not the active price view: robocizna is a client-billing figure, so the price-view
 * toggle must never move it.
 */
export function kosztorysClientTotals(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
  globalDiscount: GlobalDiscountT,
): KosztorysClientTotalsT {
  return clientTotalsFromSubtotals(sectionSubtotalsForView(rows, stages, 'client'), globalDiscount)
}

/**
 * The formula core, split from the rows-based entry so a caller that ALREADY holds the client-view
 * subtotals (the editor hook computes them for the progress counter) reuses them instead of running
 * the full client-view pass twice per render — on a 1000+ row grid that second pass is not free. The
 * server recon block has only rows, so it goes through `kosztorysClientTotals`; both funnel here, so
 * the single-source-of-truth invariant holds.
 */
export function clientTotalsFromSubtotals(
  clientSubtotals: SectionSubtotalT[],
  globalDiscount: GlobalDiscountT,
): KosztorysClientTotalsT {
  // `net` is post-rabat (netForQtyForView applies the discount); `discount` is the rabat taken. The
  // global discount comes off the executed work, so its base is the post-item-rabat net (which under a
  // global discount is the full gross, per-item rabat being zeroed).
  const doneNet = clientSubtotals.reduce((sum, s) => sum + s.net, 0)
  const itemDiscountNet = clientSubtotals.reduce((sum, s) => sum + s.discount, 0)
  const globalDiscountNet = globalDiscountAmount(doneNet, globalDiscount)
  return {
    doneNet,
    laborCostsNetFromKosztorys: doneNet + itemDiscountNet,
    discountNetFromKosztorys: globalDiscountNet + itemDiscountNet,
    globalDiscountNet,
  }
}

/**
 * Executed value at the ACTIVE view's price, PRE-rabat — `Σ(net + discount)` over that view's
 * subtotals. Same net+discount construction as `clientTotalsFromSubtotals`'s `laborCostsNetFromKosztorys`, but
 * view-agnostic and with no global-discount add-back: the crew is owed its price regardless of any
 * client concession (rabat is absorbed by the company margin, not passed to the subcontractor). Under
 * a global discount `net` is already gross and `discount` is 0, so the identity still holds.
 *
 * So it equals `laborCostsNetPreDiscount` only on the client view — feed it `w_tools`/`no_tools`
 * subtotals and the two figures legitimately differ.
 *
 * The subcontractor summary now uses `subcontractorDueByPlane` (per-etap, plane-aware); this remains
 * as the single-plane parity oracle its per-stage sum collapses to.
 */
export function sumSectionSubtotalsNet(subtotals: SectionSubtotalT[]): number {
  return subtotals.reduce((sum, s) => sum + s.net + s.discount, 0)
}
