import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { restoreKosztorys } from '@/lib/kosztorys/restore-kosztorys'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

// `display_order` carries NO unique constraint (only `kosztorys_stages(investment_id, ordinal)` does),
// and the repo treats a tie as tolerated, not corrupt — append-preset-sections.ts accepts the
// MAX-select race that mints one, and the read path orders by `(display_order, id)` precisely so a tie
// only makes relative order ambiguous. The dev DB holds one today.
//
// So a tie must NOT break restore: the bulk inserts join RETURNING on the natural key, and where that
// key ties the join is impossible — it has to degrade, not throw. This spec pins the two things that
// still have to hold when it degrades: every row comes back, and every child lands under the SAME
// parent it had (misparenting is the silent corruption the key join exists to prevent).
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({ success: true, user: { id: 1, role: 'OWNER' } })),
}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('restore with tied display_order (DB)', () => {
  let payload: Payload
  let investmentId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })

    investmentId = await createTestInvestment(payload, 'restore-tied-display-order-test', {
      vatRate: 0.23,
    })

    // Every `displayOrder: 0` below is deliberate, overriding the builder's index default — the tie
    // IS the fixture, and these are the two ties that occur in the wild.
    const item = { displayOrder: 0, unit: 'm2', plannedQty: 1, clientPrice: 100 }
    await createKosztorysTree(payload, investmentId, {
      sections: [
        {
          name: 'Sekcja A',
          displayOrder: 0,
          items: [
            { ...item, description: 'A — pozycja pierwsza' },
            { ...item, description: 'A — pozycja druga' },
          ],
        },
        {
          name: 'Sekcja B',
          displayOrder: 0,
          items: [{ ...item, description: 'B — pozycja jedyna' }],
        },
      ],
    })
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

  it('restores a tied tree without throwing, every item under its own section', async () => {
    // description → section name, the parenting the restore must preserve across reminted ids.
    const parentage = async () => {
      const tree = await serializeKosztorys(investmentId)
      const sectionName = new Map(tree.sections.map((section) => [section.id, section.name]))
      return Object.fromEntries(
        tree.items.map((item) => [item.description, sectionName.get(item.sectionId)]),
      )
    }

    const before = await serializeKosztorys(investmentId)
    const parentageBefore = await parentage()

    await withPayloadTransaction(
      payload,
      (req) => restoreKosztorys(payload, req, investmentId, before),
      { skipRevalidation: true },
    )

    const after = await serializeKosztorys(investmentId)
    expect(after.sections).toHaveLength(2)
    expect(after.items).toHaveLength(3)
    expect(await parentage()).toEqual(parentageBefore)
  })
})
