// Not to be confused with `lock-investment.ts` in this directory: that one takes a row lock
// (`FOR UPDATE`) to serialize concurrent wholesale replacements. This one answers a domain
// question — has the investment been settled and closed, so nothing may move its money any more.
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'

export type LockTargetKindT = 'item' | 'section' | 'stage'

// The three kosztorys tables each carry `investment_id` as a not-null indexed FK, so an action that
// only knows its row's id can still name the investment it is about to write to.
const TABLE_BY_KIND: Record<LockTargetKindT, string> = {
  item: 'kosztorys_items',
  section: 'kosztorys_sections',
  stage: 'kosztorys_stages',
}

/**
 * A completed investment is settled — payouts included — so no figure on it may move again until
 * someone puts it back to „Aktywna". A missing row is not locked: a nonexistent investment is the
 * caller's problem to report, not the lock's.
 */
export async function isInvestmentLocked(db: DbExecutorT, investmentId: number): Promise<boolean> {
  const res = await db.execute(sql`SELECT status FROM investments WHERE id = ${investmentId}`)
  return res.rows[0]?.status === 'completed'
}

// Also the single source of investment ownership for a new row: derived from the parent rather than
// trusted from a caller-passed id, so an item's investment and section FKs can never disagree.
export async function investmentIdFor(
  db: DbExecutorT,
  kind: LockTargetKindT,
  id: number,
): Promise<number | undefined> {
  const res = await db.execute(
    sql`SELECT investment_id FROM ${sql.raw(TABLE_BY_KIND[kind])} WHERE id = ${id}`,
  )
  const row = res.rows[0]
  return row ? Number(row.investment_id) : undefined
}
