import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { buildTransferFilters, stripCancelledFilters } from '@/lib/queries/transfer-filters'
import { sumFilteredByType } from '@/lib/db/sum-transfers'

/**
 * The bridge between the two planes that decide „Suma wybranych transakcji" (EX-574):
 * buildTransferFilters emits the Where, stripCancelledFilters hands it to the stats query,
 * buildSqlConditions turns it into SQL. Each plane was fine on its own; the tile was wrong
 * because nothing asserted what actually reached the database.
 *
 * So these assert the EMITTED SQL, never the intermediate Where — a Where-shape assertion
 * stays green when the translator silently drops an operator, which is how the amount
 * filter's upper bound went missing for as long as it did.
 */

const mockExecute = vi.fn()
const fakePayload = {
  db: { drizzle: { execute: mockExecute }, sessions: {} },
} as unknown as Payload

beforeEach(() => {
  mockExecute.mockReset()
  mockExecute.mockResolvedValue({ rows: [] })
})

/** Runs the real filter → strip → translate chain and returns the SQL the tile's query would issue. */
async function sqlForSearchParams(searchParams: Record<string, string>): Promise<string> {
  const where = buildTransferFilters(searchParams, { id: 1 })
  await sumFilteredByType(fakePayload, stripCancelledFilters(where))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = mockExecute.mock.calls[0][0] as any
  return query.queryChunks?.[0]?.value?.[0] ?? String(query)
}

describe('transfer filters → stats SQL', () => {
  it('excludes CANCELLATION rows from the default view', async () => {
    expect(await sqlForSearchParams({})).toContain("type NOT IN ('CANCELLATION')")
  })

  it('keeps a user-selected type filter', async () => {
    expect(await sqlForSearchParams({ type: 'PAYOUT,OTHER' })).toContain(
      "type IN ('PAYOUT', 'OTHER')",
    )
  })

  it('applies no type condition when cancelled rows are shown', async () => {
    expect(await sqlForSearchParams({ showCancelled: '1' })).not.toContain('type ')
  })

  it('keeps audit mode restricted to CANCELLATION rows', async () => {
    expect(await sqlForSearchParams({ cancelledTransactionAudit: '1' })).toContain(
      "type IN ('CANCELLATION')",
    )
  })

  it('applies a prefix amount search as a text LIKE', async () => {
    expect(await sqlForSearchParams({ amount: '500' })).toContain("amount::text LIKE '500'")
  })
})
