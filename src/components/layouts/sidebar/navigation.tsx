import { unstable_cache } from 'next/cache'
import type { RoleT } from '@/lib/auth/roles'
import { isManagementRole } from '@/lib/auth/permissions'
import { getUserCashRegisterIds } from '@/lib/auth/get-user-cash-registers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { SidebarNav } from './sidebar-nav'
import { MobileNav } from '@/components/layouts/mobile-nav'
import { AddTransactionDialog } from '@/components/transactions/add-transaction-dialog'
import { CACHE_TAGS } from '@/lib/cache/tags'

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
          referenceData ? (
            <AddTransactionDialog
              referenceData={referenceData}
              managerCashRegisterId={managerCashRegisterId}
            />
          ) : undefined
        }
      />
      <MobileNav user={user} referenceData={referenceData} />
    </>
  )
}

const fetchReferenceData = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const [cashRegisters, investments, workers, otherCategories] = await Promise.all([
      payload.find({ collection: 'cash-registers', pagination: false }),
      payload.find({
        collection: 'investments',
        where: { status: { equals: 'active' } },
        pagination: false,
      }),
      payload.find({ collection: 'users', pagination: false }),
      payload.find({ collection: 'other-categories', pagination: false }),
    ])
    return {
      cashRegisters: cashRegisters.docs.map((d) => ({ id: d.id, name: d.name })),
      investments: investments.docs.map((d) => ({ id: d.id, name: d.name })),
      workers: workers.docs.map((d) => ({ id: d.id, name: d.name })),
      otherCategories: otherCategories.docs.map((d) => ({ id: d.id, name: d.name })),
    }
  },
  ['reference-data'],
  {
    tags: [
      CACHE_TAGS.cashRegisters,
      CACHE_TAGS.investments,
      CACHE_TAGS.users,
      CACHE_TAGS.otherCategories,
    ],
  },
)
