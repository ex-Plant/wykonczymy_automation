import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { buildPaginationMeta, type PaginationParamsT } from '@/lib/pagination'
import { CACHE_TAGS } from '@/lib/cache/tags'
import type { InvestmentRowT } from '@/lib/tables/investments'

export const findInvestments = unstable_cache(
  async ({ page, limit }: PaginationParamsT) => {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'investments',
      sort: 'name',
      limit,
      page,
    })

    const rows: InvestmentRowT[] = result.docs.map((inv) => ({
      id: inv.id,
      name: inv.name,
      status: inv.status as 'active' | 'completed',
      totalCosts: inv.totalCosts ?? 0,
      address: inv.address ?? '',
      phone: inv.phone ?? '',
      email: inv.email ?? '',
      contactPerson: inv.contactPerson ?? '',
    }))

    return {
      rows,
      paginationMeta: buildPaginationMeta(result, limit),
    }
  },
  ['find-investments'],
  { tags: [CACHE_TAGS.investments] },
)

export const getInvestment = unstable_cache(
  async (id: string) => {
    const payload = await getPayload({ config })
    try {
      const investment = await payload.findByID({ collection: 'investments', id })
      return investment ?? null
    } catch {
      return null
    }
  },
  ['get-investment'],
  { tags: [CACHE_TAGS.investments] },
)

export const findActiveInvestments = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'investments',
      where: { status: { equals: 'active' } },
      pagination: false,
      depth: 0,
    })
    return result.docs.map((inv) => ({
      id: inv.id as number,
      name: inv.name as string,
    }))
  },
  ['find-active-investments'],
  { tags: [CACHE_TAGS.investments] },
)
