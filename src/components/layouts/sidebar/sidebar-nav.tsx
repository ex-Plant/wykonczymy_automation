'use client'

import type { ReactNode } from 'react'
import { isManagementRole } from '@/lib/auth/permissions'
import type { RoleT } from '@/lib/auth/roles'
import { NAV_ITEMS } from '@/components/layouts/nav-items'
import { NavLink } from '@/components/layouts/nav-link'
import { SidebarUser } from './sidebar-user'

type SidebarNavPropsT = {
  user: {
    name: string
    email: string
    role: RoleT
  }
  action?: ReactNode
}

export function SidebarNav({ user, action }: SidebarNavPropsT) {
  const isManager = isManagementRole(user.role)

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles === 'all' || (item.roles === 'management' && isManager),
  )

  return (
    <aside className="border-border bg-background sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r md:flex">
      {/* App name */}
      <div className="flex h-14 items-center px-4">
        <span className="text-lg font-semibold">Wykonczymy</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {visibleItems.map(({ label, href, icon }) => (
          <NavLink key={href} href={href} label={label} icon={icon} />
        ))}
      </nav>

      {/* Quick action slot */}
      {action && <div className="space-y-2 px-3 pb-2 [&_button]:w-full">{action}</div>}

      <SidebarUser user={user} />
    </aside>
  )
}
