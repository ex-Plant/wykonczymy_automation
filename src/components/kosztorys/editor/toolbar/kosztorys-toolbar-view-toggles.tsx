'use client'

import { ToolbarToggle } from '@/components/ui/toolbar-toggle'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import {
  VIEWS,
  VIEW_LEGEND,
} from '@/components/kosztorys/editor/toolbar/kosztorys-view-axis-options'

export function KosztorysToolbarViewToggles() {
  const { view, setView } = useKosztorysEditorContext()

  return (
    <ToolbarToggle
      legend={VIEW_LEGEND}
      options={VIEWS}
      value={view}
      onChange={setView}
      aria-label="Widok cen"
    />
  )
}
