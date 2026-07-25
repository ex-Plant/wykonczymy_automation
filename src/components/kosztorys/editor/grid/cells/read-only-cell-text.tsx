import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

// The disabled render for every custom-input cell in the read-only (clientView) grid: a plain
// left-aligned, truncated label where an editor would otherwise sit. Shared so the four custom cells
// can't drift on their read-only markup (they had before — one carried a stray alignment class).
// `muted` covers the derived-value case (a subcontractor cell showing a value it isn't editable in
// this mode) — same markup, just greyed to read as "not yours to type here".
export function ReadOnlyCellText({
  children,
  muted,
  className,
}: {
  children: ReactNode
  muted?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'block size-full truncate px-2 text-left text-sm',
        muted && 'text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}
