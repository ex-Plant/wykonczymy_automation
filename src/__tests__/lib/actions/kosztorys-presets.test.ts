import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

// „Wczytaj szablon" replaces a whole rozpiska behind an automatic snapshot, so the only assertions
// worth making are against PERSISTED state — a success result would hide a failed write, and the
// „odwracalne" guarantee is real only if the pre-reload snapshot actually restores.
const authState = vi.hoisted(() => ({ userId: 0 }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const { reloadFromPresetAction } = await import('@/lib/actions/kosztorys-presets')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const PRESET_NAME = 'ex560-reload-fixture'
const INVESTMENT_VAT = 8
// Deliberately absurd and different from the investment's own: a preset must never carry one job's
// pricing config onto another, so these values landing on the target would be the bug.
const PRESET_SETTINGS = { wToolsCoeff: 0.11, ownToolsCoeff: 0.22, vatRate: 99 }

function presetPayload(): SnapshotPayloadT {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sections: [{ id: 1, name: 'Z szablonu', displayOrder: 0, color: null }],
    items: [
      {
        id: 1,
        sectionId: 1,
        displayOrder: 0,
        description: 'Praca z szablonu',
        unit: 'm2',
        plannedQty: 0,
        discountType: null,
        discountValue: 0,
        clientPrice: 100,
        wToolsOverrideType: null,
        wToolsOverrideValue: 0,
        ownToolsOverrideType: null,
        ownToolsOverrideValue: 0,
        hiddenInExport: false,
        note: null,
      },
    ],
    stages: [],
    progress: [],
    settings: PRESET_SETTINGS,
  }
}

describe.skipIf(!ENV_READY)('reloadFromPresetAction — persisted state (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let presetId: number

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
    if (!firstUser) throw new Error('no user in the DB to attribute the snapshot to')
    authState.userId = Number(firstUser.id)

    investmentId = await createTestInvestment(payload, 'ex560-reload-preset-test', {
      vatRate: INVESTMENT_VAT,
    })

    const { upsertPresetByName } = await import('@/lib/db/presets')
    presetId = await upsertPresetByName(db, {
      name: PRESET_NAME,
      createdBy: authState.userId,
      payload: presetPayload(),
    })
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    if (presetId) await db.execute(sql`DELETE FROM kosztorys_presets WHERE id = ${presetId}`)
  })

  // The state a reload is supposed to blow away: a hand-built rozpiska with a typed przedmiar, an
  // etap, and wykonano recorded against it — every kind of row the wipe must reach.
  async function seedLiveTree(): Promise<void> {
    await payload.delete({
      collection: 'kosztorys-sections',
      where: { investment: { equals: investmentId } },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'kosztorys-stages',
      where: { investment: { equals: investmentId } },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })

    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: { investment: investmentId, name: 'Stan sprzed wczytania', displayOrder: 0 },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
    const item = await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investmentId,
        section: Number(section.id),
        displayOrder: 0,
        description: 'Praca wpisana ręcznie',
        unit: 'm2',
        plannedQty: 12,
        clientPrice: 50,
      },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
    const stage = await payload.create({
      collection: 'kosztorys-stages',
      data: { investment: investmentId, ordinal: 1, label: 'Etap 1' },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'stage-progress',
      data: { item: Number(item.id), stage: Number(stage.id), qtyDone: 4 },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
  }

  async function sectionNames(): Promise<string[]> {
    const res = await db.execute(sql`
      SELECT name FROM kosztorys_sections WHERE investment_id = ${investmentId} ORDER BY display_order
    `)
    return res.rows.map((row) => String(row.name))
  }

  async function stageLabels(): Promise<string[]> {
    const res = await db.execute(sql`
      SELECT label FROM kosztorys_stages WHERE investment_id = ${investmentId} ORDER BY ordinal
    `)
    return res.rows.map((row) => String(row.label))
  }

  async function progressQty(): Promise<number[]> {
    const res = await db.execute(sql`
      SELECT sp.qty_done FROM stage_progress sp
      JOIN kosztorys_stages st ON st.id = sp.stage_id
      WHERE st.investment_id = ${investmentId}
    `)
    return res.rows.map((row) => Number(row.qty_done))
  }

  async function investmentVatRate(): Promise<number> {
    const res = await db.execute(sql`SELECT vat_rate FROM investments WHERE id = ${investmentId}`)
    return Number(res.rows[0].vat_rate)
  }

  async function preReloadSnapshotIds(): Promise<number[]> {
    const res = await db.execute(sql`
      SELECT id FROM kosztorys_snapshots
      WHERE investment_id = ${investmentId}
        AND kind = 'manual'
        AND label = 'Przed wczytaniem szablonu'
      ORDER BY id DESC
    `)
    return res.rows.map((row) => Number(row.id))
  }

  it('replaces the whole rozpiska with the szablon, etapy and wykonano included', async () => {
    await seedLiveTree()

    const result = await reloadFromPresetAction(investmentId, presetId)

    expect(result).toMatchObject({ success: true, data: { sections: 1, items: 1 } })
    expect(await sectionNames()).toEqual(['Z szablonu'])
    // A szablon carries no etapy, so both go — this is the part that distinguishes a reload from the
    // sheet import, which keeps prace the sheet doesn't know about.
    expect(await stageLabels()).toEqual([])
    expect(await progressQty()).toEqual([])
  })

  // The preset payload keeps full snapshot shape-parity, `settings` included, but applying those
  // would drag one job's VAT onto another. Handing `restoreKosztorys` the CURRENT settings is what
  // neutralizes its write-back; this pins that the neutralization actually holds.
  it('leaves the investment’s own VAT alone rather than taking the szablon’s', async () => {
    await seedLiveTree()

    await reloadFromPresetAction(investmentId, presetId)

    expect(await investmentVatRate()).toBe(INVESTMENT_VAT)
  })

  // Found by LABEL, not by „newest": the whole point of the pre-reload row being `manual` is that it
  // survives the auto count cap + 7-day GC and stays identifiable among the periodic autosaves.
  it('takes a labelled pre-reload snapshot that restores the rozpiska it replaced', async () => {
    await seedLiveTree()

    await reloadFromPresetAction(investmentId, presetId)
    expect(await sectionNames()).not.toContain('Stan sprzed wczytania')

    const snapshotIds = await preReloadSnapshotIds()
    expect(snapshotIds.length).toBeGreaterThan(0)

    const { restoreSnapshotAction } = await import('@/lib/actions/kosztorys-snapshots')
    await restoreSnapshotAction(snapshotIds[0], investmentId)

    expect(await sectionNames()).toEqual(['Stan sprzed wczytania'])
    // Etapy and wykonano come back too — the snapshot is the undo for the whole tree, not just the
    // prace, which is what makes the wipe safe to offer without an escalated warning.
    expect(await stageLabels()).toEqual(['Etap 1'])
    expect(await progressQty()).toEqual([4])
  })

  it('writes nothing — not even a snapshot — when the szablon does not exist', async () => {
    await seedLiveTree()
    const before = await preReloadSnapshotIds()

    const result = await reloadFromPresetAction(investmentId, 2_000_000_000)

    expect(result).toMatchObject({ success: false })
    expect(await sectionNames()).toEqual(['Stan sprzed wczytania'])
    expect(await preReloadSnapshotIds()).toEqual(before)
  })
})
