import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

// Every FK into `users` is ON DELETE SET NULL, so the failure this guards raises no error of its own:
// without the hook the delete SUCCEEDS and the wypłata simply stops naming its recipient. The assertion
// is therefore on the persisted rows — the user still there, the payout still pointing at them.

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('users beforeDelete guard (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let workerId: number
  let investmentId: number

  async function workerExists(): Promise<boolean> {
    const result = await db.execute(sql`SELECT 1 FROM users WHERE id = ${workerId}`)
    return result.rows.length > 0
  }

  async function payoutWorkerId(): Promise<number | null> {
    const result = await db.execute(
      sql`SELECT worker_id FROM transactions WHERE description = 'delete-guard payout'`,
    )
    const value = result.rows[0]?.worker_id
    return value === null || value === undefined ? null : Number(value)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)
    await db.execute(sql`DELETE FROM transactions WHERE description = 'delete-guard payout'`)

    investmentId = await createTestInvestment(payload, 'users-delete-guard-investment')

    const worker = await payload.create({
      collection: 'users',
      data: {
        name: 'Pracownik Do Usunięcia',
        role: 'EMPLOYEE',
        email: 'users-delete-guard@test.local',
        password: 'test-password-123',
      },
      context: { skipRevalidation: true },
    })
    workerId = Number(worker.id)

    // Raw insert bypasses the balance-recalc hooks; PAYOUT is the reference with the most to lose,
    // since `worker_id` is what sumPayoutsByWorkerForInvestment groups on.
    await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, investment_id, worker_id, cancelled)
      VALUES ('delete-guard payout', 500, now(),
        'PAYOUT'::enum_transactions_type, 'CASH', ${investmentId}, ${workerId}, false)
    `)
  })

  afterAll(async () => {
    if (workerId) await db.execute(sql`DELETE FROM amount_edits WHERE edited_by_id = ${workerId}`)
    await db.execute(sql`DELETE FROM transactions WHERE description = 'delete-guard payout'`)
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    await purgeFixtureUsers(db)
  })

  it('refuses to delete a worker who still has transactions, keeping the payout attributed', async () => {
    await expect(
      payload.delete({
        collection: 'users',
        id: workerId,
        overrideAccess: true,
        context: { skipRevalidation: true },
      }),
    ).rejects.toThrow(/Nie można usunąć pracownika/)

    expect(await workerExists()).toBe(true)
    expect(await payoutWorkerId()).toBe(workerId)
  })

  // amount_edits is the reference a transactions-only guard misses: the collection is
  // create/update/delete-false, so its rows are the immutable record of who changed a kwota. A user
  // who never received a wypłata but edited amounts must still be undeletable.
  it('refuses to delete a worker whose only reference is an amount edit', async () => {
    await db.execute(sql`DELETE FROM transactions WHERE description = 'delete-guard payout'`)
    await db.execute(sql`
      INSERT INTO amount_edits (previous_amount, new_amount, edited_by_id)
      VALUES (100, 200, ${workerId})
    `)

    await expect(
      payload.delete({
        collection: 'users',
        id: workerId,
        overrideAccess: true,
        context: { skipRevalidation: true },
      }),
    ).rejects.toThrow(/zmiany kwot/)

    expect(await workerExists()).toBe(true)
  })

  // Positive control: without it the assertions above would also pass on a hook that blocks every delete.
  it('allows the delete once nothing references the worker', async () => {
    await db.execute(sql`DELETE FROM transactions WHERE description = 'delete-guard payout'`)
    await db.execute(sql`DELETE FROM amount_edits WHERE edited_by_id = ${workerId}`)

    await payload.delete({
      collection: 'users',
      id: workerId,
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    expect(await workerExists()).toBe(false)
  })
})
