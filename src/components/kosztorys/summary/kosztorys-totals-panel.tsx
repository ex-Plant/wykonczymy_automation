'use client'

import * as Collapsible from '@radix-ui/react-collapsible'
import { useState, type ComponentProps } from 'react'
import { useSearchParams } from 'next/navigation'
import { SummaryPanelContent } from '@/components/kosztorys/summary/summary-panel-content'
import { useTotalsPanelOpen } from '@/components/kosztorys/summary/hooks/use-totals-panel-open'

// `?ustawienia=1` — the investment page's settings link lands here and needs the panel open with the
// settings block expanded. Deliberately NOT a localStorage write from the linking page: the panel's
// open state is a persisted *preference*, so writing it would make one click flip the reader's
// default for every future visit. This is a one-shot intent, so it stays in the URL.
const OPEN_SETTINGS_PARAM = 'ustawienia'

// The editor's host for the summary panel: a bottom-anchored collapsible overlay over the grid.
// Everything it shows lives in SummaryPanelContent — this file owns nothing but the overlay, so the
// investment page can mount the same content without inheriting the editor's geometry.
export function KosztorysTotalsPanel(props: ComponentProps<typeof SummaryPanelContent>) {
  const [open, setOpen] = useTotalsPanelOpen()
  // Seeded once rather than read every render, so the arrival override survives in the URL without
  // pinning the panel open — closing it clears the override and hands control back to the preference.
  const wantsSettings = useSearchParams().get(OPEN_SETTINGS_PARAM) === '1'
  const [forcedOpen, setForcedOpen] = useState(wantsSettings)

  return (
    <Collapsible.Root
      open={open || forcedOpen}
      onOpenChange={(next) => {
        setForcedOpen(false)
        setOpen(next)
      }}
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
        <SummaryPanelContent {...props} settingsDefaultOpen={wantsSettings} />
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
