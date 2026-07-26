'use client'

import { PanelToggleButton } from '@/components/kosztorys/editor/toolbar/panel-toggle-button'
import { useTotalsPanelOpen } from '@/components/kosztorys/summary/hooks/use-totals-panel-open'

export function KosztorysToolbarTotalsToggle() {
  const [totalsOpen, setTotalsOpen] = useTotalsPanelOpen()

  return (
    <PanelToggleButton open={totalsOpen} onToggle={() => setTotalsOpen(!totalsOpen)}>
      Podsumowanie
    </PanelToggleButton>
  )
}
