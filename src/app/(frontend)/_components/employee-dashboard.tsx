'use client'

import { useState, useTransition } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatPLN } from '@/lib/format-currency'
import { TRANSACTION_TYPE_LABELS, type TransactionTypeT } from '@/lib/constants/transactions'
import { getEmployeeMonthData, type EmployeeMonthDataT } from '@/lib/transactions/actions'

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

type EmployeeDashboardPropsT = {
  userId: number
  initialMonth: number
  initialYear: number
  initialData: EmployeeMonthDataT
}

export function EmployeeDashboard({
  userId,
  initialMonth,
  initialYear,
  initialData,
}: EmployeeDashboardPropsT) {
  const [month, setMonth] = useState(initialMonth)
  const [year, setYear] = useState(initialYear)
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const handlePeriodChange = (newMonth: number, newYear: number) => {
    setMonth(newMonth)
    setYear(newYear)
    startTransition(async () => {
      const result = await getEmployeeMonthData(userId, newMonth, newYear)
      setData(result)
    })
  }

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-foreground text-2xl font-semibold">Moje konto</h1>

      {/* Month/year selector */}
      <div className="mt-6 flex gap-3">
        <Select value={String(month)} onValueChange={(v) => handlePeriodChange(Number(v), year)}>
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

        <Select value={String(year)} onValueChange={(v) => handlePeriodChange(month, Number(v))}>
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
        <p className="text-foreground mt-1 text-2xl font-semibold">{formatPLN(data.saldo)}</p>
      </div>

      {/* Monthly transactions table */}
      <div className="mt-8">
        <h2 className="text-foreground text-lg font-medium">
          Transakcje — {MONTHS[month - 1]} {year}
        </h2>
        <div className="border-border mt-4 overflow-x-auto rounded-lg border">
          <table className={`w-full text-sm ${isPending ? 'opacity-50' : ''}`}>
            <thead>
              <tr className="border-border bg-muted/50 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Opis</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Kwota</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Typ</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted-foreground px-4 py-8 text-center">
                    Brak transakcji w tym miesiącu
                  </td>
                </tr>
              ) : (
                data.transactions.map((tx) => (
                  <tr key={tx.id} className="border-border border-b last:border-b-0">
                    <td className="text-foreground px-4 py-3">{tx.description}</td>
                    <td className="text-foreground px-4 py-3 text-right font-medium">
                      {formatPLN(tx.amount)}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {TRANSACTION_TYPE_LABELS[tx.type as TransactionTypeT] ?? tx.type}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {new Date(tx.date).toLocaleDateString('pl-PL', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
