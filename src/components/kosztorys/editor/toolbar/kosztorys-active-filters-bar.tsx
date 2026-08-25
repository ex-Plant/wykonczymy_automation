'use client'

import { Button } from '@/components/ui/button'
import { FilterChip } from '@/components/filters/filter-chip'
import {
  activeFiltersModel,
  type ActiveFilterChipT,
} from '@/components/kosztorys/editor/toolbar/active-filters-model'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { PROBLEM_IDS } from '@/lib/kosztorys/problem-conditions'

/**
 * What is hiding pozycje right now, on screen, each removable in one click.
 *
 * Absent when nothing is engaged, not rendered empty: a permanent strip is a line of chrome the eye
 * learns to skip, and its whole job is to be noticed the moment something is on.
 *
 * Wraps rather than scrolling sideways: a chip past the right edge is a filter the reader does not
 * know is on, which is the whole thing this bar exists to stop. The grid's height is measured on
 * mount and window resize only, so extra rows push its bottom out of view — accepted (owner), since
 * a filter set is read at the top of the screen and a row or two of grid is the cheap half.
 */
export function KosztorysActiveFiltersBar() {
  const {
    engagedConditionIds,
    toggleCondition,
    toggleConditionExclusive,
    collapsedSectionIds,
    setCollapsedSectionIds,
    search,
    setSearch,
    resetFilters,
    conditionCounts,
  } = useKosztorysEditorContext()

  const chips = activeFiltersModel({
    engagedIds: engagedConditionIds,
    collapsedSectionCount: collapsedSectionIds.size,
    search,
    counts: conditionCounts,
  })

  if (chips.length === 0) return null

  // The model names WHAT to undo; the switching-off itself is per-source and lives here, next to the
  // handlers, so the model can stay React-free and testable.
  function remove(chip: ActiveFilterChipT) {
    switch (chip.removal) {
      case 'condition':
        return toggleCondition(chip.id)
      case 'problem':
        // Through the exclusive pick, the same call the „Problemy" list makes — it also hands the
        // plane back, so removing the chip returns the reader to the view the problem took them from.
        return toggleConditionExclusive(chip.id, PROBLEM_IDS)
      case 'sections':
        return setCollapsedSectionIds(new Set())
      case 'search':
        return setSearch('')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
      {chips.map((chip) => (
        <FilterChip
          key={chip.id}
          label={chip.label}
          count={chip.count}
          removeLabel={chip.removeLabel}
          onRemove={() => remove(chip)}
        />
      ))}
      {/* Last, and only worth offering beside two or more chips — with one on screen it would be a
          second button for what the X beside it already does. */}
      {chips.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={resetFilters}
          className="text-muted-foreground h-6 shrink-0 px-2 text-xs"
        >
          Wyczyść wszystko
        </Button>
      )}
    </div>
  )
}
