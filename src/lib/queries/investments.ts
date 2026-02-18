import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { buildPaginationMeta, type PaginationParamsT } from '@/lib/pagination'
import { CACHE_TAGS, entityTag } from '@/lib/cache/tags'
import type { InvestmentRowT } from '@/lib/tables/investments'

export async function findInvestments({ page, limit }: PaginationParamsT) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.investments)

  const start = performance.now()
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'investments',
    sort: 'name',
    limit,
    page,
  })
  console.log(`[PERF] query.findInvestments ${(performance.now() - start).toFixed(1)}ms`)

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
}

export async function getInvestment(id: string) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.investments, entityTag('investment', id))

  const start = performance.now()
  const payload = await getPayload({ config })
  try {
    const investment = await payload.findByID({ collection: 'investments', id })
    console.log(`[PERF] query.getInvestment(${id}) ${(performance.now() - start).toFixed(1)}ms`)
    return investment ?? null
  } catch {
    return null
  }
}

export async function findAllInvestments() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.investments)

  const start = performance.now()
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'investments',
    pagination: false,
    sort: 'name',
  })
  console.log(
    `[PERF] query.findAllInvestments ${(performance.now() - start).toFixed(1)}ms (${result.docs.length} docs)`,
  )

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

  return rows
}

export async function findActiveInvestments() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.investments)

  const start = performance.now()
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'investments',
    where: { status: { equals: 'active' } },
    pagination: false,
    depth: 0,
  })
  console.log(
    `[PERF] query.findActiveInvestments ${(performance.now() - start).toFixed(1)}ms (${result.docs.length} docs)`,
  )

  return result.docs.map((inv) => ({
    id: inv.id as number,
    name: inv.name as string,
  }))
}
