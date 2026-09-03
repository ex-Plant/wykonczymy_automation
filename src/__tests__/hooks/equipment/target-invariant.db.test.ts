import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'

// „Gdzie jest sprzęt" is read off the newest event, so an event with no target — or with two — is not
// a cosmetic data problem: it makes the derived answer either missing or ambiguous for the whole
// item. The invariant is therefore pinned on the collection hook, exercised through
// `payload.create/update` directly rather than through the server action: the action is one writer
// and never the broken one — /admin and the Local API are the paths that would slip through.
// Asserted on the PERSISTED ROW (pattern: `hooks/transfers/investment-write-guard.db.test.ts`) —
// a returned document can look right while the column holds something else.

vi.mock('server-only', () => ({}))
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const MARKER = 'EX-758 target invariant'

type EventRowT = {
  holder_id: number | null
  warehouse_id: number | null
  service_provider: string | null
  cost: string | number | null
}

describe.skipIf(!ENV_READY)('an equipment event lands on exactly one target (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let equipmentId: number
  let warehouseId: number
  let holderId: number

  const createEvent = (data: Record<string, unknown>) =>
    payload.create({
      collection: 'equipment-events',
      data: { equipment: equipmentId, occurredAt: '2026-09-01T00:00:00.000Z', note: MARKER, ...data },
      overrideAccess: true,
      context: { skipRevalidation: true },
    } as Parameters<Payload['create']>[0])

  async function persistedRow(eventId: number): Promise<EventRowT> {
    const result = await db.execute(sql`
      SELECT holder_id, warehouse_id, service_provider, cost
      FROM equipment_events WHERE id = ${eventId}
    `)
    return result.rows[0] as unknown as EventRowT
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    // On entry as well as in teardown — a run that threw halfway leaves rows behind, and both the
    // warehouse name and the user email are unique, so the next run would die in setup.
    await db.execute(sql`DELETE FROM equipment_events WHERE note = ${MARKER}`)
    await db.execute(sql`DELETE FROM equipment WHERE name = ${MARKER}`)
    await db.execute(sql`DELETE FROM warehouses WHERE name = ${MARKER}`)
    await purgeFixtureUsers(db)

    const holder = await payload.create({
      collection: 'users',
      data: {
        name: 'Equipment Target Holder',
        role: 'EMPLOYEE',
        email: 'equipment-target-holder@test.local',
        password: 'test-password-123',
      },
      context: { skipRevalidation: true },
    })
    holderId = Number(holder.id)

    const warehouse = await payload.create({
      collection: 'warehouses',
      data: { name: MARKER },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    warehouseId = Number(warehouse.id)

    const equipment = await payload.create({
      collection: 'equipment',
      // `status` spelled out although the collection defaults it: Payload's generated create type
      // models neither `defaultValue` nor the draft split, so omitting it makes the literal
      // unassignable (same reason as `helpers/investment.ts`).
      data: { name: MARKER, status: 'IN_USE' },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    equipmentId = Number(equipment.id)
  })

  afterAll(async () => {
    // Events first: the warehouse delete guard probes them, so the reverse order fails the teardown
    // rather than the assertion.
    await db.execute(sql`DELETE FROM equipment_events WHERE note = ${MARKER}`)
    if (equipmentId) await db.execute(sql`DELETE FROM equipment WHERE id = ${equipmentId}`)
    if (warehouseId) await db.execute(sql`DELETE FROM warehouses WHERE id = ${warehouseId}`)
    if (holderId)
      await payload.delete({
        collection: 'users',
        id: holderId,
        overrideAccess: true,
        context: { skipRevalidation: true },
      })
  })

  it('rejects an event with no target at all', async () => {
    await expect(createEvent({})).rejects.toThrow(/pracownik, magazyn albo serwis/i)
  })

  it('rejects an event carrying two targets', async () => {
    await expect(createEvent({ holder: holderId, warehouse: warehouseId })).rejects.toThrow(
      /tylko w jedno miejsce/i,
    )
  })

  it('persists a single target and nulls the other two', async () => {
    const created = await createEvent({ holder: holderId })
    const row = await persistedRow(Number(created.id))

    expect(row.holder_id).toBe(holderId)
    expect(row.warehouse_id).toBeNull()
    expect(row.service_provider).toBeNull()
  })

  // The cost belongs to a repair, so it must not survive on a handover — otherwise a stray amount
  // would be reported as service spend on an item that was merely handed to someone.
  it('drops a cost sent with a non-service target', async () => {
    const created = await createEvent({ warehouse: warehouseId, cost: 250 })
    const row = await persistedRow(Number(created.id))

    expect(row.warehouse_id).toBe(warehouseId)
    expect(row.cost).toBeNull()
  })

  // Positive control: without it every assertion above would also pass on a build that nulls the
  // cost unconditionally.
  it('keeps the cost on a service entry', async () => {
    const created = await createEvent({ serviceProvider: 'Serwis Narzędziowy', cost: 250 })
    const row = await persistedRow(Number(created.id))

    expect(row.service_provider).toBe('Serwis Narzędziowy')
    expect(Number(row.cost)).toBe(250)
  })

  // The one case a create-only spec would miss: a partial update carries only the NEW target, so the
  // hook has to read the stored row to see the old one — and clear it rather than count it as a
  // second target.
  it('moves a held item to a warehouse without tripping the two-target check', async () => {
    const created = await createEvent({ holder: holderId })
    const moved = await payload.update({
      collection: 'equipment-events',
      id: created.id,
      data: { warehouse: warehouseId, holder: null },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    const row = await persistedRow(Number(moved.id))

    expect(row.warehouse_id).toBe(warehouseId)
    expect(row.holder_id).toBeNull()
  })
})
