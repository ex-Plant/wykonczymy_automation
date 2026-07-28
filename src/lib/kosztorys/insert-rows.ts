import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import type { KosztorysItemT, KosztorysSectionT } from '@/lib/kosztorys/types'

// The two shared bulk-insert primitives for a kosztorys tree's section and item rows — the low-level
// mechanism that insertKosztorysTree (restore/apply) and appendPresetSections both compose. Kept in
// one place because the column list + per-row VALUES tuple must move in lockstep with the table on any
// column add/reorder; a copy in each caller is exactly what drifts. Everything that differs between the
// callers — display_order source, old→new id remap, orphan filtering, stages/progress — stays in the
// caller: each takes rows already resolved to the columns it writes, so these two functions carry no
// caller-specific branching.
//
// Both return the new ids IN INPUT ORDER, which is what lets a caller zip them back to its inputs
// positionally. That order is reconstructed here by joining RETURNING on each row's natural key — it is
// NOT Postgres's row order. Returning rows in VALUES order holds for a plain INSERT today but is not
// SQL-guaranteed (partitioning, or a rewrite to `INSERT … SELECT`, may reorder), and the failure would
// be silent: every id is a valid id, so children would simply reparent to the wrong rows with no error.
// Joining on the key makes the contract ours to keep instead of Postgres's to honour.

// Natural keys, unique within one insert batch: a section by its display_order (unique per
// investment), an item by (section_id, display_order) (display_order unique per section).
const itemKey = (sectionId: number, displayOrder: number) => `${sectionId}:${displayOrder}`

/**
 * Index `RETURNING` rows by natural key. A collision collapses two rows into one map entry, which is
 * exactly the silent misparenting this join exists to prevent — so a short count throws instead.
 */
export function indexReturnedIds<K>(
  returned: Record<string, unknown>[],
  keyOf: (row: Record<string, unknown>) => K,
  expected: number,
  table: string,
): Map<K, number> {
  const byKey = new Map<K, number>()
  for (const row of returned) byKey.set(keyOf(row), Number(row.id))
  if (byKey.size !== expected) {
    throw new Error(
      `${table}: natural key is not unique within the insert batch (${byKey.size} distinct keys for ${expected} rows) — the old→new id remap would silently misparent children`,
    )
  }
  return byKey
}

export function requireNewId<K>(byKey: Map<K, number>, key: K, table: string): number {
  const id = byKey.get(key)
  if (id === undefined) {
    throw new Error(`${table}: INSERT returned no id for natural key ${String(key)}`)
  }
  return id
}

export async function insertSections(
  db: DbExecutorT,
  investmentId: number,
  rows: { displayOrder: number; section: KosztorysSectionT }[],
): Promise<number[]> {
  if (rows.length === 0) return []
  const values = rows.map(
    ({ displayOrder, section: s }) =>
      sql`(${investmentId}, ${s.name}, ${displayOrder}, ${s.color ?? null})`,
  )
  const res = await db.execute(sql`
    INSERT INTO kosztorys_sections
      (investment_id, name, display_order, color)
    VALUES ${sql.join(values, sql.raw(', '))}
    RETURNING id, display_order
  `)
  const byKey = indexReturnedIds(
    res.rows,
    (row) => Number(row.display_order),
    rows.length,
    'kosztorys_sections',
  )
  return rows.map(({ displayOrder }) => requireNewId(byKey, displayOrder, 'kosztorys_sections'))
}

// `sectionId` is the row's FINAL (already-resolved) parent id — the caller has mapped the preset's old
// section id through to the freshly-minted one and dropped any orphan (a row whose parent is absent),
// so this inserts exactly what it is given. Items keep their own display_order (the section-level
// offset an append applies is a section concern only).
export async function insertItems(
  db: DbExecutorT,
  investmentId: number,
  rows: { sectionId: number; item: KosztorysItemT }[],
): Promise<number[]> {
  if (rows.length === 0) return []
  const values = rows.map(
    ({ sectionId, item: it }) =>
      sql`(${investmentId}, ${sectionId}, ${it.displayOrder}, ${it.description ?? null}, ${it.unit ?? null}, ${it.plannedQty}, ${it.discountType ?? null}, ${it.discountValue}, ${it.clientPrice}, ${it.wToolsOverrideType ?? null}, ${it.wToolsOverrideValue}, ${it.ownToolsOverrideType ?? null}, ${it.ownToolsOverrideValue}, ${it.hiddenInExport}, ${it.note ?? null})`,
  )
  const res = await db.execute(sql`
    INSERT INTO kosztorys_items
      (investment_id, section_id, display_order, description, unit, planned_qty,
       discount_type, discount_value, client_price, w_tools_override_type, w_tools_override_value,
       own_tools_override_type, own_tools_override_value, hidden_in_export, note)
    VALUES ${sql.join(values, sql.raw(', '))}
    RETURNING id, section_id, display_order
  `)
  const byKey = indexReturnedIds(
    res.rows,
    (row) => itemKey(Number(row.section_id), Number(row.display_order)),
    rows.length,
    'kosztorys_items',
  )
  return rows.map(({ sectionId, item }) =>
    requireNewId(byKey, itemKey(sectionId, item.displayOrder), 'kosztorys_items'),
  )
}
