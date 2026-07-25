import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { Payload } from 'payload'
import {
  sumAllInvestmentFinancials,
  sumAllRegisterBalances,
  sumAllWorkerBalances,
} from '@/lib/db/sum-transfers'
import { getDb } from '@/lib/db/get-db'
import { calculateBalance } from '@/lib/db/calculate-balance'
import { calculateMargin } from '@/lib/db/calculate-margin'
import type { InvestmentFinancialsT } from '@/types/investment-financials'
import { round2 } from '@/__tests__/helpers/money'

// GOLDEN MASTER (EX-573 phase 0b) — every displayed figure, for every investment, frozen
// against the real production dataset restored into the 5435 db-test container.
//
// This is NOT a prod-vs-local comparison. No test may open a connection to Neon
// (see AGENTS.md); production figures enter this suite as DATA, via the
// db:dump → db:import:test restore. And the risk being guarded is not "environments
// disagree" — it is "the refactor moved a number", which before-vs-after on one real
// dataset answers directly.
//
// It proves PRESERVATION, not correctness: a figure the app computes wrongly today is
// frozen exactly as wrongly (EX-574 is such a case, deliberately out of scope here).
//
//   run:        pnpm test:parity
//   regenerate: pnpm test:golden:update      (after a db:import:test refresh)
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const UPDATE = process.env.UPDATE_GOLDEN === '1'

const FIXTURE_PATH = join(
  process.cwd(),
  'src/__tests__/fixtures/financial-golden-master.json',
)


type CategoryPairT = [categoryId: number, total: number]

type InvestmentSnapshotT = {
  totalMaterialCosts: number
  totalIncome: number
  totalLaborCosts: number
  totalPayouts: number
  totalRabat: number
  totalLoss: number
  totalSettled: number
  balance: number
  margin: number
  categoryCosts: CategoryPairT[]
  settledCategoryCosts: CategoryPairT[]
}

/** What gets written to disk. Investment NAMES are real client names — they stay out of
 *  the committed fixture and are re-read from the DB only to label a failure. */
type SnapshotT = {
  fingerprint: { transactionCount: number; checksum: string }
  investments: Record<string, InvestmentSnapshotT>
  registers: Record<string, number>
  workers: Record<string, number>
}

const ZERO_FINANCIALS: InvestmentFinancialsT = {
  categoryCosts: [],
  totalMaterialCosts: 0,
  totalIncome: 0,
  totalLaborCosts: 0,
  totalPayouts: 0,
  totalRabat: 0,
  totalLoss: 0,
  totalSettled: 0,
  settledCategoryCosts: [],
}

const toPairs = (costs: { categoryId: number; total: number }[]): CategoryPairT[] =>
  costs.map((c): CategoryPairT => [c.categoryId, round2(c.total)]).sort((a, b) => a[0] - b[0])

/**
 * A hash over every transaction column that feeds any figure below. The fixture is only
 * valid for the dataset it was taken from — without this, a `pnpm db:import:test` would
 * move all 100 rows at once and read as "the refactor broke everything", which is how a
 * golden master earns a reputation for noise and gets deleted. With it, a dataset change
 * is reported as "regenerate", and only a figure moving under an UNCHANGED dataset is
 * ever reported as drift.
 */
async function readFingerprint(payload: Payload) {
  const db = await getDb(payload)
  const result = await db.execute(sql`
    SELECT
      count(*)::int AS row_count,
      COALESCE(md5(string_agg(
        id || '|' || type || '|' || amount
          || '|' || COALESCE(settled::text, '')
          || '|' || COALESCE(investment_id::text, '')
          || '|' || COALESCE(source_register_id::text, '')
          || '|' || COALESCE(target_register_id::text, '')
          || '|' || COALESCE(expense_category_id::text, '')
          || '|' || COALESCE(worker_id::text, '')
          || '|' || COALESCE(cancelled::text, ''),
        ',' ORDER BY id
      )), '') AS checksum
    FROM transactions
  `)
  const row = result.rows[0]
  return { transactionCount: Number(row.row_count), checksum: String(row.checksum) }
}

async function buildSnapshot(payload: Payload): Promise<{
  snapshot: SnapshotT
  names: Map<string, string>
}> {
  const [fingerprint, investmentsPage, financialsMap, registerBalances, workerBalances] =
    await Promise.all([
      readFingerprint(payload),
      payload.find({
        collection: 'investments',
        limit: 0,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      }),
      sumAllInvestmentFinancials(payload),
      sumAllRegisterBalances(payload),
      sumAllWorkerBalances(payload),
    ])

  const investments: Record<string, InvestmentSnapshotT> = {}
  const names = new Map<string, string>()
  for (const doc of investmentsPage.docs) {
    const id = Number(doc.id)
    names.set(String(id), String(doc.name))
    // Mirrors shapeInvestments(): an investment with no transactions renders as zeros
    // rather than being absent, so the snapshot covers all of them.
    const financials = financialsMap.get(id) ?? ZERO_FINANCIALS
    investments[String(id)] = {
      totalMaterialCosts: round2(financials.totalMaterialCosts),
      totalIncome: round2(financials.totalIncome),
      totalLaborCosts: round2(financials.totalLaborCosts),
      totalPayouts: round2(financials.totalPayouts),
      totalRabat: round2(financials.totalRabat),
      totalLoss: round2(financials.totalLoss),
      totalSettled: round2(financials.totalSettled),
      balance: round2(calculateBalance(financials)),
      margin: round2(calculateMargin(financials)),
      categoryCosts: toPairs(financials.categoryCosts),
      settledCategoryCosts: toPairs(financials.settledCategoryCosts),
    }
  }

  const mapToRecord = (map: Map<number, number>): Record<string, number> =>
    Object.fromEntries([...map].sort((a, b) => a[0] - b[0]).map(([k, v]) => [String(k), round2(v)]))

  return {
    snapshot: {
      fingerprint,
      investments,
      registers: mapToRecord(registerBalances),
      workers: mapToRecord(workerBalances),
    },
    names,
  }
}

