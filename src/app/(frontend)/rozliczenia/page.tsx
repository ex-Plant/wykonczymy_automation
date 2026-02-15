import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { getUserCashRegisterIds } from '@/lib/auth/get-user-cash-registers'
import { findAllUsers } from '@/lib/queries/users'
import { findActiveInvestments } from '@/lib/queries/investments'
import { findAllCashRegisters } from '@/lib/queries/cash-registers'
import { SettlementForm } from '@/components/settlements/settlement-form'
import { PageWrapper } from '@/components/ui/page-wrapper'

export default async function SettlementsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const [users, investments, cashRegisters, managerRegisterIds] = await Promise.all([
    findAllUsers(),
    findActiveInvestments(),
    findAllCashRegisters(),
    getUserCashRegisterIds(user.id, user.role),
  ])

  const referenceData = {
    users: users.map(({ id, name }) => ({ id, name })),
    investments: investments.map(({ id, name }) => ({ id, name })),
    cashRegisters: cashRegisters.map(({ id, name }) => ({ id, name })),
  }

  return (
    <PageWrapper
      title="Rozliczenie pracownika"
      description='Dodaj pozycje z faktury — każda stanie się osobną transakcją typu "Wydatek pracowniczy".'
    >
      <SettlementForm
        referenceData={referenceData}
        managerCashRegisterId={managerRegisterIds?.[0]}
        className="mt-6"
      />
    </PageWrapper>
  )
}
