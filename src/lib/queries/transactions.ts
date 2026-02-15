import { cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { mapTransactionRow } from '@/lib/tables/transactions'
import { buildPaginationMeta, type PaginationParamsT } from '@/lib/pagination'
import { CACHE_TAGS } from '@/lib/cache/tags'

type FindTransactionsOptsT = PaginationParamsT & {
  readonly where?: Where
  readonly sort?: string
}

export async function findTransactions({
  where = {},
  page,
  limit,
  sort = '-date',
}: FindTransactionsOptsT) {
  'use cache'
  cacheTag(CACHE_TAGS.transactions)

  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'transactions',
    where,
    sort,
    limit,
    page,
    depth: 1,
  })

  return {
    rows: result.docs.map(mapTransactionRow),
    paginationMeta: buildPaginationMeta(result, limit),
  }
}

export async function countRecentTransactions(sinceDate: string) {
  'use cache'
  cacheTag(CACHE_TAGS.transactions)

  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'transactions',
    limit: 0,
    where: { date: { greater_than_equal: sinceDate } },
  })

  return result.totalDocs
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
