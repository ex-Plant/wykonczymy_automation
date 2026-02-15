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
    <>
      <DataTable
        data={data}
        columns={userColumns}
        emptyMessage="Brak użytkowników"
        getRowHref={(row: UserRowT) => `/uzytkownicy/${row.id}`}
      />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl="/uzytkownicy" className={`mt-4`} />
    </>
  )
}
