import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { DEFAULT_COEFFS } from '@/lib/kosztorys/constants'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'

// „Zapisz do katalogu…", against the REAL DB and asserting the PERSISTED cennik row. What the return
// value cannot show: that a praca overriding nothing freezes the stawka its inwestycja's global
// coefficients imply (not 0, not the coefficient itself), that `'new'` on a taken klucz writes no
// second row, and that `'overwrite'` keeps the row's identity instead of deleting and recreating it.
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

const { saveItemToCatalogueAction } = await import('@/lib/actions/work-catalogue')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('saveItemToCatalogueAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let sectionId: number
  let coeffs: { wTools: number; ownTools: number } = DEFAULT_COEFFS
  let suffix = ''
  const createdSections: number[] = []
  const ctx = { context: { skipRevalidation: true } }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    const investments = await payload.find({
      collection: 'investments',
      limit: 1,
      sort: 'id',
      depth: 0,
      overrideAccess: true,
    })
    const investment = investments.docs[0]
    if (!investment) throw new Error('no investment in the DB to attach test fixtures to')
    investmentId = Number(investment.id)

    // Read rather than set: the inwestycja is shared fixture data, and the assertion only needs to
    // know WHICH number the stawka should be derived from.
    const settings = await db.execute(sql`
      SELECT w_tools_coeff, own_tools_coeff FROM investments WHERE id = ${investmentId}
    `)
    const row = settings.rows[0]
    coeffs = {
      wTools: row?.w_tools_coeff == null ? DEFAULT_COEFFS.wTools : Number(row.w_tools_coeff),
      ownTools:
        row?.own_tools_coeff == null ? DEFAULT_COEFFS.ownTools : Number(row.own_tools_coeff),
    }

    const users = await payload.find({ collection: 'users', limit: 1, depth: 0 })
    const firstUser = users.docs[0]
    if (!firstUser) throw new Error('no user in the DB to attribute the action to')
    authState.userId = Number(firstUser.id)

    suffix = `TEST-${Date.now()}`

    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: { investment: investmentId, name: `Łazienka ${suffix} 2`, displayOrder: 0 },
      overrideAccess: true,
      ...ctx,
    })
    sectionId = Number(section.id)
    createdSections.push(sectionId)
  })

  afterEach(async () => {
    await db.execute(sql`DELETE FROM work_catalogue_items WHERE description LIKE ${`%${suffix}`}`)
    await db.execute(sql`DELETE FROM kosztorys_items WHERE section_id = ${sectionId}`)
  })

  afterAll(async () => {
    for (const id of createdSections.splice(0)) {
      await db.execute(sql`DELETE FROM kosztorys_sections WHERE id = ${id}`)
    }
  })

  type ItemOverridesT = {
    displayOrder?: number
    unit?: string
    clientPrice?: number
    wToolsOverrideType?: string
    wToolsOverrideValue?: number
    ownToolsOverrideType?: string
    ownToolsOverrideValue?: number
  }

  async function createItem(description: string, overrides: ItemOverridesT = {}): Promise<number> {
    const created = await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investmentId,
        section: sectionId,
        displayOrder: 0,
        description,
        unit: 'm2',
        plannedQty: 3,
        clientPrice: 100,
        discountValue: 0,
        ...overrides,
      },
      overrideAccess: true,
      ...ctx,
    })
    return Number(created.id)
  }

  const catalogueRow = async (description: string) => {
    const result = await db.execute(sql`
      SELECT id, description, category, unit, client_price, w_tools_rate, own_tools_rate, created_at
      FROM work_catalogue_items WHERE match_key = ${catalogueKey(description, 'm2')}
    `)
    return result.rows
  }

  it('zamraża stawki wyliczone z globalnych współczynników inwestycji', async () => {
    const description = `Malowanie bez nadpisania ${suffix}`
    const itemId = await createItem(description)

    const result = await saveItemToCatalogueAction(itemId, 'new')
    expect(result.success).toBe(true)

    const [row] = await catalogueRow(description)
    expect(Number(row.client_price)).toBe(100)
    expect(Number(row.w_tools_rate)).toBeCloseTo(100 * coeffs.wTools, 6)
    expect(Number(row.own_tools_rate)).toBeCloseTo(100 * coeffs.ownTools, 6)
    // The two failures the derivation could hide: no stawka at all, or the coefficient stored raw.
    expect(Number(row.w_tools_rate)).toBeGreaterThan(1)
    // Kategoria = the sekcja without its instance number.
    expect(row.category).toBe(`Łazienka ${suffix}`)
  })

  it('zapisuje własne nadpisanie kwotowe pozycji zamiast wyliczenia', async () => {
    const description = `Malowanie z nadpisaniem ${suffix}`
    const itemId = await createItem(description, {
      wToolsOverrideType: 'amount',
      wToolsOverrideValue: 42,
      ownToolsOverrideType: 'coeff',
      ownToolsOverrideValue: 0.3,
    })

    await saveItemToCatalogueAction(itemId, 'new')

    const [row] = await catalogueRow(description)
    expect(Number(row.w_tools_rate)).toBe(42)
    expect(Number(row.own_tools_rate)).toBeCloseTo(30, 6)
  })

  it('„nowa" na zajętym kluczu nie tworzy drugiego wiersza', async () => {
    const description = `Podwójna ${suffix}`
    const first = await createItem(description)
    await saveItemToCatalogueAction(first, 'new')

    const second = await createItem(`  ${description.toUpperCase()}  `, {
      displayOrder: 1,
      clientPrice: 999,
    })
    const result = await saveItemToCatalogueAction(second, 'new')
    expect(result.success).toBe(false)

    const rows = await catalogueRow(description)
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].client_price)).toBe(100)
  })

  it('„nadpisz" zmienia liczby, zachowując id i created_at', async () => {
    const description = `Nadpisywana ${suffix}`
    const first = await createItem(description)
    await saveItemToCatalogueAction(first, 'new')
    const [before] = await catalogueRow(description)

    const second = await createItem(description.toUpperCase(), {
      displayOrder: 1,
      clientPrice: 250,
      wToolsOverrideType: 'amount',
      wToolsOverrideValue: 111,
    })
    const result = await saveItemToCatalogueAction(second, 'overwrite')
    expect(result.success).toBe(true)

    const rows = await catalogueRow(description)
    expect(rows).toHaveLength(1)
    const [after] = rows
    expect(Number(after.id)).toBe(Number(before.id))
    expect(new Date(after.created_at as string).getTime()).toBe(
      new Date(before.created_at as string).getTime(),
    )
    expect(Number(after.client_price)).toBe(250)
    expect(Number(after.w_tools_rate)).toBe(111)
  })

  it('odmawia zapisu pracy bez opisu', async () => {
    const itemId = await createItem('')

    const result = await saveItemToCatalogueAction(itemId, 'new')
    expect(result.success).toBe(false)
  })

  // j.m. is half the klucz and the katalog row requires it, so without the guard this died on
  // Payload's own validation and the owner read a framework sentence instead of what to do.
  it('odmawia zapisu pracy bez j.m., własnym zdaniem', async () => {
    const description = `Bez jednostki ${suffix}`
    const itemId = await createItem(description, { unit: '' })

    const result = await saveItemToCatalogueAction(itemId, 'new')
    expect(result.success).toBe(false)
    expect(result.success === false && result.error).toContain('jednostki miary')

    const rows = await db.execute(
      sql`SELECT id FROM work_catalogue_items WHERE description = ${description}`,
    )
    expect(rows.rows).toHaveLength(0)
  })
})
