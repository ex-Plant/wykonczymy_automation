import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidateCollection } from '@/lib/cache/revalidate'
import type { CACHE_TAGS } from '@/lib/cache/tags'

type CollectionSlugT = keyof typeof CACHE_TAGS

export function makeRevalidateAfterChange(slug: CollectionSlugT): CollectionAfterChangeHook {
  return ({ doc, context }) => {
    if (!context.skipRevalidation) {
      revalidateCollection(slug)
    }
    return doc
  }
}

export function makeRevalidateAfterDelete(slug: CollectionSlugT): CollectionAfterDeleteHook {
  return ({ doc, context }) => {
    if (!context.skipRevalidation) {
      revalidateCollection(slug)
    }
    return doc
  }
}
