// No `server-only` here: the katalog seed script runs these helpers under tsx, where it throws
// (same reason as kosztorys-descriptions.ts).
import { sql } from '@payloadcms/db-vercel-postgres'
import type { CatalogueSeedItemT } from '@/lib/kosztorys/work-catalogue/types'
import type { DbExecutorT } from './get-db'

/** Every klucz already in the cennik — what the seed subtracts before proposing anything. */
export async function listCatalogueMatchKeys(db: DbExecutorT): Promise<Set<string>> {
  const result = await db.execute(sql`SELECT match_key FROM work_catalogue_items`)
  return new Set(result.rows.map((row) => String(row.match_key)))
}

/**
 * One INSERT for the whole wsad, insert-only by construction: `ON CONFLICT DO NOTHING` on the
 * UNIQUE match_key is what makes a repeated run create zero rows without a prior SELECT deciding it
 * — and it is why this can never overwrite a cennik row somebody has since edited by hand.
 *
 * Returns how many rows were actually created (RETURNING skips the conflicting ones).
 */
export async function insertCatalogueItems(
  db: DbExecutorT,
  rows: readonly CatalogueSeedItemT[],
): Promise<number> {
  if (rows.length === 0) return 0
  const values = rows.map(
    (row) => sql`(
      ${row.description}, ${row.category}, ${row.unit},
      ${row.clientPrice}, ${row.wToolsRate}, ${row.ownToolsRate}, ${row.matchKey}
    )`,
  )
  const result = await db.execute(sql`
    INSERT INTO work_catalogue_items
      (description, category, unit, client_price, w_tools_rate, own_tools_rate, match_key)
    VALUES ${sql.join(values, sql.raw(', '))}
    ON CONFLICT (match_key) DO NOTHING
    RETURNING id
  `)
  return result.rows.length
}
