import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment } from '@/__tests__/helpers/investment'

// „Utrwal kolejność" writes the grid's order into display_order, driven against the REAL DB and
// asserting the PERSISTED sequence — a success result can hide a failed write.
//   RN1 — the whole block takes its new order in one go, every display_order distinct.
//   RN2 — ids from another section are refused outright; nothing is written.
//   RN3 — a duplicate target index is refused (no unique constraint would catch it).
//
// Same mock surface as the sibling action specs: requireAuth needs a request/cookie we lack in node,
// and revalidation touches next/cache outside a request context.
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const { addItemAction, addSectionAction, renumberItemOrderAction } =
  await import('@/lib/actions/kosztorys')

// Gated like the sibling specs: skips with no DB env, FAILS if env is set but the DB is unreachable.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const FIXTURE_PREFIX = 'renumber-order-test-'

describe.skipIf(!ENV_READY)('renumberItemOrderAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const createdInvestments: number[] = []

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    const users = await payload.find({
      collection: 'users',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const firstUser = users.docs[0]
    if (!firstUser) throw new Error('no user in the DB to attribute the action to')
    authState.userId = Number(firstUser.id)
  })

  // A crashed run leaves its investments behind, and financial-golden-master-db.test.ts enumerates
  // this same DB with `limit: 0` — a leaked fixture would show up there as unexplained drift.
  beforeAll(async () => {
    await db.execute(sql`DELETE FROM investments WHERE name LIKE ${`${FIXTURE_PREFIX}%`}`)
  })

  async function freshInvestment(): Promise<number> {
    const created = await createTestInvestment(
      payload,
      `${FIXTURE_PREFIX}${createdInvestments.length}-${authState.userId}`,
    )
    createdInvestments.push(created)
    return created
  }

  afterEach(async () => {
    for (const id of createdInvestments.splice(0)) {
      await db.execute(sql`DELETE FROM investments WHERE id = ${id}`)
    }
  })

  async function itemIdsInOrder(sectionId: number): Promise<number[]> {
    const res = await db.execute(
      sql`SELECT id FROM kosztorys_items WHERE section_id = ${sectionId} ORDER BY display_order`,
    )
    return res.rows.map((r) => Number(r.id))
  }

  async function itemOrders(sectionId: number): Promise<number[]> {
    const res = await db.execute(
      sql`SELECT display_order FROM kosztorys_items WHERE section_id = ${sectionId} ORDER BY display_order`,
    )
    return res.rows.map((r) => Number(r.display_order))
  }

  // addSectionAction seeds item @0; `extra` more give a 1+extra-row section.
  async function sectionWithItems(investmentId: number, extra: number): Promise<number> {
    const section = await addSectionAction(investmentId)
    if (!section.success) throw new Error('section fixture failed')
    for (let i = 0; i < extra; i++) await addItemAction(section.data.section.id)
    return section.data.section.id
  }

  it('rewrites the whole block in one call and leaves every index distinct (RN1)', async () => {
    const investmentId = await freshInvestment()
    const sectionId = await sectionWithItems(investmentId, 3)
    const [a, b, c, d] = await itemIdsInOrder(sectionId)

    const res = await renumberItemOrderAction(sectionId, [
      { id: d, displayOrder: 0 },
      { id: c, displayOrder: 1 },
      { id: b, displayOrder: 2 },
      { id: a, displayOrder: 3 },
    ])
    expect(res.success).toBe(true)

    expect(await itemIdsInOrder(sectionId)).toEqual([d, c, b, a])
    expect(await itemOrders(sectionId)).toEqual([0, 1, 2, 3])
  })

  it('refuses ids belonging to another section and writes nothing (RN2)', async () => {
    const investmentId = await freshInvestment()
    const mine = await sectionWithItems(investmentId, 1)
    const other = await sectionWithItems(investmentId, 1)
    const [a, b] = await itemIdsInOrder(mine)
    const [foreign] = await itemIdsInOrder(other)
    const otherBefore = await itemIdsInOrder(other)

    const res = await renumberItemOrderAction(mine, [
      { id: b, displayOrder: 0 },
      { id: a, displayOrder: 1 },
      { id: foreign, displayOrder: 2 },
    ])
    expect(res.success).toBe(false)

    expect(await itemIdsInOrder(mine)).toEqual([a, b])
    expect(await itemIdsInOrder(other)).toEqual(otherBefore)
  })

  it('refuses two rows targeting the same index (RN3)', async () => {
    const investmentId = await freshInvestment()
    const sectionId = await sectionWithItems(investmentId, 1)
    const [a, b] = await itemIdsInOrder(sectionId)

    const res = await renumberItemOrderAction(sectionId, [
      { id: a, displayOrder: 0 },
      { id: b, displayOrder: 0 },
    ])
    expect(res.success).toBe(false)

    expect(await itemIdsInOrder(sectionId)).toEqual([a, b])
  })
})
