'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import { fetchPayoutsByWorkerForInvestment } from '@/lib/queries/investment-transactions'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { subcontractorDueByPlane } from '@/lib/kosztorys/settlement'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import {
  computeSubcontractorSummary,
  resolvePayoutWorkerNames,
  type SubcontractorWorkerRowT,
} from '@/lib/kosztorys/subcontractor-summary'
import { perfStart } from '@/lib/perf'

export type SubcontractorRosterT = {
  rows: SubcontractorWorkerRowT[]
  // Etapy with executed work and nobody assigned — the reason the per-person „pozostało" figures
  // below read SHORT.
  unassignedStageCount: number
}

/**
 * The per-worker settlement for one investment, computed server-side for a host that cannot reach
 * editor state (the wypłata dialog lives outside the kosztorys page entirely).
 *
 * Deliberately NOT a second derivation: it walks the same `subcontractorDueByPlane` →
 * `computeSubcontractorSummary` pair the panel does, over `treeToRows` of the persisted tree. The
 * editor feeds those functions live grid state, this feeds them the saved tree — one derivation, two
 * feeds. A parity spec pins the two against each other, because the failure mode here is precisely
 * the one `context/foundation/lessons.md` records: two surfaces quoting a different amount for the
 * same money, both green.
 *
 * Unsaved edits in an open editor are not in these figures. That is correct for a dialog on another page — it can only honestly report what
 * is persisted — but it is why the manual check compares the two with nothing unsaved.
 */
export async function getSubcontractorRoster(investmentId: number): Promise<SubcontractorRosterT> {
  const elapsed = perfStart()
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  const [tree, payouts, { workers }] = await Promise.all([
    buildKosztorysTree(investmentId),
    fetchPayoutsByWorkerForInvestment(investmentId),
    fetchReferenceData(),
  ])

  const rows = treeToRows(tree)
  const due = subcontractorDueByPlane(rows, tree.stages)
  const summary = computeSubcontractorSummary(
    due.combined,
    resolvePayoutWorkerNames(payouts, workers),
    { byWorker: due.byWorker, stages: tree.stages, workers },
  )

  console.log(`[PERF] getSubcontractorRoster(${investmentId}) ${elapsed()}ms`)

  return {
    rows: summary.rows,
    // Gated on `byWorker`, not on the raw stage list: an unassigned etap with nothing executed on it
    // takes nothing away from anyone, so warning about it would be noise on a fresh kosztorys.
    unassignedStageCount: tree.stages.filter(
      (stage) => stage.workerId === null && (due.byStage.get(stage.id) ?? 0) > 0,
    ).length,
  }
}
