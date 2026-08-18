'use client'

import { Button } from '@/components/ui/button'
import { FilterChip } from '@/components/ui/filter-chip'
import {
  activeFiltersModel,
  type ActiveFilterChipT,
} from '@/components/kosztorys/editor/toolbar/active-filters-model'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { PROBLEM_IDS } from '@/lib/kosztorys/problem-conditions'

/**
 * What is hiding pozycje right now, on screen, each removable in one click.
 *
 * Before this the four sources — szukaj, „Filtry", „Problemy", zwinięte sekcje — were legible only
 * from inside the menu that set them, and only one at a time. A grid short for two reasons therefore
 * read as a grid short for whichever reason the reader happened to open, and the way back out was
 * three menus deep.
 *
 * Absent when nothing is engaged, not rendered empty: a permanent strip is a line of chrome the eye
 * learns to skip, and its whole job is to be noticed the moment something is on.
 *
 * One line with horizontal scroll rather than wrapping — a wrapping bar changes the grid's top edge
 * every Nth chip, and the grid's height is measured, not flowed (see the re-measure at
 * `use-kosztorys-editor`). One row keeps that to a single flip.
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
    <div className="flex items-center gap-2 overflow-x-auto px-4 pb-2">
      {chips.map((chip) => (
        <FilterChip
          key={chip.id}
          label={chip.label}
          count={chip.count}
          removeLabel={`Usuń: ${chip.label}`}
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
