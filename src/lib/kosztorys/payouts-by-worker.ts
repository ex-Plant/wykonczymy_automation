import { roundToCents } from '@/lib/utils/round-to-cents'
import type { WorkerRefT } from '@/types/reference-data'
import type { PayoutTransactionRowT, SubcontractorPayoutRowT } from '@/types/transfers'

// Display label for the null-worker payout bucket (a cash PAYOUT with no worker attached). One source
// shared by the derivation below and the block's fallback so the two can't drift apart.
export const UNASSIGNED_WORKER_NAME = 'Bez przypisanego pracownika'

/**
 * Group the realized PAYOUT rows per worker and resolve each name from the roster.
 *
 * Never re-split this into its own `GROUP BY worker_id` query: a second cache entry over the same
 * WHERE can serve the block's totals from a different snapshot than the list beneath them.
 *
 * The null-worker bucket is a real cash payout and keeps its own entry: folding it into a named
 * worker would invent a debt, dropping it would overstate „Pozostało do wypłaty".
 */
export function derivePayoutsByWorker(
  rows: PayoutTransactionRowT[],
  workers: WorkerRefT[],
): SubcontractorPayoutRowT[] {
  const nameById = new Map(workers.map((worker) => [worker.id, worker.name]))
  const totalByWorker = new Map<number | null, number>()
  for (const row of rows) {
    totalByWorker.set(row.workerId, (totalByWorker.get(row.workerId) ?? 0) + row.amount)
  }

  return [...totalByWorker].map(([workerId, total]) => ({
    workerId,
    total: roundToCents(total),
    name:
      workerId === null ? UNASSIGNED_WORKER_NAME : (nameById.get(workerId) ?? 'Nieznany pracownik'),
  }))
}
