'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Menu } from 'lucide-react'
import { cn } from '@/lib/cn'
import { isManagementRole } from '@/lib/auth/permissions'
import type { RoleT } from '@/collections/users'
import type { ReferenceDataT } from '@/components/transactions/add-transaction-dialog'
import { AddTransactionDialog } from '@/components/transactions/add-transaction-dialog'
import { NAV_ITEMS } from '@/components/layouts/nav-items'
import { logoutAction } from '@/lib/auth/actions'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet'

type MobileNavPropsT = {
  user: { name: string; email: string; role: RoleT }
  referenceData?: ReferenceDataT
}

export function MobileNav({ user, referenceData }: MobileNavPropsT) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const isManager = isManagementRole(user.role)

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles === 'all' || (item.roles === 'management' && isManager),
  )

  function handleLogout() {
    startTransition(() => logoutAction())
  }

  return (
    <header className="border-border bg-background sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b px-3 md:hidden">
      {/* Left: hamburger */}
      <button
        onClick={() => setIsOpen(true)}
        className="text-foreground hover:bg-accent rounded-md p-2.5 transition-colors"
        aria-label="Menu"
      >
        <Menu className="size-5" />
      </button>

      {/* Right: add transaction button */}
      {referenceData && <AddTransactionDialog referenceData={referenceData} />}

      {/* Sheet drawer */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="border-border border-b px-4 py-4">
            <SheetTitle>Wykonczymy</SheetTitle>
          </SheetHeader>

          <nav className="flex-1 space-y-1 px-3 py-2">
            {visibleItems.map(({ label, href, icon: Icon }) => {
              const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)

              return (
                <SheetClose asChild key={href}>
                  <Link
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
                </SheetClose>
              )
            })}
          </nav>

          <div className="border-border mt-auto border-t p-3">
            <button
              onClick={handleLogout}
              disabled={isPending}
              className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors disabled:opacity-50"
            >
              <LogOut className="size-4" />
              Wyloguj
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
