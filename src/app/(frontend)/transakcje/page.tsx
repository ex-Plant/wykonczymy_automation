import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'
import { TransactionFilters } from './_components/transaction-filters'
import { TransactionsTable } from './_components/transactions-table'
import { AddTransactionButton } from './_components/add-transaction-button'
import type { Where } from 'payload'

const PER_PAGE = 20

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

  const [transactions, cashRegisters] = await Promise.all([
    payload.find({
      collection: 'transactions',
      where,
      sort: '-date',
      limit: PER_PAGE,
      page: currentPage,
      depth: 1,
    }),
    payload.find({ collection: 'cash-registers', limit: 100 }),
  ])

  const rows = transactions.docs.map((tx) => ({
    id: tx.id,
    description: tx.description,
    amount: tx.amount,
    type: tx.type,
    paymentMethod: tx.paymentMethod,
    date: tx.date,
    cashRegisterName:
      typeof tx.cashRegister === 'object' && tx.cashRegister !== null ? tx.cashRegister.name : '—',
  }))

  const cashRegisterOptions = cashRegisters.docs.map((d) => ({ id: d.id, name: d.name }))

  // Build pagination URLs
  const buildPageUrl = (page: number) => {
    const p = new URLSearchParams()
    if (typeParam) p.set('type', typeParam)
    if (cashRegisterParam) p.set('cashRegister', cashRegisterParam)
    if (fromParam) p.set('from', fromParam)
    if (toParam) p.set('to', toParam)
    if (page > 1) p.set('page', String(page))
    const qs = p.toString()
    return `/transakcje${qs ? `?${qs}` : ''}`
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
        <TransactionsTable transactions={rows} userRole={user.role} />
      </div>

      {/* Pagination */}
      {transactions.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Strona {transactions.page} z {transactions.totalPages} ({transactions.totalDocs}{' '}
            wyników)
          </p>
          <div className="flex gap-2">
            {transactions.hasPrevPage && (
              <Link
                href={buildPageUrl(currentPage - 1)}
                className="border-border text-foreground hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
              >
                Poprzednia
              </Link>
            )}
            {transactions.hasNextPage && (
              <Link
                href={buildPageUrl(currentPage + 1)}
                className="border-border text-foreground hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
              >
                Następna
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
