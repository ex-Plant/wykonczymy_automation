import { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { isManagementRole } from '@/lib/auth/permissions'
import { getUserCashRegisterIds } from '@/lib/auth/get-user-cash-registers'
import { parsePagination } from '@/lib/pagination'
import { getUser, getUserSaldo, getWorkerPeriodBreakdown } from '@/lib/queries/users'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { findActiveInvestments } from '@/lib/queries/investments'
import { findAllCashRegistersRaw, mapCashRegisterRows } from '@/lib/queries/cash-registers'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { formatPLN } from '@/lib/format-currency'
import { ROLE_LABELS, type RoleT } from '@/lib/auth/roles'
import { getMonthDateRange } from '@/lib/helpers'
import { TransferTableServer } from '@/components/transfers/transfer-table-server'
import { TransferTableSkeleton } from '@/components/transfers/transfer-table-skeleton'

import { StatCard } from '@/components/ui/stat-card'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Button } from '@/components/ui/button'

const EXCLUDE_COLUMNS = ['investment', 'worker', 'otherCategory', 'invoice']

type PagePropsT = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function UserDetailPage({ params, searchParams }: PagePropsT) {
  const user = await getCurrentUserJwt()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const { id } = await params
  const sp = await searchParams
  const { page, limit } = parsePagination(sp)

  const targetUser = await getUser(id)
  if (!targetUser) notFound()

  const baseFilters = buildTransferFilters(sp, { id: Number(id), isManager: false })
  const fromParam = typeof sp.from === 'string' ? sp.from : undefined
  const toParam = typeof sp.to === 'string' ? sp.to : undefined
  const hasDateRange = fromParam && toParam

  const [saldo, periodBreakdown, activeInvestments, rawCashRegisters, managerRegisterIds, refData] =
    await Promise.all([
      getUserSaldo(id),
      hasDateRange ? getWorkerPeriodBreakdown(id, fromParam, toParam) : Promise.resolve(undefined),
      findActiveInvestments(),
      findAllCashRegistersRaw(),
      getUserCashRegisterIds(user.id, user.role),
      fetchReferenceData(),
    ])

  const workersMap = new Map(refData.workers.map((w) => [w.id, w.name]))
  const cashRegisters = mapCashRegisterRows(rawCashRegisters, workersMap)

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
    <PageWrapper title={targetUser.name} backHref="/" backLabel="Kokpit">
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
      </div>

      {/* Period stats — only shown when date range is active */}
      {periodBreakdown && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Zasilenia w okresie" value={formatPLN(periodBreakdown.totalAdvances)} />
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
      <CollapsibleSection title="Transfery" className="mt-8">
        <Suspense fallback={<TransferTableSkeleton />}>
          <TransferTableServer
            where={baseFilters}
            page={page}
            limit={limit}
            excludeColumns={EXCLUDE_COLUMNS}
            baseUrl={`/uzytkownicy/${id}`}
            filters={{
              cashRegisters: cashRegisters.map((c) => ({ id: c.id, name: c.name })),
              investments: activeInvestments.map((i) => ({ id: i.id, name: i.name })),
            }}
            className="mt-4"
          />
        </Suspense>
      </CollapsibleSection>
    </PageWrapper>
  )
}
