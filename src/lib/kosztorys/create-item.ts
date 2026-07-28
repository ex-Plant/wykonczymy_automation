import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { Payload, PayloadRequest } from 'payload'
import type { DbExecutorT } from '@/lib/db/get-db'
import { DEFAULT_ITEM_DESCRIPTION, DEFAULT_UNIT } from '@/lib/kosztorys/constants'

// A freshly created row, identified by id and where it landed in its parent's ordering.
export type NewRowT = { id: number; displayOrder: number }

// The section is the single source of investment ownership: derived here rather than trusted from a
// caller-passed id, so an item's investment and section FKs can never disagree. The append slot rides
// along in the same statement because the append path needs both and they share the section lookup —
// a caller that only wants the owner discards `nextDisplayOrder`.
//
// Append slot = MAX(display_order)+1, not COUNT: removeItemAction leaves gaps, so counting would
// collide with a surviving row after any middle delete.
export async function sectionOwnerAndNextItemOrder(
  db: DbExecutorT,
  sectionId: number,
): Promise<{ investmentId: number; nextDisplayOrder: number } | undefined> {
  const res = await db.execute(sql`
    SELECT s.investment_id AS investment, COALESCE(MAX(i.display_order) + 1, 0) AS next
    FROM kosztorys_sections s
    LEFT JOIN kosztorys_items i ON i.section_id = s.id
    WHERE s.id = ${sectionId}
    GROUP BY s.investment_id
  `)
  const row = res.rows[0]
  if (!row) return undefined
  return { investmentId: Number(row.investment), nextDisplayOrder: Number(row.next ?? 0) }
}

// Every blank position the app mints — append, insert-at, and the first item of a new section — is
// this one row shape. Three copies had already drifted apart on which defaults they set (EX-578).
export async function createBlankItem(
  payload: Payload,
  {
    investmentId,
    sectionId,
    displayOrder,
    req,
  }: { investmentId: number; sectionId: number; displayOrder: number; req?: PayloadRequest },
): Promise<NewRowT> {
  const created = await payload.create({
    collection: 'kosztorys-items',
    req,
    data: {
      investment: investmentId,
      section: sectionId,
      displayOrder,
      description: DEFAULT_ITEM_DESCRIPTION,
      unit: DEFAULT_UNIT,
      plannedQty: 0,
      discountValue: 0,
      clientPrice: 0,
      hiddenInExport: false,
    },
  })
  return { id: created.id, displayOrder }
}
