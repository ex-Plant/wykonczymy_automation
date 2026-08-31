import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-vercel-postgres'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { toCatalogueItem } from '@/lib/db/work-catalogue'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

// The whole cennik, in one argument-free cache entry — the katalog is global and a few hundred rows,
// so there is nothing to paginate or scope. Same shape as `getPresets`; invalidated by the
// collection's own hooks and by every action that writes through the `workCatalogue` tag.
export const getWorkCatalogue = unstable_cache(
  async (): Promise<WorkCatalogueItemT[]> => {
    const payload = await getPayload({ config })
    const db = await getDb(payload)
    const result = await db.execute(sql`
      SELECT id, description, category, unit, client_price, w_tools_rate, own_tools_rate, match_key
      FROM work_catalogue_items
      ORDER BY category NULLS LAST, description
    `)
    return result.rows.map(toCatalogueItem)
  },
  ['work-catalogue'],
  { tags: [CACHE_TAGS.workCatalogue] },
)
