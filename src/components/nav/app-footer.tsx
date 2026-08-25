'use client'

import { useTransition } from 'react'
import { LogOut, Shield } from 'lucide-react'
import Link from 'next/link'
import { logoutAction } from '@/lib/actions/auth'
import { ROLE_LABELS } from '@/lib/auth/roles'
import { useCurrentUser } from '@/hooks/use-current-user'
import { RoleBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export function AppFooter() {
  const user = useCurrentUser()
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleLogout = () => {
    startTransition(() => logoutAction())
  }

  // h-14 is load-bearing, not cosmetic: the kosztorys editor subtracts this exact height from the
  // viewport below `lg`, where this footer renders. Change one, change the other.
  return (
    <footer className="border-border bg-background flex h-14 items-center border-t px-3 lg:hidden">
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-foreground text-sm font-medium">{user.name}</span>
          <RoleBadge role={user.role}>{ROLE_LABELS[user.role].pl}</RoleBadge>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild aria-label="Panel administracyjny">
            {/* Relative, like the sidebar's twin. Built off FRONTEND_URL it was absolute, and that
                is ONE value for the whole project — so on staging and on every preview this button
                opened the production Payload panel, which writes to the live database. */}
            <Link href="/admin" target="_blank" aria-label="Panel administracyjny">
              <Shield />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          </Button>
          <Button
            onMouseEnter={() => router.prefetch('/zaloguj')}
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={isPending}
            aria-label="Wyloguj"
          >
            <LogOut />
            <span className="hidden sm:inline">Wyloguj</span>
          </Button>
        </div>
      </div>
    </footer>
  )
}
