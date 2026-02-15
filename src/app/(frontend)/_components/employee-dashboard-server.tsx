import { parsePagination } from '@/lib/pagination'
import { getEmployeeSaldo } from '@/lib/queries/employees'
import { findTransactions, buildTransactionFilters } from '@/lib/queries/transactions'
import { getUserSaldo } from '@/lib/queries/users'
import { formatPLN } from '@/lib/format-currency'
import { MONTHS } from '@/components/ui/month-year-picker'
import { TransactionDataTable } from '@/components/transactions/transaction-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { StatCard } from '@/components/ui/stat-card'

const EMPLOYEE_EXCLUDE_COLUMNS = [
  'type',
  'cashRegister',
  'investment',
  'worker',
  'otherCategory',
  'invoice',
  'paymentMethod',
]

type EmployeeDashboardServerPropsT = {
  userId: number
  searchParams: Record<string, string | string[] | undefined>
}

export async function EmployeeDashboardServer({
  userId,
  searchParams,
}: EmployeeDashboardServerPropsT) {
  const { page, limit } = parsePagination(searchParams)

  // from/to are guaranteed by the redirect in page.tsx
  const from = searchParams.from as string
  const to = searchParams.to as string
  const displayMonth = new Date(from + 'T00:00:00').getMonth() + 1
  const displayYear = new Date(from + 'T00:00:00').getFullYear()

  const where = buildTransactionFilters(searchParams, { id: userId, isManager: false })

  const [{ rows, paginationMeta }, overallSaldo, periodSaldo] = await Promise.all([
    findTransactions({ where, page, limit }),
    getUserSaldo(String(userId)),
    getEmployeeSaldo(userId),
  ])

  return (
    <PageWrapper title="Moje konto">
      {/* Saldo cards */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Saldo ogólne (zaliczki - wydatki)" value={formatPLN(overallSaldo)} />
        <StatCard
          label={`Saldo — ${MONTHS[displayMonth - 1]} ${displayYear}`}
          value={formatPLN(periodSaldo)}
        />
      </div>

      {/* Transactions table with month/year picker */}
      <div className="mt-8">
        <h2 className="text-foreground text-lg font-medium">
          Transakcje — {MONTHS[displayMonth - 1]} {displayYear}
        </h2>
        <TransactionDataTable
          data={rows}
          paginationMeta={paginationMeta}
          excludeColumns={EMPLOYEE_EXCLUDE_COLUMNS}
          baseUrl="/"
          filters={{ showTypeFilter: false }}
          className="mt-4"
        />
      </div>
    </PageWrapper>
  )
}
