'use client'

import { DataTable } from '@/components/ui/data-table'
import { getTransactionColumns } from '@/lib/transactions/columns'
import type { TransactionRowT } from '@/lib/transactions/types'

const columns = getTransactionColumns()

type DashboardTransactionsTablePropsT = {
  readonly data: readonly TransactionRowT[]
}

export function DashboardTransactionsTable({ data }: DashboardTransactionsTablePropsT) {
  return (
    <DataTable
      data={data}
      columns={columns}
      emptyMessage="Brak transakcji"
      enableVirtualization
      virtualRowHeight={44}
      virtualContainerHeight={600}
    />
  )
}
