'use client'

import { useCallback, useMemo } from 'react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { ColumnToggle } from '@/components/ui/column-toggle'
import { SEARCH_FILTER_TOOLBAR_WIDTH, SearchFilterInput } from '@/components/ui/search-filter-input'
import { getFleetColumns } from '@/components/tables/fleet'
import { AddVehicleDialog } from '@/components/dialogs/add-vehicle-dialog'
import { AddInspectionDialog } from '@/components/dialogs/add-inspection-dialog'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { formatPLN } from '@/lib/utils/format-currency'
import type { FleetRowT } from '@/types/fleet'

export function FleetDataTable({ data }: { data: FleetRowT[] }) {
  const getSearchableText = useCallback(
    (row: FleetRowT) => `${row.registration} ${row.make} ${row.model} ${row.vin}`,
    [],
  )
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(data, getSearchableText)

  const columns = useMemo(() => getFleetColumns(), [])

  return (
    <DataTable
      data={filteredData}
      columns={columns}
      storageKey="fleet"
      getRowHref={(row) => `/flota/${row.id}`}
      // Retired cars stay listed — their history is still the answer to "when did we last…" — but they
      // are visibly out of the working set.
      getRowClassName={(row) => (row.status === 'RETIRED' ? 'opacity-60' : '')}
      // Summed from the rows the table is actually rendering, so the total always matches what the
      // search box left on screen instead of quoting a number nobody can see.
      footer={(visibleColumnIds) => {
        const costsIndex = visibleColumnIds.indexOf('costs')
        if (costsIndex < 1) return null

        return (
          <tr>
            <td className="font-bold" colSpan={costsIndex}>
              Razem
            </td>
            <td className="text-right font-bold tabular-nums">
              {formatPLN(filteredData.reduce((sum, row) => sum + row.totalCosts, 0))}
            </td>
            {visibleColumnIds.slice(costsIndex + 1).map((id) => (
              <td key={id} />
            ))}
          </tr>
        )
      }}
      toolbar={(table, cv) => (
        <>
          <SearchFilterInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Szukaj..."
            className={SEARCH_FILTER_TOOLBAR_WIDTH}
          />
          <ColumnToggle table={table} columnVisibility={cv} />
          <AddInspectionDialog vehicles={data} />
          <AddVehicleDialog />
        </>
      )}
    />
  )
}
