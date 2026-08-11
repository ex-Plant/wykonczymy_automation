import type { WorkerRefT } from '@/types/reference-data'
import type { PayoutByWorkerT, SubcontractorPayoutRowT } from '@/types/transfers'

// Display label for the null-worker payout bucket (a cash PAYOUT with no worker attached). One source
// shared by the page's name-enrichment and the block's fallback so the two can't drift apart.
export const UNASSIGNED_WORKER_NAME = 'Bez przypisanego pracownika'

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
