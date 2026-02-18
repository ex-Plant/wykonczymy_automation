'use client'

import { DataTable } from '@/components/ui/data-table'
import { ColumnToggle } from '@/components/ui/column-toggle'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { TransactionFilters } from '@/components/transactions/transaction-filters'
import { getTransactionColumns, type TransactionRowT } from '@/lib/tables/transactions'
import type { PaginationMetaT } from '@/lib/pagination'
import { cn } from '../../lib/cn'

type FilterConfigT = {
  readonly cashRegisters?: { id: number; name: string }[]
  readonly investments?: { id: number; name: string }[]
  readonly showTypeFilter?: boolean
}

type TransactionDataTablePropsT = {
  readonly data: readonly TransactionRowT[]
  readonly paginationMeta: PaginationMetaT
  readonly excludeColumns?: string[]
  readonly baseUrl: string
  readonly filters?: FilterConfigT
  readonly className?: string
}

export function TransactionDataTable({
  data,
  paginationMeta,
  excludeColumns = [],
  baseUrl,
  filters,
  className,
}: TransactionDataTablePropsT) {
  const columns = getTransactionColumns(excludeColumns)

  return (
    <div className={cn('space-y-4', className)}>
      {filters && (
        <TransactionFilters
          cashRegisters={filters.cashRegisters}
          investments={filters.investments}
          showTypeFilter={filters.showTypeFilter}
          baseUrl={baseUrl}
        />
      )}
      <DataTable
        data={data}
        columns={columns}
        emptyMessage="Brak transferów"
        storageKey="transactions"
        toolbar={(table) => <ColumnToggle table={table} />}
      />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl={baseUrl} />
    </div>
  )
}
