'use client'

import { DataTable } from '@/components/ui/data-table'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { cashRegisterColumns, type CashRegisterRowT } from '@/lib/tables/cash-registers'
import type { PaginationMetaT } from '@/lib/pagination'

type CashRegisterDataTablePropsT = {
  readonly data: readonly CashRegisterRowT[]
  readonly paginationMeta: PaginationMetaT
}

export function CashRegisterDataTable({ data, paginationMeta }: CashRegisterDataTablePropsT) {
  return (
    <div className="mt-6 space-y-4">
      <DataTable
        data={data}
        columns={cashRegisterColumns}
        emptyMessage="Brak kas"
        getRowHref={(row: CashRegisterRowT) => `/kasa/${row.id}`}
      />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl="/kasa" />
    </div>
  )
}
