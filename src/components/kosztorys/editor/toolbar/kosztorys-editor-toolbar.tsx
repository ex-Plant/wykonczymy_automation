'use client'

import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CountBadge } from '@/components/ui/count-badge'
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
import { KosztorysFiltersMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { ROW_CONDITIONS } from '@/lib/kosztorys/row-conditions'

export function KosztorysEditorToolbar() {
  const {
    search,
    setSearch,
    view,
    setView,
    engagedConditionIds,
    toggleCondition,
    conditionCounts,
  } = useKosztorysEditorContext()
  const diagnostics = ROW_CONDITIONS.filter((condition) => condition.kind === 'diagnostic')

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
        {/* A diagnostic is a defect, so its button is absent — not disabled — at zero: once nothing
            is in that state there is nothing to look at, and a permanent dead control would suggest
            otherwise. The working filters live in the „Sekcje" menu instead; these sit in the
            toolbar because they are meant to be noticed without opening anything. */}
        {diagnostics.map((condition) => {
          const count = conditionCounts.get(condition.id) ?? 0
          if (count === 0) return null
          const active = engagedConditionIds.has(condition.id)

          return (
            <SimpleTooltip key={condition.id} content={`Pokaż tylko pozycje ${condition.label}`}>
              <Button
                variant={active ? 'secondary' : 'outline'}
                size="sm"
                aria-pressed={active}
                onClick={() => toggleCondition(condition.id)}
              >
                <TriangleAlert className="text-destructive" />
                {condition.label}
                <CountBadge count={count} />
              </Button>
            </SimpleTooltip>
          )
        })}
        <div className="ml-auto flex items-center gap-1">
          <KosztorysActionsMenu />
          <KosztorysFiltersMenu />
          <KosztorysViewMenu />
        </div>
      </div>
    </div>
  )
}
