'use client'

import { DataTable } from '@/components/ui/data-table'
import { cashRegisterColumns } from '@/lib/tables/cash-registers'
import { investmentColumns } from '@/lib/tables/investments'
import { userColumns } from '@/lib/tables/users'
import { SectionHeader } from '@/components/ui/section-header'
import type { CashRegisterRowT } from '@/lib/tables/cash-registers'
import type { InvestmentRowT } from '@/lib/tables/investments'
import type { UserRowT } from '@/lib/tables/users'

type DashboardTablesPropsT = {
  readonly cashRegisters: readonly CashRegisterRowT[]
  readonly investments: readonly InvestmentRowT[]
  readonly users: readonly UserRowT[]
}

export function DashboardTables({ cashRegisters, investments, users }: DashboardTablesPropsT) {
  return (
    <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div className="space-y-8">
        <div>
          <SectionHeader>Kasy</SectionHeader>
          <div className="mt-4">
            <DataTable data={cashRegisters} columns={cashRegisterColumns} emptyMessage="Brak kas" />
          </div>
        </div>
        <div>
          <SectionHeader>Inwestycje</SectionHeader>
          <div className="mt-4">
            <DataTable
              data={investments}
              columns={investmentColumns}
              emptyMessage="Brak inwestycji"
            />
          </div>
        </div>
      </div>
      3
      <div>
        <SectionHeader>Użytkownicy</SectionHeader>
        <div className="mt-4">
          <DataTable data={users} columns={userColumns} emptyMessage="Brak użytkowników" />
        </div>
      </div>
    </div>
  )
}
