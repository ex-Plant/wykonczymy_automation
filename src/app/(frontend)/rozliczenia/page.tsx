import { getPayload } from 'payload'
import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { SettlementForm } from '@/components/settlements/settlement-form'

export default async function SettlementsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const payload = await getPayload({ config })

  const [users, investments, cashRegisters] = await Promise.all([
    payload.find({ collection: 'users', limit: 100, depth: 0 }),
    payload.find({
      collection: 'investments',
      where: { status: { equals: 'active' } },
      limit: 100,
      depth: 0,
    }),
    payload.find({ collection: 'cash-registers', limit: 100, depth: 0 }),
  ])

  const referenceData = {
    users: users.docs.map((u) => ({ id: u.id, name: u.name })),
    investments: investments.docs.map((i) => ({ id: i.id, name: i.name })),
    cashRegisters: cashRegisters.docs.map((c) => ({ id: c.id, name: c.name })),
  }

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-foreground text-2xl font-semibold">Rozliczenie pracownika</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Dodaj pozycje z faktury — każda stanie się osobną transakcją typu &quot;Wydatek
        pracowniczy&quot;.
      </p>
      <div className="mt-6">
        <SettlementForm referenceData={referenceData} />
      </div>
    </div>
  )
}
