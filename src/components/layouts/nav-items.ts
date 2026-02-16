import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, Building2, Wallet, Users, Receipt } from 'lucide-react'

export type NavItemT = {
  readonly label: string
  readonly href: string
  readonly icon: LucideIcon
  readonly roles: 'all' | 'management'
}

export const NAV_ITEMS: readonly NavItemT[] = [
  { label: 'Kokpit', href: '/', icon: LayoutDashboard, roles: 'all' },
  { label: 'Inwestycje', href: '/inwestycje', icon: Building2, roles: 'management' },
  { label: 'Kasa', href: '/kasa', icon: Wallet, roles: 'management' },
  { label: 'Użytkownicy', href: '/uzytkownicy', icon: Users, roles: 'management' },
  { label: 'Rozliczenia', href: '/rozliczenia', icon: Receipt, roles: 'management' },
] as const
