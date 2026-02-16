import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'

type RefItemT = { readonly id: number; readonly name: string }

export type ReferenceDataT = {
  readonly cashRegisters: RefItemT[]
  readonly investments: RefItemT[]
  readonly workers: RefItemT[]
  readonly otherCategories: RefItemT[]
}

export async function fetchReferenceData(): Promise<ReferenceDataT> {
  'use cache'
  cacheLife('max')
  cacheTag(
    CACHE_TAGS.cashRegisters,
    CACHE_TAGS.investments,
    CACHE_TAGS.users,
    CACHE_TAGS.otherCategories,
  )

  const start = performance.now()
  const payload = await getPayload({ config })
  const [cashRegisters, investments, workers, otherCategories] = await Promise.all([
    payload.find({ collection: 'cash-registers', pagination: false }),
    payload.find({
      collection: 'investments',
      where: { status: { equals: 'active' } },
      pagination: false,
    }),
    payload.find({ collection: 'users', pagination: false }),
    payload.find({ collection: 'other-categories', pagination: false }),
  ])
  console.log(
    `[PERF] query.fetchReferenceData ${(performance.now() - start).toFixed(1)}ms (4 collections)`,
  )

  return {
    cashRegisters: cashRegisters.docs.map((d) => ({ id: d.id, name: d.name })),
    investments: investments.docs.map((d) => ({ id: d.id, name: d.name })),
    workers: workers.docs.map((d) => ({ id: d.id, name: d.name })),
    otherCategories: otherCategories.docs.map((d) => ({ id: d.id, name: d.name })),
  }
}
