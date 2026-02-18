import { formatPLN } from '@/lib/format-currency'
import { parsePagination } from '@/lib/pagination'
import {
  findTransactionsRaw,
  buildTransactionFilters,
  countRecentTransactions,
} from '@/lib/queries/transactions'
import { findAllCashRegistersRaw, mapCashRegisterRows } from '@/lib/queries/cash-registers'
import { findActiveInvestments, findAllInvestments } from '@/lib/queries/investments'
import { findAllUsersWithSaldos } from '@/lib/queries/users'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { fetchMediaByIds } from '@/lib/queries/media'
import {
  mapTransactionRow,
  extractInvoiceIds,
  buildTransactionLookups,
} from '@/lib/tables/transactions'
import { DashboardTables } from '@/components/dashboard/dashboard-tables'
import { TransactionDataTable } from '@/components/transactions/transaction-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { SectionHeader } from '@/components/ui/section-header'
import { StatCard } from '@/components/ui/stat-card'
import { SyncBalancesButton } from '@/components/dashboard/sync-balances-button'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'

type ManagerDashboardPropsT = {
  searchParams: Record<string, string | string[] | undefined>
}

export async function ManagerDashboard({ searchParams }: ManagerDashboardPropsT) {
  const { page, limit } = parsePagination(searchParams)

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sinceDate = thirtyDaysAgo.toISOString().split('T')[0]

  // Phase 1: all depth:0 queries in parallel
  const [
    rawCashRegisters,
    activeInvestments,
    allInvestments,
    users,
    rawTxResult,
    recentCount,
    refData,
  ] = await Promise.all([
    findAllCashRegistersRaw(),
    findActiveInvestments(),
    findAllInvestments(),
    findAllUsersWithSaldos(),
    findTransactionsRaw({
      where: buildTransactionFilters(searchParams, { id: 0, isManager: true }),
      page,
      limit,
    }),
    countRecentTransactions(sinceDate),
    fetchReferenceData(),
  ])

  // Phase 2: batch-fetch media for invoices
  const invoiceIds = extractInvoiceIds(rawTxResult.docs)
  const mediaMap = await fetchMediaByIds(invoiceIds)

  // Phase 3: pure mapping
  const workersMap = new Map(refData.workers.map((w) => [w.id, w.name]))
  const cashRegisters = mapCashRegisterRows(rawCashRegisters, workersMap)
  const lookups = buildTransactionLookups(refData, mediaMap)
  const rows = rawTxResult.docs.map((doc) => mapTransactionRow(doc, lookups))
  const paginationMeta = rawTxResult.paginationMeta

  const totalBalance = cashRegisters.reduce((sum, cr) => sum + cr.balance, 0)
  const user = await getCurrentUserJwt()
  const isAdmin = user?.role === 'ADMIN'

  return (
    <PageWrapper title="Kokpit">
      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Saldo kas" value={formatPLN(totalBalance)} />
        <StatCard label="Aktywne inwestycje" value={String(activeInvestments.length)} />
        <StatCard label="Transakcje (30 dni)" value={String(recentCount)} />
      </div>

      {/* Admin tools */}
      {isAdmin && (
        <div className="mt-4 flex justify-end">
          <SyncBalancesButton />
        </div>
      )}

      {/* Cash registers & Users */}
      <DashboardTables cashRegisters={cashRegisters} investments={allInvestments} users={users} />

      {/* Recent transactions */}
      <div className="mt-8">
        <SectionHeader>Ostatnie transakcje</SectionHeader>
        <div className="mt-4">
          <TransactionDataTable
            data={rows}
            paginationMeta={paginationMeta}
            baseUrl="/"
            filters={{
              cashRegisters: cashRegisters.map((c) => ({ id: c.id, name: c.name })),
              investments: activeInvestments.map((i) => ({ id: i.id, name: i.name })),
            }}
          />
        </div>
      </div>
    </PageWrapper>
  )
}
