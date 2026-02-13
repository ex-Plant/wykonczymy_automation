'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatPLN } from '@/lib/format-currency'
import { TransactionDataTable } from '@/components/transactions/transaction-data-table'
import type { TransactionRowT, PaginationMetaT } from '@/lib/transactions/types'
import { PageWrapper } from '@/components/ui/page-wrapper'

const MONTHS = [
  'Styczeń',
  'Luty',
  'Marzec',
  'Kwiecień',
  'Maj',
  'Czerwiec',
  'Lipiec',
  'Sierpień',
  'Wrzesień',
  'Październik',
  'Listopad',
  'Grudzień',
] as const

const EMPLOYEE_EXCLUDE_COLUMNS = [
  'cashRegister',
  'investment',
  'worker',
  'otherCategory',
  'invoice',
  'paymentMethod',
]

type EmployeeDashboardPropsT = {
  readonly rows: readonly TransactionRowT[]
  readonly paginationMeta: PaginationMetaT
  readonly saldo: number
  readonly month: number
  readonly year: number
}

export function EmployeeDashboard({
  rows,
  paginationMeta,
  saldo,
  month,
  year,
}: EmployeeDashboardPropsT) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const buildUrl = (overrides: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(overrides)) {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    const qs = params.toString()
    return `/${qs ? `?${qs}` : ''}`
  }

  const handleMonthChange = (value: string) => {
    router.push(buildUrl({ month: value, page: '' }))
  }

  const handleYearChange = (value: string) => {
    router.push(buildUrl({ year: value, page: '' }))
  }

  return (
    <PageWrapper title="Moje konto">
      {/* Month/year selector */}
      <div className="mt-6 flex gap-3">
        <Select value={String(month)} onValueChange={handleMonthChange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((label, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(year)} onValueChange={handleYearChange}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Saldo card — all-time */}
      <div className="border-border bg-card mt-6 rounded-lg border p-4">
        <p className="text-muted-foreground text-sm">Saldo (zaliczki - wydatki)</p>
        <p className="text-foreground mt-1 text-2xl font-semibold">{formatPLN(saldo)}</p>
      </div>

      {/* Monthly transactions table */}
      <div className="mt-8">
        <h2 className="text-foreground text-lg font-medium">
          Transakcje — {MONTHS[month - 1]} {year}
        </h2>
        <div className="mt-4">
          <TransactionDataTable
            data={rows}
            paginationMeta={paginationMeta}
            excludeColumns={EMPLOYEE_EXCLUDE_COLUMNS}
            baseUrl="/"
          />
        </div>
      </div>
    </PageWrapper>
  )
}
