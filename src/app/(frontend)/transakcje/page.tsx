import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'
import { TransactionFilters } from './_components/transaction-filters'
import { TransactionDataTable } from '@/components/transactions/transaction-data-table'
import { AddTransactionButton } from './_components/add-transaction-button'
import { mapTransactionRow } from '@/lib/transactions/map-transaction-row'
import type { Where } from 'payload'

const DEFAULT_LIMIT = 20
const ALLOWED_LIMITS = [20, 50, 100]

type PagePropsT = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function TransactionsPage({ searchParams }: PagePropsT) {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')

  const params = await searchParams
  const payload = await getPayload({ config })
  const isManager = isManagementRole(user.role)

  // Build where query from search params
  const where: Where = {}

  // EMPLOYEE: always filter by own worker ID
  if (!isManager) {
    where.worker = { equals: user.id }
  }

  // Type filter
  const typeParam = typeof params.type === 'string' ? params.type : undefined
  if (typeParam) {
    where.type = { equals: typeParam }
  }

  // Cash register filter
  const cashRegisterParam =
    typeof params.cashRegister === 'string' ? params.cashRegister : undefined
  if (cashRegisterParam) {
    where.cashRegister = { equals: Number(cashRegisterParam) }
  }

  // Date range
  const fromParam = typeof params.from === 'string' ? params.from : undefined
  const toParam = typeof params.to === 'string' ? params.to : undefined
  if (fromParam || toParam) {
    where.date = {}
    if (fromParam) (where.date as Record<string, string>).greater_than_equal = fromParam
    if (toParam) (where.date as Record<string, string>).less_than_equal = toParam
  }

  // Pagination
  const pageParam = typeof params.page === 'string' ? Number(params.page) : 1
  const currentPage = pageParam > 0 ? pageParam : 1

  const limitParam = typeof params.limit === 'string' ? Number(params.limit) : DEFAULT_LIMIT
  const limit = ALLOWED_LIMITS.includes(limitParam) ? limitParam : DEFAULT_LIMIT

  const [transactions, cashRegisters] = await Promise.all([
    payload.find({
      collection: 'transactions',
      where,
      sort: '-date',
      limit,
      page: currentPage,
      depth: 1,
    }),
    payload.find({ collection: 'cash-registers', limit: 100 }),
  ])

  const rows = transactions.docs.map(mapTransactionRow)
  const cashRegisterOptions = cashRegisters.docs.map((d) => ({ id: d.id, name: d.name }))

  const paginationMeta = {
    currentPage: transactions.page ?? 1,
    totalPages: transactions.totalPages,
    totalDocs: transactions.totalDocs,
    limit,
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-2xl font-semibold">Transakcje</h1>
        {isManager && <AddTransactionButton />}
      </div>

      {/* Filters */}
      <div className="mt-6">
        <TransactionFilters cashRegisters={cashRegisterOptions} />
      </div>

      {/* Table */}
      <div className="mt-6">
        <TransactionDataTable
          data={rows}
          paginationMeta={paginationMeta}
          baseUrl="/transakcje"
        />
      </div>
    </div>
  )
}
