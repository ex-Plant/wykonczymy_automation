'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KosztorysActionsMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { useTotalsPanelOpen } from '@/components/kosztorys/summary/hooks/use-totals-panel-open'
import { cn } from '@/lib/utils/cn'

type PanelToggleButtonPropsT = {
  open: boolean
  onToggle: () => void
  children: ReactNode
}

// default variant has no border, outline does — keep the box identical so toggling doesn't shift
// the right-aligned neighbour by the border's width.
function PanelToggleButton({ open, onToggle, children }: PanelToggleButtonPropsT) {
  return (
    <Button
      size="sm"
      variant={open ? 'default' : 'outline'}
      className={cn(open && 'border border-transparent')}
      onClick={onToggle}
    >
      {children}
      <ChevronDown className={cn('transition-transform duration-200', open && 'rotate-180')} />
    </Button>
  )
}

export function KosztorysToolbarActions() {
  const {
    investmentId,
    onOpenVersions,
    summaryOpen,
    setSummaryOpen,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useKosztorysEditorContext()
  const [totalsOpen, setTotalsOpen] = useTotalsPanelOpen()

  return (
    <div className="ml-auto flex items-center gap-1">
      <KosztorysActionsMenu
        investmentId={investmentId}
        onOpenVersions={onOpenVersions}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
      <PanelToggleButton open={summaryOpen} onToggle={() => setSummaryOpen((o) => !o)}>
        Sekcje
      </PanelToggleButton>
      <PanelToggleButton open={totalsOpen} onToggle={() => setTotalsOpen(!totalsOpen)}>
        Podsumowanie
      </PanelToggleButton>
    </div>
  )
}
