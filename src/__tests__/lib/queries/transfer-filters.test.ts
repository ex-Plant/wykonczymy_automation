import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildTransferFilters,
  hasActiveTransferFilters,
  stripCancelledFilters,
} from '@/lib/queries/transfer-filters'
import { sumFilteredByType } from '@/lib/db/sum-transfers'
import { fakePayload, lastSql, resetFakePayload } from '@/__tests__/helpers/fake-payload-sql'

/**
 * Assert the EMITTED SQL, never the intermediate Where: a Where-shape assertion stays green
 * when the translator silently drops an operator (EX-574). Translation itself is covered per-operator
 * in `lib/db/where-to-sql.test.ts`; these cases pin the whole URL → SQL chain.
 */

beforeEach(resetFakePayload)

async function sqlForSearchParams(searchParams: Record<string, string>): Promise<string> {
  const where = buildTransferFilters(searchParams, { id: 1 })
  await sumFilteredByType(fakePayload, stripCancelledFilters(where))
  return lastSql()
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
    const sql = await sqlForSearchParams({ showCancelled: '1' })
    expect(sql).not.toContain('AND type')
  })

  it('keeps audit mode restricted to CANCELLATION rows', async () => {
    expect(await sqlForSearchParams({ cancelledTransactionAudit: '1' })).toContain(
      "type IN ('CANCELLATION')",
    )
  })

  it('applies both ends of an amount range', async () => {
    const sql = await sqlForSearchParams({ amount: '500,00' })
    expect(sql).toContain('amount >= 500')
    expect(sql).toContain('amount < 500.01')
  })

  it('applies a prefix amount search as a text LIKE', async () => {
    expect(await sqlForSearchParams({ amount: '500' })).toContain("amount::text LIKE '500'")
  })

  it('applies an id search', async () => {
    expect(await sqlForSearchParams({ id: '42' })).toContain('id = 42')
  })

  it('applies both ends of a date range', async () => {
    const sql = await sqlForSearchParams({ from: '2026-03-01', to: '2026-03-31' })
    expect(sql).toContain("date >= '2026-03-01'")
    expect(sql).toContain("date <= '2026-03-31'")
  })

  it('applies a worker search', async () => {
    expect(await sqlForSearchParams({ worker: '5' })).toContain('worker_id = 5')
  })

  it('matches a cash register on either side of the transfer', async () => {
    expect(await sqlForSearchParams({ sourceRegister: '3,5' })).toContain(
      '(source_register_id IN (3, 5) OR target_register_id IN (3, 5))',
    )
  })
})

describe('hasActiveTransferFilters', () => {
  it('reports no filter for empty params', () => {
    expect(hasActiveTransferFilters({})).toBe(false)
  })

  it('ignores pagination and the reading toggle', () => {
    expect(hasActiveTransferFilters({ page: '2', limit: '50', statsVersion: 'v2' })).toBe(false)
  })

  it('reports a filter for a type selection', () => {
    expect(hasActiveTransferFilters({ type: 'PAYOUT' })).toBe(true)
  })

  it('reports a filter for a date bound alone', () => {
    expect(hasActiveTransferFilters({ from: '2026-03-01' })).toBe(true)
  })

  it('stays false where the built Where is non-empty — the trap this predicate exists for', () => {
    expect(buildTransferFilters({}, { id: 1 })).not.toEqual({})
    expect(hasActiveTransferFilters({})).toBe(false)
  })
})
