import type { RoleT } from '@/collections/users'
import { isManagementRole } from '@/lib/auth/permissions'
import { getPayload } from 'payload'
import config from '@payload-config'
import { SidebarNav } from './sidebar-nav'
import { AddTransactionDialog } from '@/components/transactions/add-transaction-dialog'

type SidebarPropsT = {
  user: {
    name: string
    email: string
    role: RoleT
  }
}

export async function Sidebar({ user }: SidebarPropsT) {
  const isManager = isManagementRole(user.role)

  if (!isManager) {
    return <SidebarNav user={user} />
  }

  const payload = await getPayload({ config })
  const [cashRegisters, investments, workers, otherCategories] = await Promise.all([
    payload.find({ collection: 'cash-registers', limit: 100 }),
    payload.find({
      collection: 'investments',
      where: { status: { equals: 'active' } },
      limit: 100,
    }),
    payload.find({ collection: 'users', limit: 100 }),
    payload.find({ collection: 'other-categories', limit: 100 }),
  ])

  const referenceData = {
    cashRegisters: cashRegisters.docs.map((d) => ({ id: d.id, name: d.name })),
    investments: investments.docs.map((d) => ({ id: d.id, name: d.name })),
    workers: workers.docs.map((d) => ({ id: d.id, name: d.name })),
    otherCategories: otherCategories.docs.map((d) => ({ id: d.id, name: d.name })),
  }

  return <SidebarNav user={user} action={<AddTransactionDialog referenceData={referenceData} />} />
}
