import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { BIALOSTOCKA_ROWS, ratesTab } from '@/__tests__/fixtures/kosztorys-sheet/rows'

// The import replaces a whole kosztorys behind an automatic snapshot, so the only assertions worth
// making are against PERSISTED state — a success result would hide a failed write, and the
// „recoverable" guarantee is real only if the pre-import snapshot actually restores.
//
// The sheet itself is mocked at the reader: everything below it (resolve → parse → merge) is the
// real code, so this spec exercises the write path without hitting Google.
const authState = vi.hoisted(() => ({ userId: 0, role: 'OWNER' as string }))
const sheetState = vi.hoisted(() => ({ spreadsheetId: 'sheet-under-test' as string | undefined }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: authState.role },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))
vi.mock('@/lib/google/sheet-lookup', () => ({
  getInvestmentSheetId: vi.fn().mockImplementation(async () => sheetState.spreadsheetId),
}))
vi.mock('@/lib/google/readonly-sheets-client', () => ({
  getReadonlySheetsClient: vi.fn().mockResolvedValue({}),
}))
vi.mock('@/lib/kosztorys/sheet-import/read-sheet', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  readImportGrids: vi.fn().mockImplementation(async () => ({
    robocizna: BIALOSTOCKA_ROWS,
    rateTabs: [
      ratesTab('zakres pracy z narzędziami', [
        { description: 'montaż jednostki wewnętrznej', wTools: 78, ownTools: 60 },
      ]),
    ],
  })),
}))

const { applyKosztorysImport, previewKosztorysImport } =
  await import('@/lib/actions/kosztorys-import')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('kosztorys import actions — persisted state (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number

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
    investmentId = await createTestInvestment(payload, 'kosztorys-import-test')
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

  async function sectionNames(): Promise<string[]> {
    const res = await db.execute(sql`
      SELECT name FROM kosztorys_sections WHERE investment_id = ${investmentId} ORDER BY display_order
    `)
    return res.rows.map((row) => String(row.name))
  }

  async function seedSection(name: string): Promise<void> {
    await payload.create({
      collection: 'kosztorys-sections',
      data: { investment: investmentId, name, displayOrder: 0 },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
  }

  it('writes the sheet’s sections and prace to the investment', async () => {
    const result = await applyKosztorysImport(investmentId)

    expect(result).toMatchObject({ success: true })
    expect(await sectionNames()).toEqual(['Prace dodatkowe', 'Klimatyzacja'])
  })

  it('takes a pre-import snapshot that restores the tree the import replaced', async () => {
    await payload.delete({
      collection: 'kosztorys-sections',
      where: { investment: { equals: investmentId } },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
    await seedSection('Stan sprzed importu')

    await applyKosztorysImport(investmentId)
    expect(await sectionNames()).not.toContain('Stan sprzed importu')

    const snapshots = await db.execute(sql`
      SELECT id FROM kosztorys_snapshots WHERE investment_id = ${investmentId} AND kind = 'auto'
      ORDER BY id DESC LIMIT 1
    `)
    const { restoreSnapshotAction } = await import('@/lib/actions/kosztorys-snapshots')
    await restoreSnapshotAction(Number(snapshots.rows[0].id), investmentId)

    expect(await sectionNames()).toEqual(['Stan sprzed importu'])
  })

  it('ignores a plan handed in by the caller and writes the one it derived itself', async () => {
    // The action takes no plan by design; this asserts the design holds at runtime rather than only
    // in the types, since a client can call a server action with any argument list it likes.
    const forged = { sections: [{ id: 1, name: 'Podłożone przez klienta', displayOrder: 0 }] }
    await (applyKosztorysImport as unknown as (id: number, plan: unknown) => Promise<unknown>)(
      investmentId,
      forged,
    )

    expect(await sectionNames()).not.toContain('Podłożone przez klienta')
  })

  it('refuses a MANAGER on both actions — import replaces the whole kosztorys', async () => {
    authState.role = 'MANAGER'
    try {
      await seedSection('Nietknięta przez managera')
      const preview = await previewKosztorysImport(investmentId)
      const applied = await applyKosztorysImport(investmentId)

      expect(preview).toMatchObject({ success: false })
      expect(applied).toMatchObject({ success: false })
      expect(await sectionNames()).toContain('Nietknięta przez managera')
    } finally {
      authState.role = 'OWNER'
    }
  })

  it('reports a missing sheet link in Polish instead of importing nothing silently', async () => {
    sheetState.spreadsheetId = undefined
    try {
      expect(await previewKosztorysImport(investmentId)).toMatchObject({
        success: false,
        error: 'Inwestycja nie ma kosztorysu.',
      })
    } finally {
      sheetState.spreadsheetId = 'sheet-under-test'
    }
  })

  it('previews the same counts the import would write, without shipping the tree', async () => {
    const preview = await previewKosztorysImport(investmentId)

    expect(preview).toMatchObject({ success: true })
    if (!preview.success) return
    expect(preview.data.report.counts).toMatchObject({ sections: 2, items: 3, stages: 10 })
    expect(preview.data).not.toHaveProperty('tree')
  })
})
