import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { insertKosztorysTree } from '@/lib/kosztorys/insert-kosztorys-tree'
import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

// A snapshot kept for a year is only as good as the oldest payload the current code can reinsert.
// The columns added since a payload was captured are simply absent from its JSON, which binds an
// explicit NULL — and Postgres does not substitute a DEFAULT for an explicit NULL, so the whole
// restore dies on 23502 and the user is told „nic nie zostało zapisane". These cases fabricate that
// payload (the real ones with the gap don't exist yet, which is the point of guarding it now) and
// assert the PERSISTED rows, never the return value — a successful-looking result can sit on top of
// a write that never happened.
describe.skipIf(!ENV_READY)('insertKosztorysTree tolerates an older payload (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    investmentId = await createTestInvestment(payload, 'insert-tree-defaults-test')
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

  // The shape a payload written before these columns existed actually has: the keys are MISSING, not
  // null. Typed through a cast because SnapshotPayloadT describes what today's serializer writes.
  function payloadWithout(
    sections: Record<string, unknown>[],
    items: Record<string, unknown>[],
  ): SnapshotPayloadT {
    return {
      schemaVersion: 1,
      sections,
      items,
      stages: [],
      progress: [],
      settings: { wToolsCoeff: 1, ownToolsCoeff: 1, vatRate: 23 },
    } as unknown as SnapshotPayloadT
  }

  it('inserts the column default for a numeric field the payload never carried', async () => {
    await insertKosztorysTree(
      db,
      investmentId,
      payloadWithout(
        [{ id: 1, name: 'Kuchnia', displayOrder: 0, color: null }],
        // No plannedQty / discountValue / clientPrice / override values — the 23502 payload.
        [{ id: 10, sectionId: 1, displayOrder: 0, description: 'Gładzie', unit: 'm2', note: null }],
      ),
    )

    const res = await db.execute(sql`
      SELECT planned_qty, discount_value, client_price, w_tools_override_value, own_tools_override_value
      FROM kosztorys_items WHERE investment_id = ${investmentId}
    `)
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0]).toMatchObject({
      planned_qty: '0',
      discount_value: '0',
      client_price: '0',
      w_tools_override_value: '0',
      own_tools_override_value: '0',
    })
  })

  it('gives a missing display_order a distinct, input-ordered value rather than a constant', async () => {
    // display_order is the natural key remapNewIds joins RETURNING on. Defaulting it to a constant 0
    // would tie the key batch-wide, silently drop the remap to positional, and restore the tree
    // flattened onto one position — which is why this case exists separately from the one above.
    const otherInvestmentId = await createTestInvestment(payload, 'insert-tree-order-test')
    try {
      await insertKosztorysTree(
        db,
        otherInvestmentId,
        payloadWithout(
          [
            { id: 1, name: 'Kuchnia', color: null },
            { id: 2, name: 'Łazienka', color: null },
            { id: 3, name: 'Salon', color: null },
          ],
          [
            { id: 10, sectionId: 1, description: 'Gładzie', unit: 'm2', note: null },
            { id: 11, sectionId: 1, description: 'Malowanie', unit: 'm2', note: null },
            { id: 12, sectionId: 1, description: 'Gruntowanie', unit: 'm2', note: null },
          ],
        ),
      )

      const sections = await db.execute(sql`
        SELECT name, display_order FROM kosztorys_sections
        WHERE investment_id = ${otherInvestmentId} ORDER BY display_order
      `)
      expect(sections.rows.map((row) => row.name)).toEqual(['Kuchnia', 'Łazienka', 'Salon'])
      expect(sections.rows.map((row) => Number(row.display_order))).toEqual([0, 1, 2])

      const items = await db.execute(sql`
        SELECT description, display_order FROM kosztorys_items
        WHERE investment_id = ${otherInvestmentId} ORDER BY display_order
      `)
      expect(items.rows.map((row) => row.description)).toEqual([
        'Gładzie',
        'Malowanie',
        'Gruntowanie',
      ])
      expect(items.rows.map((row) => Number(row.display_order))).toEqual([0, 1, 2])
    } finally {
      await deleteTestInvestment(payload, otherInvestmentId)
    }
  })
})
