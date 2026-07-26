'use client'

import { ListFilter } from 'lucide-react'
import { FilterMultiSelect, FILTER_NONE } from '@/components/transfers/filter-multi-select'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

// Reuses the transfers FilterMultiSelect, but it drives the FOLD, not a row filter: a ticked section
// is expanded, an unticked one collapses under its band (which stays visible, with its total) — the
// same state a band's own chevron toggles. FilterMultiSelect speaks the URL encoding
// [] = all / [FILTER_NONE] = none / [ids] = those, so this bridges that to collapsedSectionIds.
export function KosztorysSectionFilterMenu() {
  const { subtotals, collapsedSectionIds, setCollapsedSectionIds, emptySections } =
    useKosztorysEditorContext()

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

  return (
    <FilterMultiSelect
      values={values}
      onValuesChange={onValuesChange}
      options={options}
      label="Sekcje"
      icon={ListFilter}
      iconPosition="right"
      searchable
      title="Zwiń lub rozwiń sekcje"
      triggerClassName="w-fit min-w-0"
      selectAllLabel="Rozwiń wszystkie"
      deselectAllLabel="Zwiń wszystkie"
      // Folds by unticking rather than filtering on top: the checkmarks stay the only description of
      // what the grid shows, so the picker can't disagree with it. "Pusta" = no executed work
      // (net === 0), not "no positions" — a section with no items is cascade-deleted and never
      // reaches the grid.
      extraAction={{
        label: `Zwiń puste sekcje (${emptySections.size})`,
        select: (current) => current.filter((v) => !emptySections.has(Number(v))),
      }}
    />
  )
}
