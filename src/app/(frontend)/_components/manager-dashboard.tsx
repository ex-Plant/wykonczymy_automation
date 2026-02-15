import { formatPLN } from '@/lib/format-currency'
import { parsePagination } from '@/lib/pagination'
import { findTransactions, countRecentTransactions } from '@/lib/queries/transactions'
import { findAllCashRegisters } from '@/lib/queries/cash-registers'
import { findActiveInvestments } from '@/lib/queries/investments'
import { TransactionDataTable } from '@/components/transactions/transaction-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { SectionHeader } from '@/components/ui/section-header'
import { StatCard } from '@/components/ui/stat-card'

type ManagerDashboardPropsT = {
  searchParams: Record<string, string | string[] | undefined>
}

export async function ManagerDashboard({ searchParams }: ManagerDashboardPropsT) {
  const { page, limit } = parsePagination(searchParams)

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sinceDate = thirtyDaysAgo.toISOString().split('T')[0]

  const [cashRegisters, activeInvestments, { rows, paginationMeta }, recentCount] =
    await Promise.all([
      findAllCashRegisters(),
      findActiveInvestments(),
      findTransactions({ page, limit }),
      countRecentTransactions(sinceDate),
    ])

  const totalBalance = cashRegisters.reduce((sum, cr) => sum + cr.balance, 0)

  return (
    <PageWrapper title="Kokpit">
      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Saldo kas" value={formatPLN(totalBalance)} />
        <StatCard label="Aktywne inwestycje" value={String(activeInvestments.length)} />
        <StatCard label="Transakcje (30 dni)" value={String(recentCount)} />
      </div>

      {/* Recent transactions */}
      <div className="mt-8">
        <SectionHeader>Ostatnie transakcje</SectionHeader>
        <div className="mt-4">
          <TransactionDataTable data={rows} paginationMeta={paginationMeta} baseUrl="/" />
        </div>
      </div>
    </PageWrapper>
  )
}
