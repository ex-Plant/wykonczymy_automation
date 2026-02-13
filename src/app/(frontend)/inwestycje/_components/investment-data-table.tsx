'use client'

import { DataTable } from '@/components/ui/data-table'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { investmentColumns } from '@/lib/investments/columns'
import type { InvestmentRowT } from '@/lib/investments/types'
import type { PaginationMetaT } from '@/lib/transactions/types'

type InvestmentDataTablePropsT = {
  readonly data: readonly InvestmentRowT[]
  readonly paginationMeta: PaginationMetaT
}

export function InvestmentDataTable({ data, paginationMeta }: InvestmentDataTablePropsT) {
  return (
    <div className="space-y-4">
      <DataTable data={data} columns={investmentColumns} emptyMessage="Brak inwestycji" />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl="/inwestycje" />
    </div>
  )
}
