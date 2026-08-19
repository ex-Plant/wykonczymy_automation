// No `server-only` here (half of src/lib/db skips it too): the bulk script runs these same helpers
// under tsx, where that import throws.
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'

export type ItemDescriptionRowT = { id: number; description: string }

export async function getItemDescriptions(
  db: DbExecutorT,
  investmentId: number,
): Promise<ItemDescriptionRowT[]> {
  const res = await db.execute(sql`
    SELECT id, description
    FROM kosztorys_items
    WHERE investment_id = ${investmentId} AND description IS NOT NULL AND description <> ''
  `)
  return res.rows.map((row) => ({ id: Number(row.id), description: String(row.description) }))
}

/**
 * Rewrite many opisy in one statement — a kosztorys runs to hundreds of rows, and a per-row update
 * would be that many round-trips for one button.
 */
export async function setItemDescriptions(
  db: DbExecutorT,
  investmentId: number,
  rows: readonly ItemDescriptionRowT[],
): Promise<number> {
  if (rows.length === 0) return 0
  const values = rows.map(({ id, description }) => sql`(${id}::int, ${description}::text)`)
  const res = await db.execute(sql`
    UPDATE kosztorys_items AS i
    SET description = v.description, updated_at = now()
    FROM (VALUES ${sql.join(values, sql.raw(', '))}) AS v(id, description)
    WHERE i.id = v.id AND i.investment_id = ${investmentId}
    RETURNING i.id
  `)
  // The editor reseeds its grid off the investment's revision token — the same reason
  // setSheetMeasuredQty bumps it.
  if (res.rows.length > 0)
    await db.execute(sql`UPDATE investments SET updated_at = now() WHERE id = ${investmentId}`)
  return res.rows.length
}
