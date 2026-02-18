import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidateTag } from 'next/cache'
import { revalidateCollection } from '@/lib/cache/revalidate'
import type { CACHE_TAGS } from '@/lib/cache/tags'
import { entityTag } from '@/lib/cache/tags'

type CollectionSlugT = keyof typeof CACHE_TAGS

export function makeRevalidateAfterChange(slug: CollectionSlugT): CollectionAfterChangeHook {
  return ({ doc, context }) => {
    if (!context.skipRevalidation) {
      revalidateCollection(slug)
      revalidateTag(entityTag(slug, doc.id), 'max')
    }
    return doc
  }
}

export function makeRevalidateAfterDelete(slug: CollectionSlugT): CollectionAfterDeleteHook {
  return ({ doc, context }) => {
    if (!context.skipRevalidation) {
      revalidateCollection(slug)
      revalidateTag(entityTag(slug, doc.id), 'max')
    }
    return doc
  }
}
