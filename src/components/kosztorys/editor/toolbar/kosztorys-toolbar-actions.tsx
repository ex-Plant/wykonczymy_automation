'use client'

import { KosztorysActionsMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu'
import { PanelToggleButton } from '@/components/kosztorys/editor/toolbar/panel-toggle-button'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

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

  return (
    <>
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
    </>
  )
}
