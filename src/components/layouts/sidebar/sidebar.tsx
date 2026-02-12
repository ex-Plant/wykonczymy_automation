'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTransition } from 'react'
import {
  LayoutDashboard,
  Building2,
  Wallet,
  ArrowLeftRight,
  Users,
  LogOut,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { getInitials } from '@/lib/get-initials'
import { logoutAction } from '@/lib/auth/actions'
import { ROLE_LABELS, type RoleT } from '@/collections/users'
import { isManagementRole } from '@/lib/auth/permissions'
import { Button } from '@/components/ui/button'

type SidebarPropsT = {
  user: {
    name: string
    email: string
    role: RoleT
  }
  onAddTransaction?: () => void
}

const NAV_ITEMS = [
  { label: 'Kokpit', href: '/', icon: LayoutDashboard, roles: 'all' as const },
  { label: 'Transakcje', href: '/transakcje', icon: ArrowLeftRight, roles: 'all' as const },
  { label: 'Inwestycje', href: '/inwestycje', icon: Building2, roles: 'management' as const },
  { label: 'Kasa', href: '/kasa', icon: Wallet, roles: 'management' as const },
  { label: 'Użytkownicy', href: '/uzytkownicy', icon: Users, roles: 'management' as const },
]

export function Sidebar({ user, onAddTransaction }: SidebarPropsT) {
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const isManager = isManagementRole(user.role)

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles === 'all' || (item.roles === 'management' && isManager),
  )

  const handleLogout = () => {
    startTransition(() => logoutAction())
  }

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

      {/* Quick action — management only */}
      {isManager && (
        <div className="px-3 pb-2">
          <Button variant="default" size="sm" className="w-full gap-2" onClick={onAddTransaction}>
            <Plus className="size-4" />
            Nowa transakcja
          </Button>
        </div>
      )}

      {/* User section */}
      <div className="border-border border-t p-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
            {getInitials(user.name)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-foreground truncate text-sm font-medium">{user.name}</span>
            <span className="text-muted-foreground truncate text-xs">
              {ROLE_LABELS[user.role].pl}
            </span>
          </div>
          <button
            onClick={handleLogout}
            disabled={isPending}
            className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-md p-1.5 transition-colors disabled:opacity-50"
            aria-label="Wyloguj"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
