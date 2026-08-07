'use client'

import * as Collapsible from '@radix-ui/react-collapsible'
import { type ComponentProps } from 'react'
import { SummaryPanelContent } from '@/components/kosztorys/summary/summary-panel-content'
import { useTotalsPanelOpen } from '@/components/kosztorys/summary/hooks/use-totals-panel-open'

// Owns the overlay geometry, nothing of what is displayed — that all lives in SummaryPanelContent, so
// the investment page can mount the same content without inheriting the editor's bottom-anchored
// collapsible.
export function KosztorysTotalsPanel(props: ComponentProps<typeof SummaryPanelContent>) {
  const [open, setOpen] = useTotalsPanelOpen()

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      // The open/close animation lives on the ROOT's height (0 ↔ 100%), not on the Content's Radix
      // keyframes — those animate the measured natural content height, which disagrees with the
      // flex-stretched full height and made the close look two-phased. Content stays mounted
      // (forceMount) so it can't blink out mid-transition; visibility flips only once closed.
      // Collapsed it takes no height at all: with the toolbar owning the toggle, the panel has
      // nothing left to show down here, so the border and shadow go transparent too rather than
      // leaving a hairline ruled across the bottom of the grid.
      className="border-border bg-background text-foreground shadow-panel absolute inset-x-0 bottom-0 z-20 flex h-0 flex-col overflow-hidden border-t transition-[height] duration-200 ease-out data-[state=closed]:border-transparent data-[state=closed]:shadow-none data-[state=open]:h-full"
    >
      <Collapsible.Content
        forceMount
        className="flex min-h-0 flex-1 flex-col overflow-hidden transition-[visibility] duration-200 data-[state=closed]:invisible"
      >
        <SummaryPanelContent {...props} />
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
