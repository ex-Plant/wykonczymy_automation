import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import type { SnapshotPayloadT } from './snapshot-format'
import { indexReturnedIds, insertItems, insertSections, requireNewId } from './insert-rows'

// Bulk-insert a serialized kosztorys tree onto an investment, on a caller-owned transaction handle.
// Shared by restoreKosztorys (wipe → insert → settings) and applyPreset (insert-only) — each caller
// owns the transaction and adds its own wipe/settings semantics around this.
//
// ONE bulk `INSERT … RETURNING id` per level, not row-by-row payload.create: a ~1000-row restore was
// ~12.6s paying Payload's full per-doc cost (validate + hooks + create machinery) ×N, serially. Raw
// insert on the tx-scoped handle loses nothing (the rows were valid when captured) and drops it well
// under a second. Old→new id maps join RETURNING on each row's natural key, never on Postgres's row
// order — see the contract note in insert-rows.ts. Insert order is FK-safe: sections → items → stages
// → progress. Tolerant deserialization: missing arrays default to empty; a child whose parent is
// absent is skipped rather than orphaned, so an older payload survives an additive migration.
export async function insertKosztorysTree(
  db: DbExecutorT,
  investmentId: number,
  tree: SnapshotPayloadT,
): Promise<void> {
  const sections = tree.sections ?? []
  const sectionIds = await insertSections(
    db,
    investmentId,
    sections.map((section) => ({ displayOrder: section.displayOrder, section })),
  )
  const sectionIdMap = new Map(sections.map((s, i) => [s.id, sectionIds[i]]))

  // flatMap folds both concerns the primitive stays out of: drop an item whose parent section is
  // absent (would orphan the FK), and resolve the survivor's old section id to the new one.
  const itemRows = (tree.items ?? []).flatMap((item) => {
    const sectionId = sectionIdMap.get(item.sectionId)
    return sectionId === undefined ? [] : [{ sectionId, item }]
  })
  const itemIds = await insertItems(db, investmentId, itemRows)
  const itemIdMap = new Map(itemRows.map(({ item }, i) => [item.id, itemIds[i]]))

  const stages = tree.stages ?? []
  const stageIdMap = new Map<number, number>()
  if (stages.length > 0) {
    const rows = stages.map(
      (s) => sql`(${investmentId}, ${s.ordinal}, ${s.label ?? null}, ${s.plane ?? null})`,
    )
    const res = await db.execute(sql`
      INSERT INTO kosztorys_stages (investment_id, ordinal, label, plane)
      VALUES ${sql.join(rows, sql.raw(', '))}
      RETURNING id, ordinal
    `)
    // `ordinal` is the stage's natural key (unique per investment) — join on it, not on row order.
    const byOrdinal = indexReturnedIds(
      res.rows,
      (row) => Number(row.ordinal),
      stages.length,
      'kosztorys_stages',
    )
    stages.forEach((s) =>
      stageIdMap.set(s.id, requireNewId(byOrdinal, s.ordinal, 'kosztorys_stages')),
    )
  }

  // Skip a progress row whose item or stage is absent (dangling FK).
  const progress = (tree.progress ?? []).filter(
    (p) => itemIdMap.has(p.itemId) && stageIdMap.has(p.stageId),
  )
  if (progress.length > 0) {
    const rows = progress.map(
      (p) => sql`(${itemIdMap.get(p.itemId)}, ${stageIdMap.get(p.stageId)}, ${p.qtyDone})`,
    )
    await db.execute(sql`
      INSERT INTO stage_progress (item_id, stage_id, qty_done)
      VALUES ${sql.join(rows, sql.raw(', '))}
    `)
  }
}
