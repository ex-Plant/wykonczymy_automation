import { type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

// Single source of truth for header text sizing — every column header (plain, sort-menu, stage
// dropdown) renders its label through this so a size change never has to be repeated per header.
export function HeaderLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('text-xs font-medium', className)}>{children}</span>
}
