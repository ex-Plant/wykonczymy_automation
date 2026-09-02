import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { gcSnapshots, insertSnapshot } from '@/lib/db/snapshots'
import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const emptyPayload: SnapshotPayloadT = {
  schemaVersion: 1,
  sections: [],
  items: [],
  stages: [],
  progress: [],
  settings: {
    wToolsCoeff: 0,
    ownToolsCoeff: 0,
    vatRate: 0,
  },
}

// gcSnapshots thins in raw SQL over calendar buckets, so the only real assertion is which rows
// survive in the DB. The mistake worth guarding is not the timezone — getting `AT TIME ZONE`
// backwards costs at most one extra survivor — it is dropping `investment_id` from the PARTITION BY,
// which silently keeps ONE row across every investment and is invisible to a single-investment
// fixture. Hence two investments below.
describe.skipIf(!ENV_READY)('gcSnapshots retention bands (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let otherInvestmentId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    investmentId = await createTestInvestment(payload, 'gc-snapshots-test')
    otherInvestmentId = await createTestInvestment(payload, 'gc-snapshots-other')
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    if (otherInvestmentId) await deleteTestInvestment(payload, otherInvestmentId)
  })

  // Backdate to a FIXED wall-clock point rather than an offset from now(): `now() - 40 days` sits at
  // whatever time the suite happens to run, so "same day, three hours apart" straddles midnight on a
  // pre-03:00 run and a sub-week offset lands in one week or two depending on the weekday. Anchoring
  // on the same date_trunc the sweep uses makes the spec assert the bucketing instead of the clock.
  async function insertAt(
    targetInvestmentId: number,
    kind: 'auto' | 'manual',
    daysAgo: number,
    hour: number,
  ): Promise<number> {
    const id = await insertSnapshot(db, {
      investmentId: targetInvestmentId,
      kind,
      label: kind === 'manual' ? 'wersja' : null,
      takenBy: null,
      payload: emptyPayload,
    })
    await db.execute(sql`
      UPDATE kosztorys_snapshots SET taken_at = (
        date_trunc('day', now() AT TIME ZONE 'Europe/Warsaw')
          - make_interval(days => ${daysAgo})
          + make_interval(hours => ${hour})
      ) AT TIME ZONE 'Europe/Warsaw'
      WHERE id = ${id}
    `)
    return id
  }

  async function survivorsOf(targetInvestmentId: number): Promise<number[]> {
    const res = await db.execute(
      sql`SELECT id FROM kosztorys_snapshots WHERE investment_id = ${targetInvestmentId} ORDER BY id`,
    )
    return res.rows.map((row) => Number(row.id))
  }

  it('keeps full density for 30 days, one per day to 120, one per week to 365, and is idempotent', async () => {
    // Every age sits clear of a band edge (30 / 120 / 365): the backdating UPDATE and the sweep's
    // now() are separate transactions, so a row placed exactly on an edge races.

    // (a) inside the full-density window — two rows on one day, both survive
    const freshEarly = await insertAt(investmentId, 'auto', 2, 8)
    const freshLate = await insertAt(investmentId, 'auto', 2, 19)

    // (b) daily band — three rows on day 40 collapse to the newest; day 41 keeps its own
    const day40Morning = await insertAt(investmentId, 'auto', 40, 2)
    const day40Noon = await insertAt(investmentId, 'auto', 40, 10)
    const day40Evening = await insertAt(investmentId, 'auto', 40, 20)
    const day41 = await insertAt(investmentId, 'auto', 41, 12)

    // (c) weekly band — days 200 and 207 are exactly 7 days apart, so they land in different
    // calendar weeks whatever weekday the suite runs on
    const week1Early = await insertAt(investmentId, 'auto', 200, 5)
    const week1Late = await insertAt(investmentId, 'auto', 200, 15)
    const week2 = await insertAt(investmentId, 'auto', 207, 9)

    // (d) manual under the ceiling survives every band — the bands are kind = 'auto' only
    const manualDeepInBands = await insertAt(investmentId, 'manual', 200, 11)

    // (e) both kinds past the ceiling
    const ancientAuto = await insertAt(investmentId, 'auto', 400, 9)
    const ancientManual = await insertAt(investmentId, 'manual', 400, 9)

    // (g) a second investment with rows in the SAME calendar day as (b)
    const otherDay40Morning = await insertAt(otherInvestmentId, 'auto', 40, 3)
    const otherDay40Evening = await insertAt(otherInvestmentId, 'auto', 40, 21)

    const first = await gcSnapshots(db)
    expect(first.daily).toBeGreaterThanOrEqual(3)
    expect(first.weekly).toBeGreaterThanOrEqual(1)
    expect(first.ceiling).toBeGreaterThanOrEqual(2)

    const survivors = await survivorsOf(investmentId)
    expect(survivors).toEqual(
      [freshEarly, freshLate, day40Evening, day41, week1Late, week2, manualDeepInBands].sort(
        (a, b) => a - b,
      ),
    )
    expect(survivors).not.toContain(day40Morning)
    expect(survivors).not.toContain(day40Noon)
    expect(survivors).not.toContain(week1Early)
    expect(survivors).not.toContain(ancientAuto)
    expect(survivors).not.toContain(ancientManual)

    // (g) the other investment keeps ITS OWN newest row for that day — not zero, and not the same
    // row as the first investment's
    const otherSurvivors = await survivorsOf(otherInvestmentId)
    expect(otherSurvivors).toEqual([otherDay40Evening])
    expect(otherSurvivors).not.toContain(otherDay40Morning)

    // (f) stateless and idempotent: the survivors ARE the state, so a second sweep has nothing left
    // to thin. Asserted as survivor stability rather than `deleted === 0` — gcSnapshots sweeps the
    // whole table, so rows an aborted neighbouring run left behind would show up in its counters.
    await gcSnapshots(db)
    expect(await survivorsOf(investmentId)).toEqual(survivors)
    expect(await survivorsOf(otherInvestmentId)).toEqual(otherSurvivors)
  })
})
