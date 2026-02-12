import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { formatPLN } from '@/lib/format-currency'
import { ROLE_LABELS, type RoleT } from '@/collections/users'
import {
  TRANSACTION_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  type TransactionTypeT,
  type PaymentMethodT,
} from '@/lib/constants/transactions'

type PagePropsT = {
  params: Promise<{ id: string }>
}

export default async function UserDetailPage({ params }: PagePropsT) {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const { id } = await params
  const payload = await getPayload({ config })

  let targetUser
  try {
    targetUser = await payload.findByID({ collection: 'users', id })
  } catch {
    notFound()
  }

  if (!targetUser) notFound()

  // Compute saldo: advances - expenses for this worker
  const [advances, expenses, transactions] = await Promise.all([
    payload.find({
      collection: 'transactions',
      where: { worker: { equals: id }, type: { equals: 'ADVANCE' } },
      limit: 0,
      depth: 0,
    }),
    payload.find({
      collection: 'transactions',
      where: { worker: { equals: id }, type: { equals: 'EMPLOYEE_EXPENSE' } },
      limit: 0,
      depth: 0,
    }),
    payload.find({
      collection: 'transactions',
      where: { worker: { equals: id } },
      sort: '-date',
      depth: 1,
      limit: 50,
    }),
  ])

  // Fetch all matching docs to sum amounts
  const [allAdvances, allExpenses] = await Promise.all([
    payload.find({
      collection: 'transactions',
      where: { worker: { equals: id }, type: { equals: 'ADVANCE' } },
      limit: advances.totalDocs || 1000,
      depth: 0,
    }),
    payload.find({
      collection: 'transactions',
      where: { worker: { equals: id }, type: { equals: 'EMPLOYEE_EXPENSE' } },
      limit: expenses.totalDocs || 1000,
      depth: 0,
    }),
  ])

  const advancesSum = allAdvances.docs.reduce((sum, tx) => sum + tx.amount, 0)
  const expensesSum = allExpenses.docs.reduce((sum, tx) => sum + tx.amount, 0)
  const saldo = advancesSum - expensesSum

  return (
    <div className="p-6 lg:p-8">
      <Link href="/uzytkownicy" className="text-muted-foreground hover:text-foreground text-sm">
        &larr; Użytkownicy
      </Link>

      <h1 className="text-foreground mt-2 text-2xl font-semibold">{targetUser.name}</h1>

      {/* Info section */}
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground font-medium">Email</dt>
        <dd className="text-foreground">{targetUser.email}</dd>
        <dt className="text-muted-foreground font-medium">Rola</dt>
        <dd className="text-foreground">{ROLE_LABELS[targetUser.role as RoleT]?.pl ?? targetUser.role}</dd>
      </dl>

      {/* Stat card */}
      <div className="bg-muted/50 border-border mt-6 inline-block rounded-lg border px-6 py-4">
        <p className="text-muted-foreground text-xs font-medium">Saldo</p>
        <p className="text-foreground text-xl font-semibold">{formatPLN(saldo)}</p>
      </div>

      {/* Transactions table */}
      <h2 className="text-foreground mt-8 text-lg font-semibold">Transakcje</h2>
      <div className="mt-4">
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border bg-muted/50 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Opis</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Kwota</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Typ</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Metoda</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Data</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Kasa</th>
              </tr>
            </thead>
            <tbody>
              {transactions.docs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted-foreground px-4 py-8 text-center">
                    Brak transakcji
                  </td>
                </tr>
              ) : (
                transactions.docs.map((tx) => (
                  <tr key={tx.id} className="border-border border-b last:border-b-0">
                    <td className="text-foreground px-4 py-3">{tx.description}</td>
                    <td className="text-foreground px-4 py-3 text-right font-medium">
                      {formatPLN(tx.amount)}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {TRANSACTION_TYPE_LABELS[tx.type as TransactionTypeT] ?? tx.type}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {PAYMENT_METHOD_LABELS[tx.paymentMethod as PaymentMethodT] ?? tx.paymentMethod}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {new Date(tx.date).toLocaleDateString('pl-PL', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {typeof tx.cashRegister === 'object' && tx.cashRegister !== null
                        ? tx.cashRegister.name
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
