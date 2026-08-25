import { type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export function HeaderLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('text-xs font-medium', className)}>{children}</span>
}
