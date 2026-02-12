import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { formatPLN } from '@/lib/format-currency'
import { ROLE_LABELS, type RoleT } from '@/collections/users'

export default async function UsersPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const payload = await getPayload({ config })

  const [users, advances, expenses] = await Promise.all([
    payload.find({ collection: 'users', sort: 'name', limit: 100 }),
    payload.find({
      collection: 'transactions',
      where: { type: { equals: 'ADVANCE' } },
      limit: 0,
      depth: 0,
    }),
    payload.find({
      collection: 'transactions',
      where: { type: { equals: 'EMPLOYEE_EXPENSE' } },
      limit: 0,
      depth: 0,
    }),
  ])

  // Re-fetch with all docs to compute saldo (limit:0 returns totalDocs only)
  const [allAdvances, allExpenses] = await Promise.all([
    payload.find({
      collection: 'transactions',
      where: { type: { equals: 'ADVANCE' } },
      limit: advances.totalDocs || 1000,
      depth: 0,
    }),
    payload.find({
      collection: 'transactions',
      where: { type: { equals: 'EMPLOYEE_EXPENSE' } },
      limit: expenses.totalDocs || 1000,
      depth: 0,
    }),
  ])

  // Group advances by worker ID
  const advancesByWorker = new Map<number, number>()
  for (const tx of allAdvances.docs) {
    const workerId = typeof tx.worker === 'object' && tx.worker !== null ? tx.worker.id : tx.worker
    if (typeof workerId === 'number') {
      advancesByWorker.set(workerId, (advancesByWorker.get(workerId) ?? 0) + tx.amount)
    }
  }

  // Group expenses by worker ID
  const expensesByWorker = new Map<number, number>()
  for (const tx of allExpenses.docs) {
    const workerId = typeof tx.worker === 'object' && tx.worker !== null ? tx.worker.id : tx.worker
    if (typeof workerId === 'number') {
      expensesByWorker.set(workerId, (expensesByWorker.get(workerId) ?? 0) + tx.amount)
    }
  }

  const computeSaldo = (userId: number) =>
    (advancesByWorker.get(userId) ?? 0) - (expensesByWorker.get(userId) ?? 0)

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-foreground text-2xl font-semibold">Użytkownicy</h1>

      <div className="mt-6">
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border bg-muted/50 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Imię</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Email</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Rola</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {users.docs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted-foreground px-4 py-8 text-center">
                    Brak użytkowników
                  </td>
                </tr>
              ) : (
                users.docs.map((u) => (
                  <tr key={u.id} className="border-border border-b last:border-b-0">
                    <td className="text-foreground px-4 py-3">
                      <Link href={`/uzytkownicy/${u.id}`} className="hover:underline">
                        {u.name}
                      </Link>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">{u.email}</td>
                    <td className="text-muted-foreground px-4 py-3">
                      {ROLE_LABELS[u.role as RoleT]?.pl ?? u.role}
                    </td>
                    <td className="text-foreground px-4 py-3 text-right font-medium">
                      {formatPLN(computeSaldo(u.id))}
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
