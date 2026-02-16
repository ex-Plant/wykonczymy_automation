import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { buildPaginationMeta, type PaginationParamsT } from '@/lib/pagination'
import { CACHE_TAGS } from '@/lib/cache/tags'
import type { CashRegisterRowT } from '@/lib/tables/cash-registers'

export async function findCashRegisters({ page, limit }: PaginationParamsT) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.cashRegisters)

  const start = performance.now()
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'cash-registers',
    sort: 'name',
    limit,
    page,
    depth: 1,
  })
  console.log(`[PERF] query.findCashRegisters ${(performance.now() - start).toFixed(1)}ms`)

  const rows: CashRegisterRowT[] = result.docs.map((cr) => ({
    id: cr.id,
    name: cr.name,
    ownerName: typeof cr.owner === 'object' && cr.owner !== null ? cr.owner.name : '—',
    balance: cr.balance ?? 0,
  }))

  return {
    rows,
    paginationMeta: buildPaginationMeta(result, limit),
  }
}

export async function getCashRegister(id: string) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.cashRegisters)

  const start = performance.now()
  const payload = await getPayload({ config })
  try {
    const register = await payload.findByID({ collection: 'cash-registers', id, depth: 1 })
    console.log(`[PERF] query.getCashRegister(${id}) ${(performance.now() - start).toFixed(1)}ms`)
    return register ?? null
  } catch {
    return null
  }
}

export async function findAllCashRegisters() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.cashRegisters)

  const start = performance.now()
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'cash-registers',
    pagination: false,
    sort: 'name',
    depth: 1,
  })
  console.log(
    `[PERF] query.findAllCashRegisters ${(performance.now() - start).toFixed(1)}ms (${result.docs.length} docs)`,
  )

  return result.docs.map((cr) => ({
    id: cr.id as number,
    name: cr.name as string,
    ownerName: (typeof cr.owner === 'object' && cr.owner !== null ? cr.owner.name : '—') as string,
    balance: (cr.balance ?? 0) as number,
  }))
}
