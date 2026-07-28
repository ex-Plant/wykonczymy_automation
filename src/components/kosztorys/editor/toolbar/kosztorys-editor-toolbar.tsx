'use client'

import { SEARCH_FILTER_TOOLBAR_WIDTH, SearchFilterInput } from '@/components/ui/search-filter-input'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { KosztorysAddMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-add-menu'
import { KosztorysActionsMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu'
import { KosztorysTotalsPanelToggle } from '@/components/kosztorys/summary/kosztorys-totals-panel-toggle'
import { ToolbarToggle } from '@/components/ui/toolbar-toggle'
import {
  VIEWS,
  VIEW_LEGEND,
} from '@/components/kosztorys/editor/toolbar/kosztorys-view-axis-options'
import { KosztorysViewMenu } from '@/components/kosztorys/editor/toolbar/kosztorys-view-menu'
import { KosztorysSectionFilterMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-section-filter-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

export function KosztorysEditorToolbar() {
  const { search, setSearch, view, setView } = useKosztorysEditorContext()

  return (
    <div className="border-border shrink-0 border-b">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        <KosztorysTotalsPanelToggle />
        <ToolbarToggle
          legend={VIEW_LEGEND}
          options={VIEWS}
          value={view}
          onChange={setView}
          aria-label="Widok cen"
        />

        <KosztorysAddMenu />
        <SimpleTooltip content="Szukaj pozycji / sekcji">
          {/* SearchFilterInput takes no ref, so the tooltip anchors to a wrapper */}
          <div>
            <SearchFilterInput
              value={search}
              onChange={setSearch}
              placeholder="Szukaj…"
              debounceMs={200}
              className={SEARCH_FILTER_TOOLBAR_WIDTH}
            />
          </div>
        </SimpleTooltip>
        <div className="ml-auto flex items-center gap-1">
          <KosztorysActionsMenu />
          <KosztorysSectionFilterMenu />
          <KosztorysViewMenu />
        </div>
      </div>
    </div>
  )
}
