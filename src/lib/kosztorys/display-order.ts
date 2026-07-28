import 'server-only'
import { z } from 'zod'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { Payload } from 'payload'
import { getDb, type DbExecutorT } from '@/lib/db/get-db'

// Sections and items each had their own copy of the insert-shift and the ▲▼ swap, and the copies
// drifted on transaction policy alone (EX-578) — one scope-parameterised home is what stops that.

// A row's owner column is fixed by its table (a section is ordered within its investment, an item
// within its section), so the two travel together keyed by the Payload collection slug — a caller
// can't pair the wrong column with a table.
const ORDER_SCOPES = {
  'kosztorys-sections': { table: sql.raw('kosztorys_sections'), owner: sql.raw('investment_id') },
  'kosztorys-items': { table: sql.raw('kosztorys_items'), owner: sql.raw('section_id') },
} as const

export type OrderScopeT = keyof typeof ORDER_SCOPES

const displayOrderRefSchema = z.object({ id: z.number(), displayOrder: z.number() })
export const swapDisplayOrderSchema = z.object({
  first: displayOrderRefSchema,
  second: displayOrderRefSchema,
})

export type DisplayOrderRefT = z.infer<typeof displayOrderRefSchema>

// Append slot for a new row = MAX(display_order)+1, not COUNT — a delete leaves a gap, so counting
// would collide with a surviving row.
export async function nextSectionDisplayOrder(
  db: DbExecutorT,
  investmentId: number,
): Promise<number> {
  const res = await db.execute(sql`
    SELECT COALESCE(MAX(display_order) + 1, 0) AS next
    FROM kosztorys_sections WHERE investment_id = ${investmentId}
  `)
  return Number(res.rows[0]?.next ?? 0)
}

// Opens the slot at `at` by pushing the owner's tail down one, so a create can land there. Bounded by
// the OWNER's row count — the whole-sheet concern that made ▲▼ a neighbour swap (1000+ rows) doesn't
// apply to one investment's sections or one section's items. Runs on a caller-owned transaction
// handle: the shift and the create it opens room for must commit together, or a double-fired insert
// at the same index interleaves and lands two rows on one display_order (EX-464).
export async function shiftDisplayOrderFrom(
  db: DbExecutorT,
  scope: OrderScopeT,
  ownerId: number,
  at: number,
): Promise<void> {
  const { table, owner } = ORDER_SCOPES[scope]
  await db.execute(sql`
    UPDATE ${table} SET display_order = display_order + 1
    WHERE ${owner} = ${ownerId} AND display_order >= ${at}
  `)
}

// Exchanges two rows' display_order in ONE statement, so ▲▼ moves a row without renumbering the
// block. Each ref carries the NEW display_order its row should take on.
//
// The single statement is load-bearing twice over. A half-applied swap would leave both rows on the
// same display_order (there is no unique constraint) and the reloaded order would be
// non-deterministic. And it takes both row locks at once rather than holding one while it waits for
// the other, so it cannot be one side of a lock cycle with the range UPDATE in shiftDisplayOrderFrom,
// which scans in plan order rather than by id. That second one matters because ▲▼ fires this WITHOUT
// awaiting and with no error handling: a losing transaction would abort silently and leave the grid
// showing an order the DB never stored.
export async function swapDisplayOrder(
  payload: Payload,
  scope: OrderScopeT,
  first: DisplayOrderRefT,
  second: DisplayOrderRefT,
): Promise<void> {
  const { table } = ORDER_SCOPES[scope]
  const db = await getDb(payload)
  await db.execute(sql`
    UPDATE ${table}
    SET display_order = CASE id
          WHEN ${first.id} THEN ${first.displayOrder}::int
          ELSE ${second.displayOrder}::int
        END,
        updated_at = now()
    WHERE id IN (${first.id}, ${second.id})
  `)
}
