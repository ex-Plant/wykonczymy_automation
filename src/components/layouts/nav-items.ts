import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, Building2 } from 'lucide-react'

export type NavItemT = {
  readonly label: string
  readonly href: string
  readonly icon: LucideIcon
  readonly roles: 'all' | 'management'
}

export const NAV_ITEMS: readonly NavItemT[] = [
  { label: 'Kokpit', href: '/', icon: LayoutDashboard, roles: 'all' },
  { label: 'Inwestycje', href: '/inwestycje', icon: Building2, roles: 'management' },
] as const
