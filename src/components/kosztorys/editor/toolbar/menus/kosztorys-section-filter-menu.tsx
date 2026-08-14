'use client'

import { ListFilter } from 'lucide-react'
import { FilterMultiSelect, FILTER_NONE } from '@/components/transfers/filter-multi-select'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

// Reuses the transfers FilterMultiSelect, but it drives the FOLD, not a row filter: a ticked section
// is expanded, an unticked one collapses under its band (which stays visible, with its total) — the
// same state a band's own chevron toggles. FilterMultiSelect speaks the URL encoding
// [] = all / [FILTER_NONE] = none / [ids] = those, so this bridges that to collapsedSectionIds.
export function KosztorysSectionFilterMenu() {
  const { subtotals, collapsedSectionIds, setCollapsedSectionIds, foldableSectionIds } =
    useKosztorysEditorContext()
  const emptySections = foldableSectionIds.get('no-measured-qty') ?? new Set<number>()

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
      // what the grid shows, so the picker can't disagree with it. Qualifies a section only when
      // EVERY pozycja is unexecuted — a section fully executed but unpriced also sums to zero, and
      // the old „suma = 0" rule folded away exactly the one that needed attention.
      extraAction={{
        label: `Zwiń sekcje bez wykonanych prac (${emptySections.size})`,
        select: (current) => current.filter((v) => !emptySections.has(Number(v))),
      }}
    />
  )
}
