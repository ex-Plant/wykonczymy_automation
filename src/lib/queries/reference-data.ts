import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'

export const fetchReferenceData = unstable_cache(
  async () => {
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
    return {
      cashRegisters: cashRegisters.docs.map((d) => ({ id: d.id, name: d.name })),
      investments: investments.docs.map((d) => ({ id: d.id, name: d.name })),
      workers: workers.docs.map((d) => ({ id: d.id, name: d.name })),
      otherCategories: otherCategories.docs.map((d) => ({ id: d.id, name: d.name })),
    }
  },
  ['reference-data'],
  {
    tags: [
      CACHE_TAGS.cashRegisters,
      CACHE_TAGS.investments,
      CACHE_TAGS.users,
      CACHE_TAGS.otherCategories,
    ],
  },
)