/** The dataset floor, asserted in TWO places on purpose: as a test (a thin dataset makes
 *  every comparison trivially pass) and as a precondition on the REGENERATE path, which
 *  overwrites the only committed record of the pre-refactor figures. Regenerating against
 *  a half-restored container would destroy the net and report the reason afterwards. */
const DATASET_FLOOR = { investments: 50, registers: 10, transactions: 1000 }

function assertNonTrivial(snapshot: SnapshotT) {
  const counts = {
    investments: Object.keys(snapshot.investments).length,
    registers: Object.keys(snapshot.registers).length,
    transactions: snapshot.fingerprint.transactionCount,
  }
  for (const key of Object.keys(DATASET_FLOOR) as (keyof typeof DATASET_FLOOR)[]) {
    if (counts[key] <= DATASET_FLOOR[key]) {
      throw new Error(
        `db-test holds only ${counts[key]} ${key} (floor ${DATASET_FLOOR[key]}) — this is a ` +
          `thin or half-restored dataset. Run \`pnpm db:import:test\` before regenerating.`,
      )
    }
  }
}

describe.skipIf(!ENV_READY)('financial golden master — every figure, every investment (DB)', () => {
  let snapshot: SnapshotT | null = null
  let names = new Map<string, string>()
  let setupError: unknown = null

  beforeAll(async () => {
    try {
      const { getPayload } = await import('payload')
      const config = (await import('@payload-config')).default
      const payload = await getPayload({ config })
      const built = await buildSnapshot(payload)
      snapshot = built.snapshot
      names = built.names
      if (UPDATE) {
        assertNonTrivial(snapshot)
        writeFileSync(FIXTURE_PATH, `${JSON.stringify(snapshot, null, 2)}\n`)
      }
    } catch (e) {
      setupError = e
    }
  })

  it('snapshot matches the frozen fixture, investment by investment', () => {
    if (setupError || !snapshot) {
      throw new Error(
        `golden master could not reach the DB — env is set, so this is a failure, not a skip. ` +
          `Cause: ${String(setupError)}`,
      )
    }
    if (UPDATE) {
      expect(existsSync(FIXTURE_PATH)).toBe(true)
      return
    }
    if (!existsSync(FIXTURE_PATH)) {
      throw new Error(`no fixture at ${FIXTURE_PATH} — generate it with \`pnpm test:golden:update\``)
    }

    const expected: SnapshotT = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))

    // Fingerprint FIRST. A dataset change is not a drift, and must never be reported as one.
    if (
      expected.fingerprint.checksum !== snapshot.fingerprint.checksum ||
      expected.fingerprint.transactionCount !== snapshot.fingerprint.transactionCount
    ) {
      throw new Error(
        `dataset changed — the fixture is stale, not the code.\n` +
          `  fixture: ${expected.fingerprint.transactionCount} transactions (${expected.fingerprint.checksum})\n` +
          `  db-test: ${snapshot.fingerprint.transactionCount} transactions (${snapshot.fingerprint.checksum})\n` +
          `Regenerate with \`pnpm test:golden:update\` and review the resulting diff.`,
      )
    }

    const drift: string[] = []
    const label = (id: string) => `#${id} ${names.get(id) ?? '(unknown)'}`

    const expectedIds = Object.keys(expected.investments)
    const actualIds = Object.keys(snapshot.investments)
    for (const id of expectedIds.filter((i) => !actualIds.includes(i))) {
      drift.push(`${label(id)} · disappeared from the snapshot`)
    }
    for (const id of actualIds.filter((i) => !expectedIds.includes(i))) {
      drift.push(`${label(id)} · new, not in the fixture`)
    }

    for (const id of expectedIds.filter((i) => actualIds.includes(i))) {
      const was = expected.investments[id]
      const now = snapshot.investments[id]
      for (const key of Object.keys(was) as (keyof InvestmentSnapshotT)[]) {
        const a = JSON.stringify(was[key])
        const b = JSON.stringify(now[key])
        if (a !== b) drift.push(`${label(id)} · ${key}: expected ${a} got ${b}`)
      }
    }

    for (const [scope, wasMap, nowMap] of [
      ['register', expected.registers, snapshot.registers],
      ['worker', expected.workers, snapshot.workers],
    ] as const) {
      for (const key of new Set([...Object.keys(wasMap), ...Object.keys(nowMap)])) {
        if (wasMap[key] !== nowMap[key]) {
          drift.push(`${scope} #${key} · balance: expected ${wasMap[key]} got ${nowMap[key]}`)
        }
      }
    }

    expect(drift).toEqual([])
  })

  it('covers a non-trivial slice of the real dataset', () => {
    const built = snapshot
    if (!built) throw new Error('snapshot not built')
    assertNonTrivial(built)
  })
})
