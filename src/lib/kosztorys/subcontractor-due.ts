import { viewPrice } from '@/lib/kosztorys/calc'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

export type SubcontractorDueByPlaneT = {
  wTools: number
  ownTools: number
  combined: number
  hasUnconfirmedPlane: boolean
  // Per-etap executed value at that etap's own plane — the `planeTotal` the loop already holds.
  // Emitted so the header's reassignment confirm quotes the same figure the panel does instead of
  // recomputing it inline. A plane-less etap has no entry: it contributes to no bill.
  byStage: Map<number, number>
  // The same money partitioned by WHO is to do it (EX-613), `null` = etapy with nobody assigned.
  // Σ values === `combined` by construction — the residual is its own entry, never spread over the
  // assigned workers. Two consequences worth knowing before reading a figure off this:
  // - a worker spanning both planes is NOT derivable from `wTools`/`ownTools`; only this map knows.
  // - a plane-less etap credits nobody, assigned or not — it is skipped before this map is touched,
  //   so a worker can hold etapy and still owe 0 (`hasUnconfirmedPlane` is what says why).
  byWorker: Map<number | null, number>
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
 * sum collapses to `totalQty × viewPrice`, i.e. exactly `sumSectionSubtotalsNet` at that view.
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
  const byStage = new Map<number, number>()
  const byWorker = new Map<number | null, number>()
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
    byStage.set(st.id, planeTotal)
    byWorker.set(st.workerId, (byWorker.get(st.workerId) ?? 0) + planeTotal)
  }
  return { wTools, ownTools, combined: wTools + ownTools, hasUnconfirmedPlane, byStage, byWorker }
}
