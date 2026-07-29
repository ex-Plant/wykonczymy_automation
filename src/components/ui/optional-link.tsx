import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

type OptionalLinkPropsT = {
  href: string | null | undefined
  children: ReactNode
  className?: string
}

// Renders a `Link` when `href` resolves, otherwise the same children unlinked —
// for cells/labels whose target entity may be missing (deleted, unassigned, etc).
export function OptionalLink({ href, children, className }: OptionalLinkPropsT) {
  if (!href) return children
  return (
    <Link href={href} className={cn('hover:underline', className)}>
      {children}
    </Link>
  )
}
