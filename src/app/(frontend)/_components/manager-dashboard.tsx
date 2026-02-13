import { getPayload } from 'payload'
import config from '@payload-config'
import { formatPLN } from '@/lib/format-currency'
import { mapTransactionRow } from '@/lib/transactions/map-transaction-row'
import { DashboardTransactionsTable } from './dashboard-transactions-table'

export async function ManagerDashboard() {
  const payload = await getPayload({ config })

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [cashRegisters, investments, recentTransactions, transactionsLast30Days] =
    await Promise.all([
      payload.find({ collection: 'cash-registers', limit: 100 }),
      payload.find({ collection: 'investments', limit: 100 }),
      payload.find({ collection: 'transactions', limit: 0, sort: '-date', depth: 1 }),
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

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-foreground text-2xl font-semibold">Kokpit</h1>

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
          <DashboardTransactionsTable data={rows} />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="text-foreground mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}
