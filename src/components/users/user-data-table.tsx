'use client'

import { DataTable } from '@/components/ui/data-table'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { userColumns, type UserRowT } from '@/lib/tables/users'
import type { PaginationMetaT } from '@/lib/pagination'

type UserDataTablePropsT = {
  readonly data: readonly UserRowT[]
  readonly paginationMeta: PaginationMetaT
}

export function UserDataTable({ data, paginationMeta }: UserDataTablePropsT) {
  return (
    <div className="space-y-4">
      <DataTable data={data} columns={userColumns} emptyMessage="Brak użytkowników" />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl="/uzytkownicy" />
    </div>
  )
}
