import { getPayload } from 'payload'
import config from '@payload-config'
import { formatPLN } from '@/lib/format-currency'
import { TRANSACTION_TYPE_LABELS, type TransactionTypeT } from '@/lib/constants/transactions'

export async function ManagerDashboard() {
  const payload = await getPayload({ config })

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [cashRegisters, investments, recentTransactions, transactionsLast30Days] =
    await Promise.all([
      payload.find({ collection: 'cash-registers', limit: 100 }),
      payload.find({ collection: 'investments', limit: 100 }),
      payload.find({ collection: 'transactions', limit: 10, sort: '-date', depth: 1 }),
      payload.find({
        collection: 'transactions',
        limit: 0,
        where: { date: { greater_than_equal: thirtyDaysAgo.toISOString() } },
      }),
    ])

  const totalBalance = cashRegisters.docs.reduce((sum, cr) => sum + (cr.balance ?? 0), 0)
  const activeInvestments = investments.docs.filter((inv) => inv.status === 'active').length
  const recentCount = transactionsLast30Days.totalDocs

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
        <div className="border-border mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border bg-muted/50 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Opis</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Kwota</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Typ</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Data</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Kasa</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.docs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted-foreground px-4 py-8 text-center">
                    Brak transakcji
                  </td>
                </tr>
              ) : (
                recentTransactions.docs.map((tx) => {
                  const cashRegisterName =
                    typeof tx.cashRegister === 'object' && tx.cashRegister !== null
                      ? tx.cashRegister.name
                      : '—'

                  return (
                    <tr key={tx.id} className="border-border border-b last:border-b-0">
                      <td className="text-foreground px-4 py-3">{tx.description}</td>
                      <td className="text-foreground px-4 py-3 text-right font-medium">
                        {formatPLN(tx.amount)}
                      </td>
                      <td className="text-muted-foreground px-4 py-3">
                        {TRANSACTION_TYPE_LABELS[tx.type as TransactionTypeT] ?? tx.type}
                      </td>
                      <td className="text-muted-foreground px-4 py-3">
                        {tx.date
                          ? new Date(tx.date).toLocaleDateString('pl-PL', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="text-muted-foreground px-4 py-3">{cashRegisterName}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
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
