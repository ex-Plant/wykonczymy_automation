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
        // Touch has no hover, so without a click-toggle the hint is simply unreachable there. The
        // mechanism is indirect and worth stating: Radix's Trigger — the element HintTooltip wraps
        // this button in — closes the tooltip on pointerdown, and its composeEventHandlers skips
        // that once the event is `defaultPrevented`. So this preventDefault suppresses a handler
        // that lives on the PARENT, not here. Render the button as the Trigger itself (or drop the
        // wrapper) and touch access dies silently, with nothing in this file to explain why.
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
