'use client'

import { useTransition } from 'react'
import { LogOut } from 'lucide-react'
import { getInitials } from '@/lib/get-initials'
import { logoutAction } from '@/lib/actions/auth'
import { ROLE_LABELS, type RoleT } from '@/lib/auth/roles'

type SidebarUserPropsT = {
  user: {
    name: string
    email: string
    role: RoleT
  }
}

export function SidebarUser({ user }: SidebarUserPropsT) {
  const [isPending, startTransition] = useTransition()

  const handleLogout = () => {
    startTransition(() => logoutAction())
  }

  return (
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
  )
}
