import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

// The FK is ON DELETE SET NULL, so the failure mode this guards has no error to notice: without the
// hook the delete SUCCEEDS and Postgres quietly orphans every referencing transaction. Only a DB test
// can prove it — the assertion is that the investment row survives, which is state, not a return value.

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('investments beforeDelete guard (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number

  async function investmentExists(): Promise<boolean> {
    const result = await db.execute(sql`SELECT 1 FROM investments WHERE id = ${investmentId}`)
    return result.rows.length > 0
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    investmentId = await createTestInvestment(payload, 'delete-guard-investment')

    // Raw insert: bypasses the balance-recalc hooks, and LABOR_COST is the type with the most to lose
    // — no source register, so once orphaned it is reachable from nowhere.
    await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, investment_id, cancelled)
      VALUES ('delete-guard labor cost', 1000, now(),
        'LABOR_COST'::enum_transactions_type, 'TRANSFER', ${investmentId}, false)
    `)
  })

  afterAll(async () => {
    // The last test deletes the investment itself, so teardown must tolerate it being gone already —
    // a blind delete would throw NotFound and turn a green run red.
    if (investmentId) {
      await db.execute(sql`DELETE FROM transactions WHERE investment_id = ${investmentId}`)
      if (await investmentExists()) await deleteTestInvestment(payload, investmentId)
    }
  })

  it('refuses to delete an investment that still has transactions', async () => {
    await expect(deleteTestInvestment(payload, investmentId)).rejects.toThrow(
      /Nie można usunąć inwestycji/,
    )
    expect(await investmentExists()).toBe(true)
  })

  // Positive control: without it the assertion above would also pass on a hook that blocks every delete.
  it('allows the delete once the transactions are gone', async () => {
    await db.execute(sql`DELETE FROM transactions WHERE investment_id = ${investmentId}`)

    await deleteTestInvestment(payload, investmentId)
    expect(await investmentExists()).toBe(false)
  })
})
