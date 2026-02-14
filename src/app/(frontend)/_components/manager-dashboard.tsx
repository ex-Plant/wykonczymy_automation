import { getPayload } from 'payload'
import config from '@payload-config'
import { formatPLN } from '@/lib/format-currency'
import { mapTransactionRow } from '@/lib/transactions/map-transaction-row'
import { TransactionDataTable } from '@/components/transactions/transaction-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { StatCard } from '@/components/ui/stat-card'

const DEFAULT_LIMIT = 20
const ALLOWED_LIMITS = [20, 50, 100]

type ManagerDashboardPropsT = {
  searchParams: Record<string, string | string[] | undefined>
}

export async function ManagerDashboard({ searchParams }: ManagerDashboardPropsT) {
  const payload = await getPayload({ config })

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const pageParam = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1
  const currentPage = pageParam > 0 ? pageParam : 1

  const limitParam =
    typeof searchParams.limit === 'string' ? Number(searchParams.limit) : DEFAULT_LIMIT
  const limit = ALLOWED_LIMITS.includes(limitParam) ? limitParam : DEFAULT_LIMIT

  const [cashRegisters, investments, recentTransactions, transactionsLast30Days] =
    await Promise.all([
      payload.find({ collection: 'cash-registers', pagination: false }),
      payload.find({ collection: 'investments', pagination: false }),
      payload.find({
        collection: 'transactions',
        sort: '-date',
        depth: 1,
        limit,
        page: currentPage,
      }),
      payload.find({
        collection: 'transactions',
        limit: 0,
        where: { date: { greater_than_equal: thirtyDaysAgo.toISOString() } },
      }),
    ])

  const totalBalance = cashRegisters.docs.reduce((sum, cr) => sum + (cr.balance ?? 0), 0)
  const activeInvestments = investments.docs.filter((inv) => inv.status === 'active').length
  const recentCount = transactionsLast30Days.totalDocs
  const rows = recentTransactions.docs.map(mapTransactionRow)

  const paginationMeta = {
    currentPage: recentTransactions.page ?? 1,
    totalPages: recentTransactions.totalPages,
    totalDocs: recentTransactions.totalDocs,
    limit,
  }

  return (
    <PageWrapper title="Kokpit">
      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Saldo kas" value={formatPLN(totalBalance)} />
        <StatCard label="Aktywne inwestycje" value={String(activeInvestments)} />
        <StatCard label="Transakcje (30 dni)" value={String(recentCount)} />
      </div>

      {/* Recent transactions */}
      <div className="mt-8">
        <h2 className="text-foreground text-lg font-medium">Ostatnie transakcje</h2>
        <div className="mt-4">
          <TransactionDataTable data={rows} paginationMeta={paginationMeta} baseUrl="/" />
        </div>
      </div>
    </PageWrapper>
  )
}
