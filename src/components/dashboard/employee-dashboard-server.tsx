import { Suspense } from 'react'
import { parsePagination } from '@/lib/pagination'
import { getEmployeeSaldo } from '@/lib/queries/employees'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { getUserSaldo } from '@/lib/queries/users'
import { formatPLN } from '@/lib/format-currency'
import { MONTHS } from '@/lib/constants/months'
import { TransferTableServer } from '@/components/transfers/transfer-table-server'
import { TransferTableSkeleton } from '@/components/transfers/transfer-table-skeleton'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { StatCard } from '@/components/ui/stat-card'

const EMPLOYEE_EXCLUDE_COLUMNS = [
  'type',
  'cashRegister',
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

  const where = buildTransferFilters(searchParams, { id: userId, isManager: false })

  const [overallSaldo, periodSaldo] = await Promise.all([
    getUserSaldo(String(userId)),
    getEmployeeSaldo(userId),
  ])

  return (
    <PageWrapper title="Moje konto">
      {/* Saldo cards */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Saldo ogólne (zasilenia - wydatki)" value={formatPLN(overallSaldo)} />
        <StatCard
          label={`Saldo — ${MONTHS[displayMonth - 1]} ${displayYear}`}
          value={formatPLN(periodSaldo)}
        />
      </div>

      {/* Transactions table with month/year picker */}
      <div className="mt-8">
        <h2 className="text-foreground text-lg font-medium">
          Transfery — {MONTHS[displayMonth - 1]} {displayYear}
        </h2>
        <Suspense fallback={<TransferTableSkeleton />}>
          <TransferTableServer
            where={where}
            page={page}
            limit={limit}
            excludeColumns={EMPLOYEE_EXCLUDE_COLUMNS}
            baseUrl="/"
            filters={{ showTypeFilter: false }}
            className="mt-4"
          />
        </Suspense>
      </div>
    </PageWrapper>
  )
}
