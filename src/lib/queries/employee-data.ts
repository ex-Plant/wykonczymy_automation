import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sumEmployeeSaldo } from '@/lib/db/sum-transactions'
import { mapTransactionRow } from '@/lib/tables/transactions'
import { buildPaginationMeta, DEFAULT_LIMIT, ALLOWED_LIMITS } from '@/lib/pagination'
import { CACHE_TAGS } from '@/lib/cache/tags'

export async function getCachedEmployeeSaldo(userId: number) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transactions)

  const start = performance.now()
  const payload = await getPayload({ config })
  const result = await sumEmployeeSaldo(payload, userId)
  console.log(
    `[PERF] query.getCachedEmployeeSaldo(${userId}) ${(performance.now() - start).toFixed(1)}ms`,
  )
  return result
}

export async function getCachedMonthlyData(
  userId: number,
  month: number,
  year: number,
  page: number,
  limit: number,
) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transactions)

  const start = performance.now()
  const payload = await getPayload({ config })

  const safeLimit = ALLOWED_LIMITS.includes(limit) ? limit : DEFAULT_LIMIT
  const safePage = page > 0 ? page : 1

  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)

  const dateRange = {
    greater_than_equal: startDate.toISOString(),
    less_than_equal: endDate.toISOString(),
  }

  const [transactions, monthlySaldo] = await Promise.all([
    payload.find({
      collection: 'transactions',
      where: { worker: { equals: userId }, date: dateRange },
      sort: '-date',
      limit: safeLimit,
      page: safePage,
      depth: 1,
    }),
    sumEmployeeSaldo(payload, userId, {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    }),
  ])
  console.log(
    `[PERF] query.getCachedMonthlyData(user=${userId}, ${month}/${year}) ${(performance.now() - start).toFixed(1)}ms (${transactions.docs.length} docs)`,
  )

  return {
    rows: transactions.docs.map(mapTransactionRow),
    paginationMeta: buildPaginationMeta(transactions, safeLimit),
    monthlySaldo,
  }
}
