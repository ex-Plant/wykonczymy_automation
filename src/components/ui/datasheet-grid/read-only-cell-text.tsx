import type { ReactNode, Ref } from 'react'
import { cn } from '@/lib/utils/cn'

// `muted` covers the derived-value case: a subcontractor cell showing a value it isn't editable in
// this mode. `danger` flags a figure that's out of bounds (e.g. more executed than offered) — it
// overrides `muted` when both are set, since a cell is never muted AND alarming at once.
// Width-only, never `size-full` — .dsg-cell centres its children via flex, and a 100%-height span
// defeats that, top-aligning the text while the editable cells' inputs still centre theirs.
export function ReadOnlyCellText({
  children,
  muted,
  danger,
  emphasize,
  className,
  ref,
}: {
  children: ReactNode
  muted?: boolean
  danger?: boolean
  emphasize?: boolean
  className?: string
  // Truncation is only observable from the DOM (`scrollWidth > clientWidth`), so a caller that has
  // to react to it — the read-only long-text cell — needs the node this span renders.
  ref?: Ref<HTMLSpanElement>
}) {
  return (
    <span
      ref={ref}
      className={cn(
        'block w-full truncate px-2 text-left text-sm',
        muted && 'text-muted-foreground',
        danger && 'text-destructive',
        emphasize && 'font-medium',
        className,
      )}
    >
      {children}
    </span>
  )
}
