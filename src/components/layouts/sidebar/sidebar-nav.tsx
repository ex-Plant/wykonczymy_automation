'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  Wallet,
  ArrowLeftRight,
  Users,
  Receipt,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { isManagementRole } from '@/lib/auth/permissions'
import type { RoleT } from '@/collections/users'
import { SidebarUser } from './sidebar-user'

type SidebarNavPropsT = {
  user: {
    name: string
    email: string
    role: RoleT
  }
  action?: ReactNode
}

const NAV_ITEMS = [
  { label: 'Kokpit', href: '/', icon: LayoutDashboard, roles: 'all' as const },
  { label: 'Transakcje', href: '/transakcje', icon: ArrowLeftRight, roles: 'all' as const },
  { label: 'Inwestycje', href: '/inwestycje', icon: Building2, roles: 'management' as const },
  { label: 'Kasa', href: '/kasa', icon: Wallet, roles: 'management' as const },
  { label: 'Użytkownicy', href: '/uzytkownicy', icon: Users, roles: 'management' as const },
  { label: 'Rozliczenia', href: '/rozliczenia', icon: Receipt, roles: 'management' as const },
]

export function SidebarNav({ user, action }: SidebarNavPropsT) {
  const pathname = usePathname()
  const isManager = isManagementRole(user.role)

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles === 'all' || (item.roles === 'management' && isManager),
  )

  return (
    <aside className="border-border bg-background sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r">
      {/* App name */}
      <div className="flex h-14 items-center px-4">
        <span className="text-lg font-semibold">Wykonczymy</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {visibleItems.map(({ label, href, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Quick action slot */}
      {action && <div className="px-3 pb-2">{action}</div>}

      <SidebarUser user={user} />
    </aside>
  )
}
