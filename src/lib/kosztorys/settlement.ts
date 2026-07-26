import {
  globalDiscountAmount,
  netForQtyForView,
  rowDiscountForView,
  rowPlannedNetForView,
  viewPrice,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type {
  GlobalDiscountT,
  KosztorysStageT,
  KosztorysV2RowT,
  SectionSubtotalClientT,
  SectionSubtotalT,
} from '@/lib/kosztorys/types'

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
 * `stageTotalsForView` came to price one crew's etap at the other crew's rate.
 *
 * Idempotent, so it is safe to hand the filtered array back to `rowTotalQtyDone` et al.
 */
export function stagesForView(stages: KosztorysStageT[], view: PriceViewT): KosztorysStageT[] {
  return view === 'client' ? stages : stages.filter((st) => stageAppliesToView(st, view))
}

export type KosztorysClientTotalsT = {
  // Executed value at client prices, POST-rabat (Σ section net). The progress counter divides it by
  // the equally post-rabat plannedNet, so both sides of the ratio carry the rabat consistently.
  doneNet: number
  // „Suma prac wykonanych" at client prices, PRE-rabat — the executed value before any discount, so
  // it lines up with Σ LABOR_COST (a pre-rabat billing figure; rabat is a separate transfer). Under a
  // global discount the rows are already gross, so this is Σ net; under per-item rabat it adds the
  // taken discount back (Σ net + Σ discount) — the same figure the Podsumowanie „Suma prac" row shows.
  sumaPracNet: number
  // The client-view rabat: the global discount when active, else Σ per-item rabat. The two are
  // mutually exclusive (a live global discount forces every row gross, zeroing its per-item rabat),
  // so their sum is whichever mode is active.
  rabatClientNet: number
  // The global half of `rabatClientNet` on its own — robocizna is `doneNet − this`, and the per-item
  // rabat is already inside `doneNet`, so subtracting the whole `rabatClientNet` would take it twice.
  // Returned rather than recomputed by the caller: the base a global discount is taken against is one
  // decision, and the argument for it is written once, here.
  globalRabatNet: number
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
  const itemRabatNet = clientSubtotals.reduce((sum, s) => sum + s.discount, 0)
  const globalRabatNet = globalDiscountAmount(doneNet, globalDiscount)
  return {
    doneNet,
    sumaPracNet: doneNet + itemRabatNet,
    rabatClientNet: globalRabatNet + itemRabatNet,
    globalRabatNet,
  }
}

/**
 * Executed value at the ACTIVE view's price, PRE-rabat — `Σ(net + discount)` over that view's
 * subtotals. Same net+discount construction as `clientTotalsFromSubtotals`'s `sumaPracNet`, but
 * view-agnostic and with no global-discount add-back: the crew is owed its price regardless of any
 * client concession (rabat is absorbed by the company margin, not passed to the subcontractor). Under
 * a global discount `net` is already gross and `discount` is 0, so the identity still holds.
 *
 * The subcontractor summary now uses `subcontractorDueByPlane` (per-etap, plane-aware); this remains
 * as the single-plane parity oracle its per-stage sum collapses to.
 */
export function executedWorkNetPreRabat(subtotals: SectionSubtotalT[]): number {
  return subtotals.reduce((sum, s) => sum + s.net + s.discount, 0)
}

export type SubcontractorDueByPlaneT = {
  wTools: number
  ownTools: number
  combined: number
  hasUnconfirmedPlane: boolean
}

/**
 * The view-independent subcontractor settlement: each etap's executed qty valued PRE-rabat at that
 * etap's OWN plane, summed per plane and combined. This is the honest money „Podsumowanie
 * podwykonawców" shows — unlike the per-view passes, which reprice 100% of executed work at one
 * plane's price and so double-count on a mixed investment (per etap the relationship is OR: one crew
 * executed it, at one plane's price).
 *
 * Per-stage value = `stageQty × viewPrice(row, plane)`. Pre-rabat is LINEAR in qty (the
 * `rowDiscountForView` identity: `qty·viewPrice − netForQtyForView = discount`), so no qty-share
 * splitting and no discount handling — rabat is a client concession the crew is still owed past, and
 * a global discount never reaches subcontractors either. For a single-plane investment the per-stage
 * sum collapses to `totalQty × viewPrice`, i.e. exactly `executedWorkNetPreRabat` at that view.
 *
 * A `null` plane belongs to neither crew — it is skipped and raises `hasUnconfirmedPlane`: the two
 * amounts render short, the warning sits next to them (recon-mismatch pattern).
 */
export function subcontractorDueByPlane(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
): SubcontractorDueByPlaneT {
  let wTools = 0
  let ownTools = 0
  let hasUnconfirmedPlane = false
  for (const st of stages) {
    const plane = st.plane
    const key = stageKey(st.id)
    if (plane === null) {
      // Gated on the etap actually holding qty: the badge this drives claims the sum is SHORT, and a
      // freshly added empty etap makes that claim false — it would scream about missing money that
      // does not exist yet.
      hasUnconfirmedPlane ||= rows.some((row) => row[key])
      continue
    }
    let planeTotal = 0
    for (const row of rows) {
      const qty = row[key] ?? 0
      if (qty) planeTotal += qty * viewPrice(row, plane)
    }
    if (plane === 'w_tools') wTools += planeTotal
    else ownTools += planeTotal
  }
  return { wTools, ownTools, combined: wTools + ownTools, hasUnconfirmedPlane }
}

/**
 * The "Pomiar z natury" itself — the sheet's O = SUM(D:M), not a stored field (EX-494).
 *
 * Scoped to the view's etapy: in a subcontractor view the pomiar is that crew's pomiar, so every
 * figure standing on it (row wartość, section subtotals, „Razem") counts one crew's work at one
 * crew's price. `view` is REQUIRED, not defaulted — a default would silently restore the plane-blind
 * reading at any call site that forgets it, which is the exact bug this parameter exists to kill.
 */
export function rowTotalQtyDone(
  row: KosztorysV2RowT,
  stages: KosztorysStageT[],
  view: PriceViewT,
): number {
  return stages.reduce(
    (sum, st) => (stageAppliesToView(st, view) ? sum + (row[stageKey(st.id)] ?? 0) : sum),
    0,
  )
}

/**
 * The row's settlement value at the view's price — the sheet's T: what has actually been executed.
 *
 * There is no choice of quantity to make here (EX-494): the pomiar IS the stage sum, so a branch
 * "pomiar or stages?" would be picking between a number and itself. This is the reason the
 * settlement layer lives here and not in calc.ts — the quantity comes from the stages, and calc.ts
 * is the pricing layer, structurally stage-blind. It owns the price beneath this; we own the
 * quantity above it.
 *
 * Straight from the primitive rather than Σ stageValueForView: the shares sum to 1, so the reduce
 * would buy the same figure at O(stages) and a rounding error.
 */
export function rowValueForView(
  row: KosztorysV2RowT,
  stages: KosztorysStageT[],
  view: PriceViewT,
): number {
  return netForQtyForView(row, rowTotalQtyDone(row, stages, view), view)
}

/**
 * How much of the OFFER is left: the przedmiar's value minus what the stages have executed.
 *
 * This is where we knowingly break parity with the sheet. Its AF anchors on T — the executed value —
 * and since O IS the stage sum, AF = T − Σ(V:AE) is identically zero: a dead column. Anchored on S
 * instead, the figure says something ("how much of the offer is left") and can go negative, which is
 * also information: more was executed than was offered.
 *
 * `null`, not 0, when there is no przedmiar — 0 would claim the row is settled. The guard is `> 0`
 * rather than `=== 0` because a cleared cell writes null, which strict equality walks past.
 */
export function rowRemainingForView(
  row: KosztorysV2RowT,
  stages: KosztorysStageT[],
  view: PriceViewT,
): number | null {
  if (!(row.plannedQty > 0)) return null
  return rowPlannedNetForView(row, view) - rowValueForView(row, stages, view)
}

/**
 * Was more executed than was offered? Drives the row's red highlight.
 *
 * Deliberately NOT "przedmiar ≠ Σ etapów": a half-finished row is normal work in progress, and
 * flagging it would paint the whole grid red on a healthy kosztorys. Work recorded against no
 * przedmiar at all is not a separate branch — it is the przedmiar-is-0 case, which every stage
 * overshoots.
 *
 * Hard-anchored to the client pomiar, not the active view: the przedmiar has no plane (it is typed
 * once per row for the whole offered scope), so comparing one crew's share against it would flag
 * „under-plan" on work the other crew finished.
 */
export function hasStagesOverPlanned(row: KosztorysV2RowT, stages: KosztorysStageT[]): boolean {
  return rowTotalQtyDone(row, stages, 'client') > (row.plannedQty ?? 0)
}

/**
 * The etap axis: per-stage column total across all rows at the active view's price — the sheet's
 * `SUM(<stage col>)` per etap (filled r396/r397). The suma transzy: how much value each etap has
 * executed. Every stage in `stages` gets an entry (0 when no row touched it).
 *
 * Uses the same `stageValueForView` primitive the grid's per-stage cells show — each stage's value
 * is its qty share of the row's executed net — so Σ over the stages equals the row's executed value,
 * and Σ over all stages equals the executed total (the 'amount'-rabat reconciliation the sheet's
 * V–AE block exists for holds here by construction).
 */
export function stageTotalsForView(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
  view: PriceViewT,
): Map<number, number> {
  // Seeded over ALL stages, iterated over the view's own: an out-of-view etap must still report 0
  // rather than go missing, but it must never take a share of a total built without it — give it one
  // and it draws > 1 of the row, so Σ per-etap overshoots „Razem" by a multiple.
  const totals = new Map<number, number>(stages.map((st) => [st.id, 0]))
  const viewStages = stagesForView(stages, view)
  for (const row of rows) {
    const totalQty = rowTotalQtyDone(row, viewStages, view)
    if (!(totalQty > 0)) continue
    // Price the row's executed net once, then split it by each stage's qty share — same figure
    // stageValueForView yields per cell, but without re-pricing the row on every stage.
    const rowNet = netForQtyForView(row, totalQty, view)
    for (const st of viewStages) {
      const qtyInStage = row[stageKey(st.id)] ?? 0
      if (!qtyInStage) continue
      totals.set(st.id, (totals.get(st.id) ?? 0) + rowNet * (qtyInStage / totalQty))
    }
  }
  return totals
}

/**
 * Subtotals per section for the active price view, over the full dataset (ignores filter/sort).
 * Order = first occurrence of each section in `rows` (treeToRows already yields section→displayOrder).
 *
 * Carries BOTH figures, the way the sheet's footer keeps S456 and T456 side by side: `plannedNet` is
 * what was offered, `net` what has been executed. Nothing has to choose between them, and the
 * progress counter divides one by the other.
 */
// Overloaded on the literal so a caller that pins 'client' gets the przedmiar figure typed as present
// and never writes a `?? 0` for a case it already excluded, while a caller passing a `view` variable
// is forced to handle the null. The guarantee is structural — it cannot be forgotten at a call site.
export function sectionSubtotalsForView(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
  view: 'client',
): SectionSubtotalClientT[]
export function sectionSubtotalsForView(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
  view: PriceViewT,
): SectionSubtotalT[]
export function sectionSubtotalsForView(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
  view: PriceViewT,
): SectionSubtotalT[] {
  const bySection = new Map<number, SectionSubtotalT>()
  // completionRatio AND share are progress/structure figures, so both are weighted at the client price
  // regardless of `view`: per-item price overrides shift a section's executed VALUE against the others,
  // so the same physical progress and the same cost split must not read differently per view.
  // Accumulated apart from the money net above, which does follow the view.
  const clientBySection = new Map<number, { executed: number; offered: number }>()
  const viewStages = stagesForView(stages, view)
  for (const row of rows) {
    let acc = bySection.get(row.sectionId)
    if (!acc) {
      acc = {
        sectionId: row.sectionId,
        sectionName: row.sectionName,
        sectionColor: row.sectionColor,
        net: 0,
        plannedNet: view === 'client' ? 0 : null,
        discount: 0,
        share: 0,
        completionRatio: null,
        itemCount: 0,
      }
      bySection.set(row.sectionId, acc)
      clientBySection.set(row.sectionId, { executed: 0, offered: 0 })
    }
    // One pomiar per row, priced twice: the value and the rabat taken on it must stand on the same
    // quantity or a section's net and discount describe different amounts of work.
    const qtyDone = rowTotalQtyDone(row, viewStages, view)
    acc.net += netForQtyForView(row, qtyDone, view)
    if (acc.plannedNet !== null) acc.plannedNet += rowPlannedNetForView(row, view)
    // 0 under a global discount.
    acc.discount += rowDiscountForView(row, qtyDone, view)
    acc.itemCount += 1
    const client = clientBySection.get(row.sectionId)!
    client.executed += rowValueForView(row, stages, 'client')
    client.offered += rowPlannedNetForView(row, 'client')
  }
  const result = [...bySection.values()]
  for (const s of result) {
    const client = clientBySection.get(s.sectionId)!
    s.completionRatio = client.offered > 0 ? client.executed / client.offered : null
  }
  const grandClientNet = [...clientBySection.values()].reduce((sum, c) => sum + c.executed, 0)
  if (grandClientNet > 0)
    for (const s of result) s.share = clientBySection.get(s.sectionId)!.executed / grandClientNet
  return result
}

/**
 * Sections with nothing executed yet — the ones the filter menu's „Ukryj puste sekcje" row unticks,
 * and the count it shows.
 *
 * "Pusta" is no WORK DONE, not no positions: a section with no items is cascade-deleted, so that
 * state never reaches the grid.
 */
export function emptySectionIds(subtotals: SectionSubtotalT[]): Set<number> {
  return new Set(subtotals.filter((s) => s.net === 0).map((s) => s.sectionId))
}
