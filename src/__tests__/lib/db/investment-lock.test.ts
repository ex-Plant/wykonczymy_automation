import { describe, it, expect, beforeEach } from 'vitest'
import { investmentIdFor, isInvestmentLocked } from '@/lib/db/investment-lock'
import { fakePayload, mockExecute, resetFakePayload } from '@/__tests__/helpers/fake-payload-sql'
import { getDb } from '@/lib/db/get-db'

// `lastSql` reads only the first chunk; the table name arrives as a nested `sql.raw` chunk.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sqlText(node: any): string {
  if (Array.isArray(node?.value)) return node.value.join('')
  if (Array.isArray(node?.queryChunks)) return node.queryChunks.map(sqlText).join('')
  return ''
}

function lastSqlChunks(): string {
  const calls = mockExecute.mock.calls
  return sqlText(calls[calls.length - 1]?.[0])
}

// The lock is what makes „Zakończona" enforceable, so its two questions are asserted directly:
// which status counts as locked, and which investment a kosztorys row belongs to.
describe('investment lock', () => {
  beforeEach(resetFakePayload)

  describe('isInvestmentLocked', () => {
    it('locks only on completed', async () => {
      const db = await getDb(fakePayload)
      for (const [status, expected] of [
        ['completed', true],
        ['active', false],
        ['planowana', false],
      ] as const) {
        mockExecute.mockResolvedValueOnce({ rows: [{ status }] })
        expect(await isInvestmentLocked(db, 1)).toBe(expected)
      }
    })

    // A nonexistent investment is the caller's problem to report, not the lock's — reporting it as
    // locked would answer „zakończona" for an id that never existed.
    it('treats a missing row as unlocked', async () => {
      const db = await getDb(fakePayload)
      mockExecute.mockResolvedValueOnce({ rows: [] })
      expect(await isInvestmentLocked(db, 999)).toBe(false)
    })
  })

  describe('investmentIdFor', () => {
    it.each([
      ['item', 'kosztorys_items'],
      ['section', 'kosztorys_sections'],
      ['stage', 'kosztorys_stages'],
    ] as const)('reads %s from %s', async (kind, table) => {
      const db = await getDb(fakePayload)
      mockExecute.mockResolvedValueOnce({ rows: [{ investment_id: 42 }] })
      expect(await investmentIdFor(db, kind, 7)).toBe(42)
      expect(lastSqlChunks()).toContain(table)
    })

    it('returns undefined for a row that does not exist', async () => {
      const db = await getDb(fakePayload)
      mockExecute.mockResolvedValueOnce({ rows: [] })
      expect(await investmentIdFor(db, 'item', 999)).toBeUndefined()
    })
  })
})
