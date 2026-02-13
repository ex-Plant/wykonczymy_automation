import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { ManagerDashboard } from './_components/manager-dashboard'
import { EmployeeDashboard } from './_components/employee-dashboard'
import { mapTransactionRow } from '@/lib/transactions/map-transaction-row'
import { redirect } from 'next/navigation'

const DEFAULT_LIMIT = 20
const ALLOWED_LIMITS = [20, 50, 100]

type PagePropsT = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function DashboardPage({ searchParams }: PagePropsT) {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')
  if (isManagementRole(user.role)) return <ManagerDashboard />

  const params = await searchParams
  const payload = await getPayload({ config })

  const now = new Date()
  const month =
    typeof params.month === 'string' ? Number(params.month) : now.getMonth() + 1
  const year =
    typeof params.year === 'string' ? Number(params.year) : now.getFullYear()

  const pageParam = typeof params.page === 'string' ? Number(params.page) : 1
  const currentPage = pageParam > 0 ? pageParam : 1

  const limitParam = typeof params.limit === 'string' ? Number(params.limit) : DEFAULT_LIMIT
  const limit = ALLOWED_LIMITS.includes(limitParam) ? limitParam : DEFAULT_LIMIT

  // Build date range for the selected month
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)

  const [transactions, advanceDocs, expenseDocs] = await Promise.all([
    payload.find({
      collection: 'transactions',
      where: {
        worker: { equals: user.id },
        date: {
          greater_than_equal: startDate.toISOString(),
          less_than_equal: endDate.toISOString(),
        },
      },
      sort: '-date',
      limit,
      page: currentPage,
      depth: 1,
    }),
    // All-time advances for this worker
    payload.find({
      collection: 'transactions',
      where: {
        worker: { equals: user.id },
        type: { equals: 'ADVANCE' },
      },
      limit: 0,
    }),
    // All-time employee expenses for this worker
    payload.find({
      collection: 'transactions',
      where: {
        worker: { equals: user.id },
        type: { equals: 'EMPLOYEE_EXPENSE' },
      },
      limit: 0,
    }),
  ])

  const advanceSum = advanceDocs.docs.reduce((sum, tx) => sum + tx.amount, 0)
  const expenseSum = expenseDocs.docs.reduce((sum, tx) => sum + tx.amount, 0)
  const saldo = advanceSum - expenseSum

  const rows = transactions.docs.map(mapTransactionRow)

  const paginationMeta = {
    currentPage: transactions.page ?? 1,
    totalPages: transactions.totalPages,
    totalDocs: transactions.totalDocs,
    limit,
  }

  return (
    <EmployeeDashboard
      rows={rows}
      paginationMeta={paginationMeta}
      saldo={saldo}
      month={month}
      year={year}
    />
  )
}
