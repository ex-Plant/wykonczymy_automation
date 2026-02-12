import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { formatPLN } from '@/lib/format-currency'

export default async function CashRegistersPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const payload = await getPayload({ config })

  const cashRegisters = await payload.find({
    collection: 'cash-registers',
    sort: 'name',
    limit: 100,
    depth: 1,
  })

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-foreground text-2xl font-semibold">Kasy</h1>

      <div className="mt-6">
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border bg-muted/50 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Nazwa</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                  Właściciel
                </th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {cashRegisters.docs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-muted-foreground px-4 py-8 text-center">
                    Brak kas
                  </td>
                </tr>
              ) : (
                cashRegisters.docs.map((cr) => (
                  <tr key={cr.id} className="border-border border-b last:border-b-0">
                    <td className="text-foreground px-4 py-3">
                      <Link href={`/kasa/${cr.id}`} className="hover:underline">
                        {cr.name}
                      </Link>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {typeof cr.owner === 'object' && cr.owner !== null ? cr.owner.name : '—'}
                    </td>
                    <td className="text-foreground px-4 py-3 text-right font-medium">
                      {formatPLN(cr.balance ?? 0)}
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
