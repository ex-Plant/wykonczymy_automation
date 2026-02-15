import type { RoleT } from '@/lib/auth/roles'
import { isManagementRole } from '@/lib/auth/permissions'
import { getUserCashRegisterIds } from '@/lib/auth/get-user-cash-registers'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { SidebarNav } from './sidebar-nav'
import { MobileNav } from '@/components/layouts/mobile-nav'
import { AddTransactionDialog } from '@/components/transactions/add-transaction-dialog'

type NavigationPropsT = {
  user: {
    id: number
    name: string
    email: string
    role: RoleT
  }
}

export async function Navigation({ user }: NavigationPropsT) {
  const isManager = isManagementRole(user.role)

  const [referenceData, managerRegisterIds] = await Promise.all([
    isManager ? fetchReferenceData() : undefined,
    getUserCashRegisterIds(user.id, user.role),
  ])

  const managerCashRegisterId = managerRegisterIds?.[0]

  return (
    <>
      <SidebarNav
        user={user}
        action={
          <AddTransactionDialog
            referenceData={referenceData}
            managerCashRegisterId={managerCashRegisterId}
          />
        }
      />
      <MobileNav user={user} referenceData={referenceData} />
    </>
  )
}
