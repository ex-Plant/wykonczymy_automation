'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { mapTransactionRow } from './map-transaction-row'
import type { TransactionRowT, PaginationMetaT } from './types'

const DEFAULT_LIMIT = 20
const ALLOWED_LIMITS = [20, 50, 100]

export type MonthlyDataT = {
  rows: TransactionRowT[]
  paginationMeta: PaginationMetaT
  monthlySaldo: number
}

export async function getEmployeeSaldo(userId: number): Promise<number> {
  const payload = await getPayload({ config })

  const [advanceDocs, expenseDocs] = await Promise.all([
    payload.find({
      collection: 'transactions',
      where: { worker: { equals: userId }, type: { equals: 'ADVANCE' } },
      select: { amount: true },
      limit: 0,
    }),
    payload.find({
      collection: 'transactions',
      where: { worker: { equals: userId }, type: { equals: 'EMPLOYEE_EXPENSE' } },
      select: { amount: true },
      limit: 0,
    }),
  ])

  const advanceSum = advanceDocs.docs.reduce((sum, tx) => sum + tx.amount, 0)
  const expenseSum = expenseDocs.docs.reduce((sum, tx) => sum + tx.amount, 0)

  return advanceSum - expenseSum
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

  const [transactions, monthlySaldoDocs] = await Promise.all([
    payload.find({
      collection: 'transactions',
      where: { worker: { equals: userId }, date: dateRange },
      sort: '-date',
      limit: safeLimit,
      page: safePage,
      depth: 1,
    }),
    payload.find({
      collection: 'transactions',
      where: {
        worker: { equals: userId },
        type: { in: ['ADVANCE', 'EMPLOYEE_EXPENSE'] },
        date: dateRange,
      },
      select: { amount: true, type: true },
      limit: 0,
    }),
  ])

  let monthlyAdvanceSum = 0
  let monthlyExpenseSum = 0

  for (const tx of monthlySaldoDocs.docs) {
    if (tx.type === 'ADVANCE') monthlyAdvanceSum += tx.amount
    else monthlyExpenseSum += tx.amount
  }

  return {
    rows: transactions.docs.map(mapTransactionRow),
    paginationMeta: {
      currentPage: transactions.page ?? 1,
      totalPages: transactions.totalPages,
      totalDocs: transactions.totalDocs,
      limit: safeLimit,
    },
    monthlySaldo: monthlyAdvanceSum - monthlyExpenseSum,
  }
}
