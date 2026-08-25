'use client'

import { MoreHorizontal } from 'lucide-react'

import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils/cn'

// The body-cell twin of HeaderMenuTrigger: it fills its whole grid cell so the click target matches
// what the user sees as "the Akcje cell", while the visible chrome sits on an inner span — which is
// what keeps the hover/open highlight the size of a button rather than the size of the cell.
// `className` restyles the trigger without shrinking that target — the section band tints its ⋯ with
// the section's hue, so it can't just take the plain `text-foreground` the row menu wants.
export function CellMenuTrigger({ title, className }: { title: string; className?: string }) {
  return (
    <DropdownMenuTrigger
      title={title}
      className={cn(
        'group flex size-full cursor-pointer items-center justify-center outline-none',
        className,
      )}
    >
      <span className="text-foreground group-hover:bg-accent group-hover:text-accent-foreground group-data-[state=open]:bg-accent flex size-6 items-center justify-center rounded-md transition-colors">
        <MoreHorizontal className="size-3.5" />
      </span>
    </DropdownMenuTrigger>
  )
}
