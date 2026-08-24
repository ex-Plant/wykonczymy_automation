import { describe, expect, it } from 'vitest'

import { UNASSIGNED_WORKER_NAME, derivePayoutsByWorker } from '@/lib/kosztorys/payout-worker-names'
import type { WorkerRefT } from '@/types/reference-data'
import type { PayoutTransactionRowT } from '@/types/transfers'

const workers = [
  { id: 1, name: 'Jan Kowalski', role: 'EMPLOYEE' },
  { id: 2, name: 'Anna Nowak', role: 'EMPLOYEE' },
] as WorkerRefT[]

const payout = (workerId: number | null, amount: number): PayoutTransactionRowT => ({
  workerId,
  amount,
  date: '2026-07-18 09:00:00+00',
  description: null,
})

const rowFor = (workerId: number | null, rows: ReturnType<typeof derivePayoutsByWorker>) =>
  rows.find((row) => row.workerId === workerId)

describe('derivePayoutsByWorker', () => {
  it('sums a worker who has several wypłaty into one row', () => {
    const rows = derivePayoutsByWorker([payout(1, 1000), payout(1, 250.5), payout(2, 400)], workers)

    expect(rows).toHaveLength(2)
    expect(rowFor(1, rows)).toEqual({ workerId: 1, total: 1250.5, name: 'Jan Kowalski' })
  })

  // The null bucket is a real cash payout with nobody attached. Folded into a named worker it would
  // invent a debt; dropped, „Pozostało do wypłaty" overstates by its whole amount.
  it('keeps the null-worker bucket as its own row rather than merging or dropping it', () => {
    const rows = derivePayoutsByWorker(
      [payout(1, 1000), payout(null, 300), payout(null, 200)],
      workers,
    )

    expect(rowFor(null, rows)).toEqual({
      workerId: null,
      total: 500,
      name: UNASSIGNED_WORKER_NAME,
    })
    expect(rowFor(1, rows)?.total).toBe(1000)
  })

  it('labels a worker id the roster does not know rather than dropping the money', () => {
    const rows = derivePayoutsByWorker([payout(99, 750)], workers)

    expect(rowFor(99, rows)).toEqual({ workerId: 99, total: 750, name: 'Nieznany pracownik' })
  })

  // Float addition is new here — the old per-worker figure was a SQL SUM over numeric, which never
  // produced a 0.1 + 0.2 tail.
  it('rounds a grouped total to cents', () => {
    const rows = derivePayoutsByWorker([payout(1, 0.1), payout(1, 0.2)], workers)

    expect(rowFor(1, rows)?.total).toBe(0.3)
  })

  it('returns no rows for no wypłaty — the block renders a worker only from an assignment then', () => {
    expect(derivePayoutsByWorker([], workers)).toEqual([])
  })
})
