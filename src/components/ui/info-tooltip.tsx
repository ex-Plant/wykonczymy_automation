'use client'

import { useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { HintTooltip } from '@/components/ui/tooltip'

type InfoTooltipPropsT = {
  content: ReactNode
  // Spoken to screen readers in place of the icon — describe what the tooltip explains.
  label?: string
  // Position the trigger relative to its sibling (e.g. 'ml-1').
  className?: string
}

// The (i)-icon flavor of HintTooltip: an icon that reveals `content` on hover, focus, or click.
export function InfoTooltip({
  content,
  label = 'Więcej informacji',
  className,
}: InfoTooltipPropsT) {
  const [open, setOpen] = useState(false)

  return (
    <HintTooltip
      content={content}
      open={open}
      onOpenChange={setOpen}
      className={cn('align-middle', className)}
    >
      <button
        type="button"
        aria-label={label}
        // Radix's own pointerdown handler *closes* the tooltip; preventDefault makes its
        // composeEventHandlers skip that handler, so a click toggles instead of dismissing. Without
        // it the hint is unreachable on touch, which has no hover to open it with.
        onPointerDown={(event) => {
          event.preventDefault()
          setOpen((wasOpen) => !wasOpen)
        }}
        className="text-muted-foreground hover:text-foreground inline-flex"
      >
        <Info className="size-3.5" />
      </button>
    </HintTooltip>
  )
}
