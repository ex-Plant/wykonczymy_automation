'use client'

import { useState, useTransition } from 'react'
import { formatPLN } from '@/lib/format-currency'
import { TransactionDataTable } from '@/components/transactions/transaction-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { StatCard } from '@/components/ui/stat-card'
import { MonthYearPicker, MONTHS } from '@/components/ui/month-year-picker'
import { getEmployeeMonthlyData, type MonthlyDataT } from '@/lib/queries/employees'

const EMPLOYEE_EXCLUDE_COLUMNS = [
  'cashRegister',
  'investment',
  'worker',
  'otherCategory',
  'invoice',
  'paymentMethod',
]

type EmployeeDashboardPropsT = {
  readonly userId: number
  readonly saldo: number
  readonly initialMonthlyData: MonthlyDataT
  readonly month: number
  readonly year: number
}

export function EmployeeDashboard({
  userId,
  saldo,
  initialMonthlyData,
  month: initialMonth,
  year: initialYear,
}: EmployeeDashboardPropsT) {
  const [isPending, startTransition] = useTransition()
  const [month, setMonth] = useState(initialMonth)
  const [year, setYear] = useState(initialYear)
  const [monthlyData, setMonthlyData] = useState(initialMonthlyData)

  const refetch = (nextMonth: number, nextYear: number) => {
    startTransition(async () => {
      const result = await getEmployeeMonthlyData({ userId, month: nextMonth, year: nextYear })
      setMonthlyData(result)
    })
  }

  const handleMonthChange = (nextMonth: number) => {
    setMonth(nextMonth)
    refetch(nextMonth, year)
  }

  const handleYearChange = (nextYear: number) => {
    setYear(nextYear)
    refetch(month, nextYear)
  }

  return (
    <PageWrapper title="Moje konto">
      {/* Month/year selector */}
      <MonthYearPicker
        month={month}
        year={year}
        onMonthChange={handleMonthChange}
        onYearChange={handleYearChange}
        className="mt-6"
      />

      {/* Saldo cards */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Saldo ogólne (zaliczki - wydatki)" value={formatPLN(saldo)} />
        <StatCard
          label={`Saldo — ${MONTHS[month - 1]} ${year}`}
          value={formatPLN(monthlyData.monthlySaldo)}
        />
      </div>

      {/* Monthly transactions table */}
      <div className="mt-8">
        <h2 className="text-foreground text-lg font-medium">
          Transakcje — {MONTHS[month - 1]} {year}
        </h2>
        <div className="mt-4">
          <TransactionDataTable
            data={monthlyData.rows}
            paginationMeta={monthlyData.paginationMeta}
            excludeColumns={EMPLOYEE_EXCLUDE_COLUMNS}
            baseUrl="/"
          />
        </div>
      </div>
    </PageWrapper>
  )
}
