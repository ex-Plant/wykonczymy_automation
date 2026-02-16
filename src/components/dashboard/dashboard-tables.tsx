'use client'

import { DataTable } from '@/components/ui/data-table'
import { cashRegisterColumns } from '@/lib/tables/cash-registers'
import { userColumns } from '@/lib/tables/users'
import { SectionHeader } from '@/components/ui/section-header'
import type { CashRegisterRowT } from '@/lib/tables/cash-registers'
import type { UserRowT } from '@/lib/tables/users'

type DashboardTablesPropsT = {
  readonly cashRegisters: readonly CashRegisterRowT[]
  readonly users: readonly UserRowT[]
}

export function DashboardTables({ cashRegisters, users }: DashboardTablesPropsT) {
  return (
    <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div>
        <SectionHeader>Kasy</SectionHeader>
        <div className="mt-4">
          <DataTable data={cashRegisters} columns={cashRegisterColumns} emptyMessage="Brak kas" />
        </div>
      </div>
      <div>
        <SectionHeader>Użytkownicy</SectionHeader>
        <div className="mt-4">
          <DataTable data={users} columns={userColumns} emptyMessage="Brak użytkowników" />
        </div>
      </div>
    </div>
  )
}
