import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { getUserCashRegisterIds } from '@/lib/auth/get-user-cash-registers'
import { parsePagination } from '@/lib/pagination'
import { getUser, getUserSaldo, getWorkerPeriodBreakdown } from '@/lib/queries/users'
import { findTransactions, buildTransactionFilters } from '@/lib/queries/transactions'
import { findActiveInvestments } from '@/lib/queries/investments'
import { findAllCashRegisters } from '@/lib/queries/cash-registers'
import { formatPLN } from '@/lib/format-currency'
import { ROLE_LABELS, type RoleT } from '@/lib/auth/roles'
import { getMonthDateRange } from '@/lib/helpers'
import { TransactionDataTable } from '@/components/transactions/transaction-data-table'
import { ZeroSaldoDialog } from '@/components/dialogs/zero-saldo-dialog'
import { StatCard } from '@/components/ui/stat-card'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { SectionHeader } from '@/components/ui/section-header'
import { Button } from '@/components/ui/button'

const EXCLUDE_COLUMNS = ['investment', 'worker', 'otherCategory', 'invoice']

type PagePropsT = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function UserDetailPage({ params, searchParams }: PagePropsT) {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const { id } = await params
  const sp = await searchParams
  const { page, limit } = parsePagination(sp)

  const targetUser = await getUser(id)
  if (!targetUser) notFound()

  const baseFilters = buildTransactionFilters(sp, { id: Number(id), isManager: false })
  const fromParam = typeof sp.from === 'string' ? sp.from : undefined
  const toParam = typeof sp.to === 'string' ? sp.to : undefined
  const hasDateRange = fromParam && toParam

  const [
    { rows, paginationMeta },
    saldo,
    periodBreakdown,
    activeInvestments,
    cashRegisters,
    managerRegisterIds,
  ] = await Promise.all([
    findTransactions({ where: baseFilters, page, limit }),
    getUserSaldo(id),
    hasDateRange ? getWorkerPeriodBreakdown(id, fromParam, toParam) : Promise.resolve(undefined),
    findActiveInvestments(),
    findAllCashRegisters(),
    getUserCashRegisterIds(user.id, user.role),
  ])

  // Build report URL — use current date range or default to current month
  const reportDateRange = hasDateRange
    ? { from: fromParam, to: toParam }
    : getMonthDateRange(new Date().getMonth() + 1, new Date().getFullYear())

  const reportParams = new URLSearchParams(
    Object.entries({
      from: reportDateRange.from,
      to: reportDateRange.to,
      type: sp.type,
      cashRegister: sp.cashRegister,
    })
      .filter(([, v]) => typeof v === 'string' && v !== '')
      .map(([k, v]) => [k, String(v)]),
  )

  return (
    <PageWrapper title={targetUser.name} backHref="/uzytkownicy" backLabel="Użytkownicy">
      {/* Info section */}
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground font-medium">Email</dt>
        <dd className="text-foreground">{targetUser.email}</dd>
        <dt className="text-muted-foreground font-medium">Rola</dt>
        <dd className="text-foreground">
          {ROLE_LABELS[targetUser.role as RoleT]?.pl ?? targetUser.role}
        </dd>
      </dl>

      {/* Stat card + zero saldo */}
      <div className="mt-6 flex items-end gap-4">
        <StatCard label="Saldo" value={formatPLN(saldo)} />
        <ZeroSaldoDialog
          saldo={saldo}
          workerId={targetUser.id}
          managerCashRegisterId={managerRegisterIds?.[0]}
          referenceData={{
            investments: activeInvestments.map((i) => ({ id: i.id, name: i.name })),
            cashRegisters: cashRegisters.map((c) => ({ id: c.id, name: c.name })),
          }}
        />
      </div>

      {/* Period stats — only shown when date range is active */}
      {periodBreakdown && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Zaliczki w okresie" value={formatPLN(periodBreakdown.totalAdvances)} />
          <StatCard label="Wydatki w okresie" value={formatPLN(periodBreakdown.totalExpenses)} />
          <StatCard label="Saldo okresu" value={formatPLN(periodBreakdown.periodSaldo)} />
        </div>
      )}

      {/* Report link — always visible */}
      <div className="mt-4 flex justify-end">
        <Button variant="outline" size="sm" asChild>
          <a
            href={`/uzytkownicy/${id}/raport?${reportParams.toString()}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Generuj raport
          </a>
        </Button>
      </div>

      {/* Transactions table with filters */}
      <SectionHeader className="mt-8">Transakcje</SectionHeader>
      <TransactionDataTable
        data={rows}
        paginationMeta={paginationMeta}
        excludeColumns={EXCLUDE_COLUMNS}
        baseUrl={`/uzytkownicy/${id}`}
        filters={{
          cashRegisters: cashRegisters.map((c) => ({ id: c.id, name: c.name })),
        }}
        className="mt-4"
      />
    </PageWrapper>
  )
}
