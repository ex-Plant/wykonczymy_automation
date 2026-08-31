'use client'

import { useMemo } from 'react'
import { DataTable } from '@/components/ui/data-table/data-table'
import {
  SEARCH_FILTER_TOOLBAR_WIDTH,
  SearchFilterInput,
} from '@/components/filters/search-filter-input'
import { AddCatalogueItemDialog } from '@/components/dialogs/add-catalogue-item-dialog'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { getWorkCatalogueColumns } from '@/components/tables/work-catalogue'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const INITIAL_SORTING = [{ id: 'description', desc: false }]

const getSearchableText = (row: WorkCatalogueItemT) => `${row.description} ${row.category ?? ''}`

export function WorkCatalogueDataTable({ data }: { data: WorkCatalogueItemT[] }) {
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(data, getSearchableText)

  const categorySuggestions = useMemo(
    () => [...new Set(data.map((row) => row.category).filter((v) => v !== null))].sort(),
    [data],
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
          <AddCatalogueItemDialog categorySuggestions={categorySuggestions} />
        </>
      )}
    />
  )
}
