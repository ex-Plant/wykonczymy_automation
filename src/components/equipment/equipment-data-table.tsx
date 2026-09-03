'use client'

import { useCallback, useMemo } from 'react'
import { MapPin } from 'lucide-react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import {
  SEARCH_FILTER_TOOLBAR_WIDTH,
  SearchFilterInput,
} from '@/components/filters/search-filter-input'
import { getEquipmentColumns } from '@/components/tables/equipment'
import { whereFilterOptions, whereFilterValue } from '@/components/equipment/where-filter-options'
import { useClientMultiFilter } from '@/hooks/use-client-multi-filter'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { isLiveStatus } from '@/lib/equipment/equipment-status'
import type { EquipmentRowT } from '@/lib/equipment/types'
import type { DayT } from '@/lib/fleet/days'

const INITIAL_SORTING = [{ id: 'name', desc: false }]

export function EquipmentDataTable({ data, today }: { data: EquipmentRowT[]; today: DayT }) {
  // Serial numbers are what someone reads off the nameplate while standing next to the tool, so they
  // search alongside the words. `useSearchFilter` folds diacritics, so „szlifierka" finds „Szlifierka".
  const getSearchableText = useCallback(
    (row: EquipmentRowT) => `${row.name} ${row.make} ${row.model} ${row.serialNumber}`,
    [],
  )
  const { filteredData: searched, searchTerm, setSearchTerm } = useSearchFilter(data, getSearchableText)

  const {
    filteredData,
    values: places,
    setValues: setPlaces,
  } = useClientMultiFilter(searched, whereFilterValue)

  // From `data`, never from `filteredData`: options built off the filtered set vanish as soon as the
  // last matching row is hidden, and the filter can then no longer be undone.
  const placeOptions = useMemo(() => whereFilterOptions(data), [data])

  const columns = useMemo(() => getEquipmentColumns({ today }), [today])

  return (
    <DataTable
      data={filteredData}
      columns={columns}
      storageKey="equipment"
      initialSorting={INITIAL_SORTING}
      getRowHref={(row) => `/sprzet/${row.id}`}
      // Sold, lost and retired items stay listed — the register is also the record of what we USED to
      // have — but they are visibly out of the working set.
      getRowClassName={(row) => (isLiveStatus(row.status) ? '' : 'opacity-60')}
      toolbar={() => (
        <>
          <SearchFilterInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Szukaj sprzętu..."
            className={SEARCH_FILTER_TOOLBAR_WIDTH}
          />
          <FilterMultiSelect
            label="Gdzie jest"
            options={placeOptions}
            values={places}
            onValuesChange={setPlaces}
            icon={MapPin}
            searchable
          />
        </>
      )}
    />
  )
}
