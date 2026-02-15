'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { sumEmployeeSaldo } from '@/lib/db/sum-transactions'
import { mapTransactionRow } from './map-transaction-row'
import type { TransactionRowT } from './types'
import {
  buildPaginationMeta,
  DEFAULT_LIMIT,
  ALLOWED_LIMITS,
  type PaginationMetaT,
} from '@/lib/pagination'

export type MonthlyDataT = {
  rows: TransactionRowT[]
  paginationMeta: PaginationMetaT
  monthlySaldo: number
}

export async function getEmployeeSaldo(userId: number): Promise<number> {
  const payload = await getPayload({ config })
  return sumEmployeeSaldo(payload, userId)
}

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
}
