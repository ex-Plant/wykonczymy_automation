'use server'

import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { sumEmployeeSaldo } from '@/lib/db/sum-transactions'
import { mapTransactionRow, type TransactionRowT } from '@/lib/tables/transactions'
import {
  buildPaginationMeta,
  DEFAULT_LIMIT,
  ALLOWED_LIMITS,
  type PaginationMetaT,
} from '@/lib/pagination'
import { CACHE_TAGS } from '@/lib/cache/tags'

export type MonthlyDataT = {
  rows: TransactionRowT[]
  paginationMeta: PaginationMetaT
  monthlySaldo: number
}

export async function getEmployeeSaldo(userId: number): Promise<number> {
  return getCachedEmployeeSaldo(userId)
}

const getCachedEmployeeSaldo = unstable_cache(
  async (userId: number) => {
    const payload = await getPayload({ config })
    return sumEmployeeSaldo(payload, userId)
  },
  ['employee-saldo-direct'],
  { tags: [CACHE_TAGS.transactions] },
)

export async function getEmployeeMonthlyData({
  userId,
  month,
  year,
  page = 1,
  limit = DEFAULT_LIMIT,
}: {
  userId: number
  month: number
  year: number
  page?: number
  limit?: number
}): Promise<MonthlyDataT> {
  return getCachedMonthlyData(userId, month, year, page, limit)
}

const getCachedMonthlyData = unstable_cache(
  async (userId: number, month: number, year: number, page: number, limit: number) => {
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

    return {
      rows: transactions.docs.map(mapTransactionRow),
      paginationMeta: buildPaginationMeta(transactions, safeLimit),
      monthlySaldo,
    }
  },
  ['employee-monthly-data'],
  { tags: [CACHE_TAGS.transactions] },
)

export async function getManagementEmployeeSaldo(workerId: number): Promise<{ saldo: number }> {
  const user = await getCurrentUser()
  if (!user || !isManagementRole(user.role)) {
    throw new Error('Brak uprawnień')
  }

  const saldo = await getCachedEmployeeSaldo(workerId)
  return { saldo }
}
