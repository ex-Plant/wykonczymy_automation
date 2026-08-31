import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { listCatalogueItems } from '@/lib/db/work-catalogue'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

// The whole cennik, in one argument-free cache entry — the katalog is global and a few hundred rows,
// so there is nothing to paginate or scope. Same shape as `getPresets`; invalidated by the
// collection's own hooks and by every action that writes through the `workCatalogue` tag.
export const getWorkCatalogue = unstable_cache(
  async (): Promise<WorkCatalogueItemT[]> => {
    const payload = await getPayload({ config })
    return listCatalogueItems(await getDb(payload))
  },
  ['work-catalogue'],
  { tags: [CACHE_TAGS.workCatalogue] },
)
