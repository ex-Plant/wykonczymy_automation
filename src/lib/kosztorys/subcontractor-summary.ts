import type { WorkerRefT } from '@/types/reference-data'
import type { PayoutByWorkerT, SubcontractorPayoutRowT } from '@/types/transfers'

// Display label for the null-worker payout bucket (a cash PAYOUT with no worker attached). One source
// shared by the page's name-enrichment and the block's fallback so the two can't drift apart.
export const UNASSIGNED_WORKER_NAME = 'Bez przypisanego pracownika'

// Map/React key for a payout row: the null-worker bucket needs a stable non-null key so it can sit
// in the same lookup as the real workers.
const UNASSIGNED_KEY = 'unassigned'
export const workerKey = (workerId: number | null) =>
  workerId === null ? UNASSIGNED_KEY : workerId

// The name join the cached payout query deliberately skips — every host that renders the block does
// it, so it lives here rather than being retyped per page.
export function resolvePayoutWorkerNames(
  payouts: PayoutByWorkerT[],
  workers: WorkerRefT[],
): SubcontractorPayoutRowT[] {
  const nameById = new Map(workers.map((worker) => [worker.id, worker.name]))
  return payouts.map((row) => ({
    ...row,
    name:
      row.workerId === null
        ? UNASSIGNED_WORKER_NAME
        : (nameById.get(row.workerId) ?? 'Nieznany pracownik'),
  }))
}

export type SubcontractorSummaryT = {
  // „Suma wykonanej pracy" (należne) — executed value at the active view's subcontractor price, pre-rabat.
  dueNet: number
  // Σ realized PAYOUTs on this investment (all workers incl. the null bucket).
  payoutsTotal: number
  // „Pozostało do wypłaty" = dueNet − payoutsTotal. Negative = the crew has been overpaid.
  remaining: number
  // Per-worker rows, sorted by amount desc with the null-worker bucket („Bez przypisanego pracownika")
  // pinned last regardless of its total, so an unattributed lump never leads the list.
  rows: SubcontractorPayoutRowT[]
}

/**
 * Pure block figures for „Podsumowanie podwykonawców". Whole-investment amounts (both `dueNet` and
 * `payoutsTotal` are investment-level), so `remaining` is the total still owed to the whole crew — it
 * deliberately does not attribute work to individual workers (no work↔worker link exists).
 */
export function computeSubcontractorSummary(
  dueNet: number,
  payouts: SubcontractorPayoutRowT[],
): SubcontractorSummaryT {
  const payoutsTotal = payouts.reduce((sum, row) => sum + row.total, 0)
  const rows = [...payouts].sort((a, b) => {
    // Null-worker bucket last, no matter its amount.
    if (a.workerId === null) return 1
    if (b.workerId === null) return -1
    return b.total - a.total
  })
  return { dueNet, payoutsTotal, remaining: dueNet - payoutsTotal, rows }
}
