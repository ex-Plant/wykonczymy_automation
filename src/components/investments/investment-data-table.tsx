'use client'

import { useCallback, useMemo } from 'react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { ColumnToggle } from '@/components/filters/column-toggle'
import { StatusFilter } from '@/components/investments/status-filter'
import {
  SEARCH_FILTER_TOOLBAR_WIDTH,
  SearchFilterInput,
} from '@/components/filters/search-filter-input'
import { getInvestmentColumns, V2_COLUMN_IDS } from '@/components/tables/investments'
import { Checkbox } from '@/components/ui/checkbox'
import type { InvestmentRowT } from '@/types/table-rows'
import { useStatusFilter } from '@/hooks/use-status-filter'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { useCurrentUser } from '@/hooks/use-current-user'
import { AddInvestmentDialog } from '@/components/dialogs/add-investment-dialog'
import type { PresetMetaT } from '@/lib/db/presets'

const getStatus = (row: InvestmentRowT) => row.status

type InvestmentDataTablePropsT = {
  data: InvestmentRowT[]
  presets: PresetMetaT[]
}

export function InvestmentDataTable({ data, presets }: InvestmentDataTablePropsT) {
  const { role: userRole } = useCurrentUser()

  const {
    filteredData: statusFiltered,
    selectedStatuses,
    toggleStatus,
  } = useStatusFilter(data, getStatus)

  const getSearchableText = useCallback(
    (row: InvestmentRowT) => `${row.name} ${row.address} ${row.contactPerson}`,
    [],
  )
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(
    statusFiltered,
    getSearchableText,
  )

  const columns = useMemo(() => getInvestmentColumns({ userRole }), [userRole])

  return (
    <DataTable
      data={filteredData}
      columns={columns}
      storageKey="investments"
      getRowHref={(row) => `/inwestycje/${row.id}`}
      getRowClassName={(row) => (row.status === 'completed' ? 'opacity-50' : '')}
      toolbar={({ table, columnVisibility: cv, ...order }) => {
        // Ticked unless the picker (or a previous untick) has switched one off — absent from the
        // stored state means visible, which is what „domyślnie zaznaczony" has to mean here.
        const v2Shown = V2_COLUMN_IDS.every((id) => cv[id] !== false)
        return (
          <>
            <SearchFilterInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Szukaj..."
              className={SEARCH_FILTER_TOOLBAR_WIDTH}
            />
            <StatusFilter selectedStatuses={selectedStatuses} onToggle={toggleStatus} />
            <AddInvestmentDialog presets={presets} />
            {/* One switch for the whole kosztorys-sourced half, beside the per-column picker rather
              than inside it: reading v1 alone means hiding five columns at once, and doing that
              five ticks at a time is the gesture this replaces. Unticking writes the same
              visibility state the picker does, so the two never disagree about what is on screen. */}
            <div className="ml-auto flex items-center gap-2">
              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm whitespace-nowrap">
                <Checkbox
                  checked={v2Shown}
                  onCheckedChange={(state) =>
                    table.setColumnVisibility((prev) => ({
                      ...prev,
                      ...Object.fromEntries(V2_COLUMN_IDS.map((id) => [id, state === true])),
                    }))
                  }
                />
                Pokaż kolumny v2
              </label>
              <ColumnToggle table={table} columnVisibility={cv} {...order} />
            </div>
          </>
        )
      }}
    />
  )
}
