'use client'

import { useMemo } from 'react'
import { Tags } from 'lucide-react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import {
  SEARCH_FILTER_TOOLBAR_WIDTH,
  SearchFilterInput,
} from '@/components/filters/search-filter-input'
import { AddCatalogueItemDialog } from '@/components/dialogs/add-catalogue-item-dialog'
import { useClientMultiFilter } from '@/hooks/use-client-multi-filter'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { getWorkCatalogueColumns } from '@/components/tables/work-catalogue'
import { catalogueCategoryOptions } from '@/lib/kosztorys/work-catalogue/category-options'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const INITIAL_SORTING = [{ id: 'description', desc: false }]

const getSearchableText = (row: WorkCatalogueItemT) => `${row.description} ${row.category ?? ''}`

const getCategory = (row: WorkCatalogueItemT) => row.category ?? ''

export function WorkCatalogueDataTable({ data }: { data: WorkCatalogueItemT[] }) {
  const {
    filteredData: searched,
    searchTerm,
    setSearchTerm,
  } = useSearchFilter(data, getSearchableText)
  // Kategoria narrows what the szukajka already found, so the menu's count is about rows on screen
  // rather than about the whole cennik.
  const {
    filteredData,
    values: categories,
    setValues: setCategories,
  } = useClientMultiFilter(searched, getCategory)

  const categoryOptions = useMemo(() => catalogueCategoryOptions(data), [data])

  // The form's autocomplete offers only kategorie that exist — „Bez kategorii" is a filter answer,
  // not something to type into a new praca.
  const categorySuggestions = useMemo(
    () => categoryOptions.map((option) => option.value).filter((value) => value !== ''),
    [categoryOptions],
  )

  const columns = useMemo(
    () => getWorkCatalogueColumns({ categorySuggestions }),
    [categorySuggestions],
  )

  return (
    <DataTable
      data={filteredData}
      columns={columns}
      initialSorting={INITIAL_SORTING}
      toolbar={() => (
        <>
          <SearchFilterInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Szukaj pracy..."
            className={SEARCH_FILTER_TOOLBAR_WIDTH}
          />
          <FilterMultiSelect
            label="Kategoria"
            options={categoryOptions}
            values={categories}
            onValuesChange={setCategories}
            icon={Tags}
            searchable
          />
          <AddCatalogueItemDialog categorySuggestions={categorySuggestions} />
        </>
      )}
    />
  )
}
