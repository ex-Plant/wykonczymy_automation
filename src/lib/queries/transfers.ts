import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { Where } from 'payload'
import { buildPaginationMeta, type PaginationParamsT } from '@/lib/pagination'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/sum-transactions'

type FindTransactionsOptsT = PaginationParamsT & {
  readonly where?: Where
  readonly sort?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawTransactionDocT = Record<string, any>

export async function findTransactionsRaw({
  where = {},
  page,
  limit,
  sort = '-date',
}: FindTransactionsOptsT) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transactions)

  const start = performance.now()
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'transactions',
    where,
    sort,
    limit,
    page,
    depth: 0,
  })
  console.log(
    `[PERF] query.findTransactionsRaw ${(performance.now() - start).toFixed(1)}ms (${result.docs.length} docs, page=${page})`,
  )

  return {
    docs: result.docs as RawTransactionDocT[],
    paginationMeta: buildPaginationMeta(result, limit),
  }
}

export async function findAllTransactionsRaw({
  where = {},
  sort = '-date',
}: {
  readonly where?: Where
  readonly sort?: string
}) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transactions)

  const start = performance.now()
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'transactions',
    where,
    sort,
    pagination: false,
    depth: 0,
  })
  console.log(
    `[PERF] query.findAllTransactionsRaw ${(performance.now() - start).toFixed(1)}ms (${result.docs.length} docs)`,
  )

  return result.docs as RawTransactionDocT[]
}

export async function countRecentTransactions(sinceDate: string) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transactions)

  const start = performance.now()
  const payload = await getPayload({ config })
  const db = await getDb(payload)

  const result = await db.execute(
    sql`SELECT COUNT(*) AS count FROM transactions WHERE date >= ${sinceDate}`,
  )
  const count = Number(result.rows[0].count)
  console.log(
    `[PERF] query.countRecentTransactions ${(performance.now() - start).toFixed(1)}ms (${count} total)`,
  )

  return count
}

type SearchParamsT = Record<string, string | string[] | undefined>

type UserContextT = {
  readonly id: number
  readonly isManager: boolean
}

export function buildTransactionFilters(
  searchParams: SearchParamsT,
  userContext: UserContextT,
): Where {
  const where: Where = {}

  // EMPLOYEE: always filter by own worker ID
  if (!userContext.isManager) {
    where.worker = { equals: userContext.id }
  }

  // Type filter
  const typeParam = typeof searchParams.type === 'string' ? searchParams.type : undefined
  if (typeParam) {
    where.type = { equals: typeParam }
  }

  // Cash register filter
  const cashRegisterParam =
    typeof searchParams.cashRegister === 'string' ? searchParams.cashRegister : undefined
  if (cashRegisterParam) {
    where.cashRegister = { equals: Number(cashRegisterParam) }
  }

  // Investment filter
  const investmentParam =
    typeof searchParams.investment === 'string' ? searchParams.investment : undefined
  if (investmentParam) {
    where.investment = { equals: Number(investmentParam) }
  }

  // Date range
  const fromParam = typeof searchParams.from === 'string' ? searchParams.from : undefined
  const toParam = typeof searchParams.to === 'string' ? searchParams.to : undefined
  if (fromParam || toParam) {
    where.date = {}
    if (fromParam) (where.date as Record<string, string>).greater_than_equal = fromParam
    if (toParam) (where.date as Record<string, string>).less_than_equal = toParam
  }

  return where
}
