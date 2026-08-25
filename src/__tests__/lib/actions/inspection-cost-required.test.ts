import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import type { InspectionFormDataT } from '@/components/forms/inspection-form/inspection-schema'

// „Koszt" became required so a `0 zł` on the fleet listing means „it cost nothing" and nothing else
// (EX-729). The type says so, but a client that omits the key is exactly what the runtime guard is
// for — so this drives the REAL DB and asserts the PERSISTED rows: a `success: false` proves the
// action returned, not that it wrote nothing.
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

const { createInspectionAction } = await import('@/lib/actions/fleet')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('createInspectionAction — cost is required (DB)', () => {
  let payload: Payload
  let vehicleId = 0

  const storedCount = async () =>
    (
      await payload.find({
        collection: 'vehicle-inspections',
        where: { vehicle: { equals: vehicleId } },
        limit: 100,
        depth: 0,
      })
    ).totalDocs

  const inspection = (overrides: Partial<InspectionFormDataT> = {}): InspectionFormDataT => ({
    vehicle: vehicleId,
    type: 'TECHNICAL',
    performedAt: '2026-08-01',
    cost: 250,
    note: '',
    attachments: [],
    ...overrides,
  })

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })

    const users = await payload.find({ collection: 'users', limit: 1, depth: 0 })
    const firstUser = users.docs[0]
    if (!firstUser) throw new Error('no user in the DB to attribute the action to')
    authState.userId = Number(firstUser.id)

    const created = await payload.create({
      collection: 'vehicles',
      data: {
        registration: `TEST-COST-${Date.now()}`,
        make: 'Ford',
        model: 'Transit',
        status: 'ACTIVE',
      },
    })
    vehicleId = Number(created.id)
  })

  afterAll(async () => {
    // The inspections cascade with the vehicle (FK ON DELETE cascade), so one delete clears both.
    if (vehicleId) await payload.delete({ collection: 'vehicles', id: vehicleId })
  })

  it('writes nothing when the payload carries no cost', async () => {
    const { cost: _omitted, ...withoutCost } = inspection()

    const result = await createInspectionAction(withoutCost as InspectionFormDataT)

    expect(result.success).toBe(false)
    expect(await storedCount()).toBe(0)
  })

  it('writes nothing when the cost is negative', async () => {
    const result = await createInspectionAction(inspection({ cost: -1 }))

    expect(result.success).toBe(false)
    expect(await storedCount()).toBe(0)
  })

  // Zero is a legitimate price — a warranty repair costs the company nothing — and must not be
  // mistaken for „left empty" by the required check.
  it('persists a zero cost', async () => {
    const result = await createInspectionAction(inspection({ cost: 0 }))

    expect(result.success).toBe(true)

    const { docs } = await payload.find({
      collection: 'vehicle-inspections',
      where: { vehicle: { equals: vehicleId } },
      limit: 10,
      depth: 0,
    })
    expect(docs).toHaveLength(1)
    expect(docs[0]?.cost).toBe(0)
  })
})
