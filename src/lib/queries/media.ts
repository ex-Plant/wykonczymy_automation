import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'

export type MediaInfoT = {
  url: string | null
  filename: string | null
  mimeType: string | null
}

type MediaRowT = MediaInfoT & { id: number }

// Cached whole rather than per-id, and that inversion is the point: the id-filtered read ran on
// every render (a serial hop behind the transfers query, since it needs their invoice ids), while
// this one runs only after a media write — and reads outnumber media writes by orders of magnitude.
// The full sweep is also cheaper outright (0.26ms vs 1.6ms measured): 988 rows / 808kB read
// sequentially beats one index probe per id. Returns an array, not a Map — `unstable_cache`
// serializes its result and a Map would not survive the round-trip.
const fetchAllMedia = unstable_cache(
  async (): Promise<MediaRowT[]> => {
    const elapsed = perfStart()
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'media',
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    console.log(`[PERF] query.fetchAllMedia ${elapsed()}ms (${result.docs.length} docs)`)

    return result.docs.map((doc) => ({
      id: doc.id,
      url: (doc.url as string) ?? null,
      filename: (doc.filename as string) ?? null,
      mimeType: (doc.mimeType as string) ?? null,
    }))
  },
  ['media-all'],
  { tags: [CACHE_TAGS.media] },
)

export async function fetchMediaByIds(ids: number[]): Promise<Map<number, MediaInfoT>> {
  const map = new Map<number, MediaInfoT>()
  if (ids.length === 0) return map

  const wanted = new Set(ids)
  for (const { id, ...info } of await fetchAllMedia()) {
    if (wanted.has(id)) map.set(id, info)
  }

  return map
}
