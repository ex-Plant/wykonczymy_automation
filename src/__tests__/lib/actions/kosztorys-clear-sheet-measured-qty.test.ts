import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

// „Etapy są prawdą" is only real if the reference figure is gone from the ROW — the editor drops the
// pozycja from the rozjazd list optimistically, so a successful-looking result over a failed write
// would read as done and come back on the next reload.

const authState = vi.hoisted(() => ({ userId: 0 }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const { clearSheetMeasuredQtyAction } = await import('@/lib/actions/kosztorys')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('clearSheetMeasuredQtyAction — persisted state (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let sectionId: number

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
    if (!firstUser) throw new Error('no user in the DB to authenticate as')
    authState.userId = Number(firstUser.id)

    investmentId = await createTestInvestment(payload, 'ex686-clear-sheet-measured-qty')
    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: { investment: investmentId, name: 'Podłogi', displayOrder: 0 },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
    sectionId = Number(section.id)
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

  async function createItem(sheetMeasuredQty: number | null): Promise<number> {
    const item = await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investmentId,
        section: sectionId,
        displayOrder: 0,
        description: 'Posadzki z mikrocementu',
        unit: 'm2',
        plannedQty: 95,
        sheetMeasuredQty,
        clientPrice: 100,
        discountValue: 0,
        hiddenInExport: false,
      },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
    return Number(item.id)
  }

  async function storedSheetMeasuredQty(itemId: number): Promise<number | null> {
    const res = await db.execute(
      sql`SELECT sheet_measured_qty FROM kosztorys_items WHERE id = ${itemId}`,
    )
    const raw = res.rows[0]?.sheet_measured_qty
    return raw == null ? null : Number(raw)
  }

  it('clears the sheet pomiar on the persisted row', async () => {
    const itemId = await createItem(95)
    expect(await storedSheetMeasuredQty(itemId)).toBe(95)

    const res = await clearSheetMeasuredQtyAction(itemId)

    expect(res.success).toBe(true)
    expect(await storedSheetMeasuredQty(itemId)).toBeNull()
  })

  it('leaves the offered przedmiar and the price untouched — only the reference figure goes', async () => {
    const itemId = await createItem(80)

    await clearSheetMeasuredQtyAction(itemId)

    const row = await payload.findByID({
      collection: 'kosztorys-items',
      id: itemId,
      depth: 0,
      overrideAccess: true,
    })
    expect(row.plannedQty).toBe(95)
    expect(row.clientPrice).toBe(100)
  })
})
