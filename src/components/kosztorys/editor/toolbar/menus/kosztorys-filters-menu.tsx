'use client'

import { ListFilter } from 'lucide-react'
import { FilterMultiSelect, FILTER_NONE } from '@/components/filters/filter-multi-select'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { ROW_CONDITIONS } from '@/lib/kosztorys/row-conditions'

// One menu for „co widzę", at three granularities that all read the same way: a tick means the thing
// is on screen, unticking it takes it away. Pozycje are hidden outright; sekcje fold under their band
// (which stays visible, with its total). Same question at three levels, so splitting them across
// separate triggers would make the user check three times.
//
// Every condition comes as a complementary pair („bez przedmiaru" / „z przedmiarem"), which is what
// makes the picker grammar work: „pokaż mi tylko te z przedmiarem" is unticking the other half, not a
// separate mode. It also means a new axis is two registry entries and nothing else.
//
// The section half reuses the transfers FilterMultiSelect, whose URL encoding is
// [] = all / [FILTER_NONE] = none / [ids] = those — bridged here to collapsedSectionIds.
export function KosztorysFiltersMenu() {
  const {
    subtotals,
    collapsedSectionIds,
    setCollapsedSectionIds,
    foldableSectionIds,
    engagedConditionIds,
    toggleCondition,
    resetFilters,
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
    // The count is how many pozycje are in that state, not how many the row is currently showing —
    // a count of the survivors would be a count of itself and would jump on every click.
    label: `Pozycje ${condition.label} (${conditionCounts.get(condition.id) ?? 0})`,
    active: !engagedConditionIds.has(condition.id),
    onToggle: () => toggleCondition(condition.id),
  }))

  // Folds by unticking sections rather than filtering on top of them: the checkmarks below stay the
  // only description of what the grid shows, so this row and the list can never disagree. Both its
  // tick and its click read the LIVE selection, so re-expanding one section by hand unticks the group.
  const sectionToggles = filters.map((condition) => {
    const sectionIds = foldableSectionIds.get(condition.id) ?? new Set<number>()
    // With nothing in that state the row has nothing to report, so it stays unticked rather than
    // claiming „wszystkie widoczne" vacuously.
    const isActive = (current: string[]) =>
      sectionIds.size > 0 && [...sectionIds].every((id) => current.includes(String(id)))

    return {
      label: `${condition.sectionLabel} (${sectionIds.size})`,
      isActive,
      select: (current: string[]) =>
        isActive(current)
          ? current.filter((v) => !sectionIds.has(Number(v)))
          : [...current, ...[...sectionIds].map(String).filter((v) => !current.includes(v))],
    }
  })

  return (
    <FilterMultiSelect
      values={values}
      onValuesChange={onValuesChange}
      options={options}
      label="Filtry"
      // Everything this menu is currently taking away: the unticked filters plus the folded sections.
      // Only the toolbar's diagnostics stay out — nothing inside is ticked for them, so counting them
      // produced „Filtry (2)" over an untouched list.
      triggerCount={toggles.filter((toggle) => !toggle.active).length + collapsedSectionIds.size}
      icon={ListFilter}
      iconPosition="right"
      searchable
      title="Co widać: pozycje i sekcje"
      triggerClassName="w-fit min-w-0"
      resetAction={{
        label: 'Zresetuj filtry',
        // The same reset the empty state offers — one way back to „pokaż wszystko", not a second one
        // that happens to undo a different half.
        onReset: resetFilters,
        disabled: engagedConditionIds.size === 0 && collapsedSectionIds.size === 0,
      }}
      bulkToggleLabel="Zwiń wszystkie sekcje"
      toggles={toggles}
      togglesHeading="Prace"
      actionsHeading="Sekcje"
      optionsHeading="Widoczne sekcje"
      optionToggles={sectionToggles}
    />
  )
}
