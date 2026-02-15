'use client'

import { DataTable } from '@/components/ui/data-table'
import { ColumnToggle } from '@/components/ui/column-toggle'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { investmentColumns, type InvestmentRowT } from '@/lib/tables/investments'
import type { PaginationMetaT } from '@/lib/pagination'

type InvestmentDataTablePropsT = {
  readonly data: readonly InvestmentRowT[]
  readonly paginationMeta: PaginationMetaT
}

export function InvestmentDataTable({ data, paginationMeta }: InvestmentDataTablePropsT) {
  return (
    <div className="space-y-4">
      <DataTable
        data={data}
        columns={investmentColumns}
        emptyMessage="Brak inwestycji"
        storageKey="investments"
        toolbar={(table) => <ColumnToggle table={table} />}
        getRowHref={(row: InvestmentRowT) => `/inwestycje/${row.id}`}
      />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl="/inwestycje" />
    </div>
  )
}
