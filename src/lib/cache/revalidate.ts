import { revalidateTag } from 'next/cache'
import { CACHE_TAGS } from './tags'

export function revalidateCollection(slug: keyof typeof CACHE_TAGS) {
  revalidateTag(CACHE_TAGS[slug], 'max')
}

export function revalidateCollections(slugs: (keyof typeof CACHE_TAGS)[]) {
  for (const slug of slugs) {
    revalidateTag(CACHE_TAGS[slug], 'max')
  }
}
