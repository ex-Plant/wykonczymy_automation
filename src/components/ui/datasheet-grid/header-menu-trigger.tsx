'use client'

import type * as React from 'react'

import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils/cn'

// The datasheet-grid header trigger: fills the header cell and carries the shared header look as its
// baked default, so no header re-declares it. `className` extends the default (active-sort emphasis,
// icon-only sizing). Kept separate from the generic DropdownMenuTrigger on purpose — that primitive
// also backs toolbar `<Button asChild>` triggers, which must not inherit grid-cell sizing.
export function HeaderMenuTrigger({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuTrigger>) {
  return (
    <DropdownMenuTrigger
      className={cn(
        'hover:bg-accent flex h-full w-full cursor-pointer items-center gap-2 rounded px-1 text-left font-medium outline-none',
        className,
      )}
      {...props}
    />
  )
}
