import { sql } from '@payloadcms/db-vercel-postgres'
import type { Payload } from 'payload'
import { toEquipmentEventRow, toEquipmentRow } from '@/lib/equipment/rows'
import type { EquipmentEventRowT, EquipmentRowT } from '@/lib/equipment/types'
import { getDb } from './get-db'

/**
 * „Gdzie jest" is the newest event per item, and it is computed by Postgres rather than by grouping
 * the whole log in JS the way the fleet does. The fleet can afford that — a few dozen cars — while
 * the register is deliberately open-ended: hundreds of tools, each with a handover per site visit.
 *
 * Ordered by `occurred_at`, never `created_at`: a handover typed in a week late must not become the
 * current state just because its row is the newest. `id DESC` only breaks a same-day tie, where the
 * insertion order is the sole remaining evidence of which happened last.
 */
const CURRENT_STATE = sql`
  SELECT DISTINCT ON (e.equipment_id)
    e.equipment_id,
    e.occurred_at,
    e.holder_id,
    e.warehouse_id,
    e.service_provider
  FROM equipment_events e
  ORDER BY e.equipment_id, e.occurred_at DESC, e.id DESC
`

// One join set, written once: the listing, the location filter and the employee card all render the
// same row and must never disagree about what „u kogo" means.
const OVERVIEW_COLUMNS = sql`
  q.id, q.name, q.serial_number, q.make, q.model, q.status,
  q.purchase_date, q.warranty_until, q.purchase_price, q.note,
  c.occurred_at, c.holder_id, c.warehouse_id, c.service_provider,
  u.name AS holder_name, w.name AS warehouse_name
`

const OVERVIEW_JOINS = sql`
  FROM equipment q
  LEFT JOIN current_state c ON c.equipment_id = q.id
  LEFT JOIN users u ON u.id = c.holder_id
  LEFT JOIN warehouses w ON w.id = c.warehouse_id
`

/** Every item with its current location — the listing's whole dataset in one round trip. */
export const loadEquipmentOverview = async (payload: Payload): Promise<EquipmentRowT[]> => {
  const db = await getDb(payload)

  const result = await db.execute(sql`
    WITH current_state AS (${CURRENT_STATE})
    SELECT ${OVERVIEW_COLUMNS}
    ${OVERVIEW_JOINS}
    ORDER BY q.name ASC, q.id ASC
  `)

  return result.rows.map(toEquipmentRow)
}

/**
 * What one person or one warehouse is holding right now.
 *
 * One parameterised statement rather than two near-identical ones: the pair would be the place where
 * a later fix to the „current" rule lands on one side only, and the employee card and the warehouse
 * filter would then answer differently.
 */
export const loadEquipmentAtLocation = async (
  payload: Payload,
  target: { kind: 'holder' | 'warehouse'; id: number },
): Promise<EquipmentRowT[]> => {
  const db = await getDb(payload)

  const result = await db.execute(sql`
    WITH current_state AS (${CURRENT_STATE})
    SELECT ${OVERVIEW_COLUMNS}
    ${OVERVIEW_JOINS}
    WHERE CASE WHEN ${target.kind} = 'holder' THEN c.holder_id ELSE c.warehouse_id END = ${target.id}
    ORDER BY q.name ASC, q.id ASC
  `)

  return result.rows.map(toEquipmentRow)
}

/** The full log of one item, newest first — what the detail page renders under the summary. */
export const loadEquipmentHistory = async (
  payload: Payload,
  equipmentId: number,
): Promise<EquipmentEventRowT[]> => {
  const db = await getDb(payload)

  const result = await db.execute(sql`
    SELECT
      e.id, e.occurred_at, e.holder_id, e.warehouse_id, e.service_provider,
      e.investment_id, e.cost, e.note,
      u.name AS holder_name,
      w.name AS warehouse_name,
      i.name AS investment_name,
      COALESCE(
        (SELECT array_agg(r.media_id ORDER BY r."order", r.id)
         FROM equipment_events_rels r
         WHERE r.parent_id = e.id AND r.media_id IS NOT NULL),
        '{}'
      ) AS attachment_ids
    FROM equipment_events e
    LEFT JOIN users u ON u.id = e.holder_id
    LEFT JOIN warehouses w ON w.id = e.warehouse_id
    LEFT JOIN investments i ON i.id = e.investment_id
    WHERE e.equipment_id = ${equipmentId}
    ORDER BY e.occurred_at DESC, e.id DESC
  `)

  return result.rows.map(toEquipmentEventRow)
}
