import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { restoreKosztorys } from '@/lib/kosztorys/restore-kosztorys'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

// restore WIPES before it reinserts, so for the length of the call the investment's live kosztorys
// does not exist. The only thing that makes that safe is the whole call running in one transaction —
// and that rests on `getDb` finding the transaction-scoped Drizzle handle inside Payload internals
// (`adapter.sessions[txId].db`). When that shape changes on a Payload upgrade, getDb does not throw:
// it SILENTLY falls back to the non-transactional handle, restore stops being atomic, and a throw
// mid-reinsert leaves the tree half-wiped with nothing to say so. This spec is that tripwire.
//
// The throw is injected through the real code path, not a mock: a snapshot carrying two stages with
// the same `ordinal` violates `kosztorys_stages_investment_ordinal_unique` at the stages INSERT —
// i.e. after the wipe AND after sections + items have already been reinserted, which is exactly the
// window where a lost transaction does maximum damage.
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({ success: true, user: { id: 1, role: 'OWNER' } })),
}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('restore rollback on error (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    investmentId = await createTestInvestment(payload, 'restore-rollback-test', {
      vatRate: 0.23,
      wToolsCoeff: 0.7,
      ownToolsCoeff: 0.5,
    })

    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: { investment: investmentId, name: 'Sekcja A', displayOrder: 0 },
      context: { skipRevalidation: true },
    })
    const item = await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investmentId,
        section: section.id,
        displayOrder: 0,
        description: 'Malowanie',
        unit: 'm2',
        plannedQty: 10,
        clientPrice: 100,
        discountValue: 0,
        hiddenInExport: false,
      },
      context: { skipRevalidation: true },
    })
    const stage1 = await payload.create({
      collection: 'kosztorys-stages',
      data: { investment: investmentId, ordinal: 1, label: 'Etap 1' },
      context: { skipRevalidation: true },
    })
    await payload.create({
      collection: 'kosztorys-stages',
      data: { investment: investmentId, ordinal: 2, label: 'Etap 2' },
      context: { skipRevalidation: true },
    })

    await db.execute(sql`
      INSERT INTO stage_progress (item_id, stage_id, qty_done, created_at, updated_at)
      VALUES (${item.id}, ${stage1.id}, 4, now(), now())
    `)
  })

  afterAll(async () => {
    if (investmentId) {
      await deleteTestInvestment(payload, investmentId)
    }
  })

  it('leaves the live tree untouched when the reinsert throws after the wipe', async () => {
    const before = await serializeKosztorys(investmentId)
    expect(before.sections.length).toBeGreaterThan(0)
    expect(before.items.length).toBeGreaterThan(0)

    const poisoned = {
      ...before,
      stages: before.stages.map((stage) => ({ ...stage, ordinal: before.stages[0].ordinal })),
    }

    const transactionId = await payload.db.beginTransaction()
    if (!transactionId) throw new Error('Failed to start transaction')
    let threw = false
    try {
      await restoreKosztorys(
        payload,
        { transactionID: transactionId, context: { skipRevalidation: true } } as never,
        investmentId,
        poisoned,
      )
      await payload.db.commitTransaction(transactionId)
    } catch {
      threw = true
      await payload.db.rollbackTransaction(transactionId)
    }

    expect(threw).toBe(true)

    // Identity INCLUDING ids: content equality alone would also pass if the wipe had committed and
    // the tree been rebuilt from the snapshot. Same ids prove the delete itself rolled back.
    const after = await serializeKosztorys(investmentId)
    expect(after).toEqual(before)
  })
})
