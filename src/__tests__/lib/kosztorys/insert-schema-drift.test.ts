import { describe, it, expect, beforeAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'

// Restore rebuilds the kosztorys tree with four hand-written INSERTs (insert-rows.ts and the two
// inline ones in insert-kosztorys-tree.ts). Nothing connects those column lists to the tables they
// write: add a column in a migration and restore keeps working, silently dropping the new field on
// every snapshot it reinserts. There is no error to notice — the restored row just carries the
// column's default.
//
// So this spec pins the intended lists against the live schema. It is a MIRROR, and mirrors can be
// made green the lazy way (adding the column here and not to the INSERT) — but it fires on the case
// that actually happens: a migration lands and nobody thinks about restore.
const EXCLUDED = ['id', 'created_at', 'updated_at']

const INSERT_COLUMNS: Record<string, string[]> = {
  kosztorys_sections: ['investment_id', 'name', 'display_order', 'color'],
  kosztorys_items: [
    'investment_id',
    'section_id',
    'display_order',
    'description',
    'unit',
    'planned_qty',
    'discount_type',
    'discount_value',
    'client_price',
    'w_tools_override_type',
    'w_tools_override_value',
    'own_tools_override_type',
    'own_tools_override_value',
    'hidden_in_export',
    'note',
  ],
  kosztorys_stages: ['investment_id', 'ordinal', 'label', 'plane'],
  stage_progress: ['item_id', 'stage_id', 'qty_done'],
}

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('restore INSERT column lists vs live schema (DB)', () => {
  let db: Awaited<ReturnType<typeof getDb>>
  let payload: Payload

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
  })

  it.each(Object.keys(INSERT_COLUMNS))(
    '%s — every column restore must carry is written by the INSERT',
    async (table) => {
      const res = await db.execute(sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${table}
      `)

      // A typo'd or renamed table would otherwise report "no drift" against an empty schema.
      expect(res.rows.length).toBeGreaterThan(0)

      const live = res.rows
        .map((row) => String(row.column_name))
        .filter((name) => !EXCLUDED.includes(name))
        .sort()

      expect(live).toEqual([...INSERT_COLUMNS[table]].sort())
    },
  )
})
