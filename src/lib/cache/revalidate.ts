import { revalidateTag, updateTag } from 'next/cache'
import { CACHE_TAGS } from './tags'

/**
 * Invalidate cache for a collection. Uses `updateTag` for immediate invalidation.
 * WARNING: Only call from Server Actions. Payload hooks must use `revalidateTag` directly
 * because they run in Route Handler context where `updateTag` throws.
 */
export function revalidateCollection(slug: keyof typeof CACHE_TAGS) {
  updateTag(CACHE_TAGS[slug])
}

/**
 * `deferRefresh` picks which of `updateTag`'s two effects the caller wants. Both expire the tag;
 * `updateTag` additionally re-renders the calling route and streams it back in the action response,
 * while `revalidateTag` leaves the current route alone and only affects the next request for it.
 *
 * Default (`updateTag`) is right whenever the caller's own UI reads a cached value it just changed.
 * Pass `deferRefresh` when the only readers of these tags are OTHER routes — the re-render is then
 * pure cost, and on a debounced per-cell autosave it is paid on every keystroke burst.
 */
export function revalidateCollections(
  slugs: (keyof typeof CACHE_TAGS)[],
  { deferRefresh = false }: { deferRefresh?: boolean } = {},
) {
  for (const slug of slugs) {
    if (deferRefresh) revalidateTag(CACHE_TAGS[slug], 'default')
    else updateTag(CACHE_TAGS[slug])
  }
}
