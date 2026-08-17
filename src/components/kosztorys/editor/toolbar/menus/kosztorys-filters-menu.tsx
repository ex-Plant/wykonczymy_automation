'use client'

import { ListFilter, TriangleAlert } from 'lucide-react'
import { FilterMultiSelect, FILTER_NONE } from '@/components/filters/filter-multi-select'
import { filtersMenuModel } from '@/components/kosztorys/editor/toolbar/menus/filters-menu-model'
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

  const filters = ROW_CONDITIONS.filter((condition) => condition.kind === 'filter')
  const workToggles = filters.map((condition) => ({
    id: condition.id,
    // The count is how many pozycje are in that state, not how many the row is currently showing —
    // a count of the survivors would be a count of itself and would jump on every click.
    label: `Pozycje ${condition.label} (${conditionCounts.get(condition.id) ?? 0})`,
    active: !engagedConditionIds.has(condition.id),
    onToggle: () => toggleCondition(condition.id),
  }))

  const { problemToggles, triggerCount, hasProblems } = filtersMenuModel({
    engagedIds: engagedConditionIds,
    counts: conditionCounts,
    collapsedSectionCount: collapsedSectionIds.size,
    untickedFilterCount: workToggles.filter((toggle) => !toggle.active).length,
  })

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
      triggerCount={triggerCount}
      // The triangle answers „czy coś jest tu zepsute" off the data alone, so it is lit before anyone
      // opens the menu — that is the whole point of moving the diagnostics in here, where an unopened
      // dropdown would otherwise hide them.
      icon={hasProblems ? TriangleAlert : ListFilter}
      iconClassName={hasProblems ? 'text-destructive' : undefined}
      iconPosition="right"
      searchable
      title="Co widać: pozycje i sekcje"
      triggerClassName="w-fit min-w-0"
      // „Pokaż pozycje z nieprawidłową ceną wykonawcy — z narzędziami (1)" is a sentence, not a label:
      // at the default width every problem row wrapped to three or four lines.
      contentClassName="w-80"
      resetAction={{
        label: 'Zresetuj filtry',
        // The same reset the empty state offers — one way back to „pokaż wszystko", not a second one
        // that happens to undo a different half.
        onReset: resetFilters,
        disabled: engagedConditionIds.size === 0 && collapsedSectionIds.size === 0,
      }}
      bulkToggleLabel="Zwiń wszystkie sekcje"
      toggleGroups={[
        // Problems first: they are the reason the menu carries a warning at all, and a reader who
        // opened it because of the triangle should not have to scroll past the ordinary filters to
        // reach what the triangle was about. Nothing wrong → no group at all, rather than a heading
        // over an empty list announcing a section of the menu that has nothing to say.
        {
          id: 'problems',
          heading: (
            <span className="text-destructive flex items-center gap-1.5">
              <TriangleAlert className="size-3.5" />
              Problemy
            </span>
          ),
          items: problemToggles.map((toggle) => ({
            ...toggle,
            onToggle: () => toggleCondition(toggle.id),
          })),
        },
        { id: 'work', heading: 'Prace', items: workToggles },
      ]}
      actionsHeading="Sekcje"
      optionsHeading="Widoczne sekcje"
      optionToggles={sectionToggles}
    />
  )
}
