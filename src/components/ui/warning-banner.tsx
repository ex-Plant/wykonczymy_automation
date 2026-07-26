import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

// The panel's scream affordance: a bordered destructive one-liner the owner can't scroll past.
// Shared so a second warning can't drift from the first in colour, icon, or weight.
export function WarningBanner({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      role="alert"
      className={cn(
        'border-destructive text-destructive flex items-start gap-2 rounded border-2 px-2 py-1.5 text-xs font-semibold',
        className,
      )}
    >
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}
