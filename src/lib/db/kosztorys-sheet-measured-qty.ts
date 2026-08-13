import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'

export type SheetMeasuredQtyRowT = { id: number; qty: number | null }

/**
 * Write the sheet's Pomiar claim onto many pozycje in one statement — a kosztorys runs to hundreds of
 * rows, and a per-row update would be that many round-trips for one button.
 *
 * The VALUES tuples are cast explicitly: a literal `NULL` has no type, so a batch whose first row
 * clears the figure would leave Postgres unable to infer the column and reject the whole update.
 */
export async function setSheetMeasuredQty(
  db: DbExecutorT,
  rows: readonly SheetMeasuredQtyRowT[],
): Promise<number> {
  if (rows.length === 0) return 0
  const values = rows.map(({ id, qty }) => sql`(${id}::int, ${qty}::numeric)`)
  const res = await db.execute(sql`
    UPDATE kosztorys_items AS i
    SET sheet_measured_qty = v.qty
    FROM (VALUES ${sql.join(values, sql.raw(', '))}) AS v(id, qty)
    WHERE i.id = v.id
    RETURNING i.id
  `)
  return res.rows.length
}
