import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { formatPLN } from '@/lib/format-currency'

export default async function InvestmentsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const payload = await getPayload({ config })

  const investments = await payload.find({
    collection: 'investments',
    sort: 'name',
    limit: 100,
  })

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-foreground text-2xl font-semibold">Inwestycje</h1>

      <div className="mt-6">
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border bg-muted/50 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Nazwa</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Status</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Koszty</th>
              </tr>
            </thead>
            <tbody>
              {investments.docs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-muted-foreground px-4 py-8 text-center">
                    Brak inwestycji
                  </td>
                </tr>
              ) : (
                investments.docs.map((inv) => (
                  <tr key={inv.id} className="border-border border-b last:border-b-0">
                    <td className="text-foreground px-4 py-3">
                      <Link href={`/inwestycje/${inv.id}`} className="hover:underline">
                        {inv.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          inv.status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full px-2 py-0.5 text-xs font-medium'
                            : 'bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium'
                        }
                      >
                        {inv.status === 'active' ? 'Aktywna' : 'Zakończona'}
                      </span>
                    </td>
                    <td className="text-foreground px-4 py-3 text-right font-medium">
                      {formatPLN(inv.totalCosts ?? 0)}
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
