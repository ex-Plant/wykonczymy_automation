'use client'

import { ListFilter } from 'lucide-react'
import { FilterMultiSelect, FILTER_NONE } from '@/components/transfers/filter-multi-select'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

// Section filter reusing the transfers FilterMultiSelect. The hook models the selection as
// Set<number> | null (null = all, empty Set = none, Set = those); FilterMultiSelect speaks the URL
// encoding [] = all / [FILTER_NONE] = none / [ids] = those, so this bridges the two.
export function KosztorysSectionFilterMenu() {
  const { subtotals, shownSectionIds, setShownSectionIds, emptySections } =
    useKosztorysEditorContext()

  const options = subtotals.map((s) => ({ value: String(s.sectionId), label: s.sectionName }))

  const values =
    shownSectionIds === null
      ? []
      : shownSectionIds.size === 0
        ? [FILTER_NONE]
        : [...shownSectionIds].map(String)

  function onValuesChange(next: string[]) {
    if (next.length === 0) setShownSectionIds(null)
    else if (next.length === 1 && next[0] === FILTER_NONE) setShownSectionIds(new Set())
    else setShownSectionIds(new Set(next.map(Number)))
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
      title="Filtruj sekcje"
      triggerClassName="w-fit min-w-0"
      selectAllLabel="Pokaż wszystkie"
      deselectAllLabel="Ukryj wszystkie"
      // Hides by unticking rather than by filtering on top: the checkmarks stay the only description
      // of what the grid shows, so the picker can't disagree with it. "Pusta" = no executed work
      // (net === 0), not "no positions" — a section with no items is cascade-deleted and never
      // reaches the grid.
      extraAction={{
        label: `Ukryj puste sekcje (${emptySections.size})`,
        select: (current) => current.filter((v) => !emptySections.has(Number(v))),
      }}
    />
  )
}
