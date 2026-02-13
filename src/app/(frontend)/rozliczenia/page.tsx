import { getPayload } from 'payload'
import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { SettlementForm } from '@/components/settlements/settlement-form'
import { PageWrapper } from '@/components/ui/page-wrapper'

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
    <PageWrapper
      title="Rozliczenie pracownika"
      description='Dodaj pozycje z faktury — każda stanie się osobną transakcją typu "Wydatek pracowniczy".'
    >
      <SettlementForm referenceData={referenceData} className="mt-6" />
    </PageWrapper>
  )
}
