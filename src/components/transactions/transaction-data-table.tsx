'use client'

import { DataTable } from '@/components/ui/data-table'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { getTransactionColumns } from '@/lib/transactions/columns'
import type { TransactionRowT, PaginationMetaT } from '@/lib/transactions/types'
import { cn } from '../../lib/cn'

type TransactionDataTablePropsT = {
  readonly data: readonly TransactionRowT[]
  readonly paginationMeta: PaginationMetaT
  readonly excludeColumns?: string[]
  readonly baseUrl: string
  readonly className?: string
}

export function TransactionDataTable({
  data,
  paginationMeta,
  excludeColumns = [],
  baseUrl,
  className,
}: TransactionDataTablePropsT) {
  const columns = getTransactionColumns(excludeColumns)

  return (
    <div className={cn('space-y-4', className)}>
      <DataTable data={data} columns={columns} emptyMessage="Brak transakcji" />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl={baseUrl} />
    </div>
  )
}
