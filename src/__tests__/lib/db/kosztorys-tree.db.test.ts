import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { selectKosztorysTreeData } from '@/lib/db/kosztorys-tree'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

// selectKosztorysTreeData is one hand-written SQL statement, so its invariants only exist against a
// real Postgres — a mocked executor would just replay whatever shape the test author imagined. The
// sibling spec (kosztorys-tree-sql-drift) guards the column list at source level; this one guards the
// four behaviours that a correct column list still doesn't give you.

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('selectKosztorysTreeData (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>

  // Two populated investments prove isolation; one bare investment proves the empty case.
  const created = { alpha: 0, beta: 0, bare: 0 }
  const cleanup: {
    collection: 'kosztorys-items' | 'kosztorys-sections' | 'kosztorys-stages' | 'stage-progress'
    id: number
  }[] = []

  async function seed(investmentId: number, qtyDone: number) {
    // Insert out of display order deliberately: ORDER BY moved from Payload's `sort` into the
    // json_agg, and insertion order is what would leak through if it were dropped.
    const second = await payload.create({
      collection: 'kosztorys-sections',
      data: {
        investment: investmentId,
        name: 'B-second',
        displayOrder: 2,
      },
      context: { skipRevalidation: true },
    })
    const first = await payload.create({
      collection: 'kosztorys-sections',
      data: {
        investment: investmentId,
        name: 'A-first',
        displayOrder: 1,
      },
      context: { skipRevalidation: true },
    })
    cleanup.push({ collection: 'kosztorys-sections', id: Number(second.id) })
    cleanup.push({ collection: 'kosztorys-sections', id: Number(first.id) })

    const stage = await payload.create({
      collection: 'kosztorys-stages',
      data: { investment: investmentId, ordinal: 1, label: 'etap-1' },
      context: { skipRevalidation: true },
    })
    cleanup.push({ collection: 'kosztorys-stages', id: Number(stage.id) })

    const item = await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investmentId,
        section: Number(first.id),
        displayOrder: 1,
        description: 'pozycja',
        plannedQty: 3,
        discountValue: 0,
        clientPrice: 100,
        hiddenInExport: false,
      },
      context: { skipRevalidation: true },
    })
    cleanup.push({ collection: 'kosztorys-items', id: Number(item.id) })

    const progress = await payload.create({
      collection: 'stage-progress',
      data: { item: Number(item.id), stage: Number(stage.id), qtyDone },
      context: { skipRevalidation: true },
    })
    cleanup.push({ collection: 'stage-progress', id: Number(progress.id) })
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    for (const key of ['alpha', 'beta', 'bare'] as const) {
      created[key] = await createTestInvestment(payload, `tree-${key}-${Date.now()}`)
    }

    // Distinct qtyDone per investment is what makes a broken join visible rather than merely wrong.
    await seed(created.alpha, 11)
    await seed(created.beta, 22)
  })

  afterAll(async () => {
    for (const { collection, id } of [...cleanup].reverse()) {
      await payload.delete({ collection, id, context: { skipRevalidation: true } }).catch(() => {})
    }
    for (const id of Object.values(created)) {
      if (id) await deleteTestInvestment(payload, id).catch(() => {})
    }
  })

  it('returns empty arrays, not null, for an investment with no kosztorys rows', async () => {
    // json_agg over zero rows is NULL rather than an empty array. Without the coalesce in the query
    // every one of these is null and the caller's `.map` throws — a brand-new investment, i.e. the
    // first thing anyone opens, would 500 the editor.
    const data = await selectKosztorysTreeData(db, created.bare)

    expect(data).not.toBeNull()
    expect(data!.sections).toEqual([])
    expect(data!.items).toEqual([])
    expect(data!.stages).toEqual([])
    expect(data!.progress).toEqual([])
  })

  it('orders sections by displayOrder regardless of insertion order', async () => {
    const data = await selectKosztorysTreeData(db, created.alpha)

    expect(data!.sections.map((section) => section.name)).toEqual(['A-first', 'B-second'])
  })

  it('scopes progress to the investment through its item, not across investments', async () => {
    // stage_progress carries no investment column — it reaches the investment via a JOIN on
    // kosztorys_items. Drop or loosen that join and every investment sees every other one's progress.
    const alpha = await selectKosztorysTreeData(db, created.alpha)
    const beta = await selectKosztorysTreeData(db, created.beta)

    expect(alpha!.progress.map((row) => row.qtyDone)).toEqual([11])
    expect(beta!.progress.map((row) => row.qtyDone)).toEqual([22])
  })

  it('returns revision as an ISO string', async () => {
    // The editor shell compares `revision` by value to detect a stale tree. Payload handed back an
    // ISO string; the raw driver hands back a Date, so the query normalises it. If that normalisation
    // regresses the comparison silently stops matching and staleness detection dies quietly.
    const data = await selectKosztorysTreeData(db, created.alpha)

    expect(typeof data!.investment.updatedAt).toBe('string')
    expect(data!.investment.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/)
  })

  it('returns null for an investment that does not exist', async () => {
    expect(await selectKosztorysTreeData(db, 2_000_000_000)).toBeNull()
  })
})
