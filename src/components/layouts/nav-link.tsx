'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

type NavLinkPropsT = {
  href: string
  label: string
  icon: LucideIcon
  size?: 'sm' | 'base'
  className?: string
  onClick?: () => void
}

export function NavLink({
  href,
  label,
  icon: Icon,
  size = 'sm',
  className,
  onClick,
}: NavLinkPropsT) {
  const pathname = usePathname()
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 transition-colors',
        size === 'base' ? 'py-3 text-base' : 'py-2 text-sm',
        isActive
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        className,
      )}
    >
      <Icon className={size === 'base' ? 'size-5' : 'size-4'} />
      {label}
    </Link>
  )
}
