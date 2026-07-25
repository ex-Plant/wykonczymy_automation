import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

// `muted` covers the derived-value case: a subcontractor cell showing a value it isn't editable in
// this mode.
// Width-only, never `size-full` — .dsg-cell centres its children via flex, and a 100%-height span
// defeats that, top-aligning the text while the editable cells' inputs still centre theirs.
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
        'block w-full truncate px-2 text-left text-sm',
        muted && 'text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}
