'use client'

import { ListFilter } from 'lucide-react'
import { FilterMultiSelect, FILTER_NONE } from '@/components/transfers/filter-multi-select'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { ROW_CONDITIONS } from '@/lib/kosztorys/row-conditions'

// One menu for „czego nie widzę", with the two mechanisms that answer it side by side: the toggles
// HIDE pozycje (a condition narrows the grid to the rows that match), the section list FOLDS whole
// sekcje under their band (which stays visible, with its total). Both are the same question asked at
// two granularities, so splitting them across two triggers would make the user check twice.
//
// The section half reuses the transfers FilterMultiSelect, whose URL encoding is
// [] = all / [FILTER_NONE] = none / [ids] = those — bridged here to collapsedSectionIds.
export function KosztorysFiltersMenu() {
  const {
    subtotals,
    collapsedSectionIds,
    setCollapsedSectionIds,
    foldableSectionIds,
    activeConditionIds,
    toggleCondition,
    conditionCounts,
  } = useKosztorysEditorContext()

  const options = subtotals.map((s) => ({ value: String(s.sectionId), label: s.sectionName }))

  const expanded = subtotals
    .filter((s) => !collapsedSectionIds.has(s.sectionId))
    .map((s) => String(s.sectionId))

  const values = expanded.length === 0 ? [FILTER_NONE] : expanded

  function onValuesChange(next: string[]) {
    // Collapse is stored positively, so the complement of the ticked set is what gets folded — a
    // section the menu never listed (added while it was open) is therefore left expanded.
    if (next.length === 0) return setCollapsedSectionIds(new Set())
    const keptOpen =
      next.length === 1 && next[0] === FILTER_NONE ? new Set<string>() : new Set(next)
    setCollapsedSectionIds(
      new Set(subtotals.filter((s) => !keptOpen.has(String(s.sectionId))).map((s) => s.sectionId)),
    )
  }

  // Only the working filters: a diagnostic is a defect, and its button lives in the toolbar where it
  // can be noticed without opening anything.
  const filters = ROW_CONDITIONS.filter((condition) => condition.kind === 'filter')
  const toggles = filters.map((condition) => ({
    id: condition.id,
    label: `Tylko ${condition.label} (${conditionCounts.get(condition.id) ?? 0})`,
    active: activeConditionIds.has(condition.id),
    onToggle: () => toggleCondition(condition.id),
  }))

  // Folds by unticking rather than filtering on top: the checkmarks stay the only description of what
  // the grid shows, so the picker can't disagree with it. A one-shot write, not a live rule — the
  // user can re-expand any section afterwards without the shortcut folding it again.
  const extraActions = ROW_CONDITIONS.filter((condition) => condition.sectionLabel !== null).map(
    (condition) => {
      const sectionIds = foldableSectionIds.get(condition.id) ?? new Set<number>()

      return {
        label: `${condition.sectionLabel} (${sectionIds.size})`,
        select: (current: string[]) => current.filter((v) => !sectionIds.has(Number(v))),
      }
    },
  )

  return (
    <FilterMultiSelect
      values={values}
      onValuesChange={onValuesChange}
      options={options}
      label="Filtry"
      // Active conditions, not ticked sections: the trigger has to say something is being hidden
      // without the menu open, and the number of expanded sections doesn't say that.
      triggerCount={activeConditionIds.size}
      icon={ListFilter}
      iconPosition="right"
      searchable
      title="Ukryj pozycje lub zwiń sekcje"
      triggerClassName="w-fit min-w-0"
      selectAllLabel="Rozwiń wszystkie sekcje"
      deselectAllLabel="Zwiń wszystkie sekcje"
      toggles={toggles}
      extraActions={extraActions}
    />
  )
}
