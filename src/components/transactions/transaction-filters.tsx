'use client'

import type { ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { TRANSACTION_TYPES, TRANSACTION_TYPE_LABELS } from '@/lib/constants/transactions'
import { MonthYearPicker, getMonthDateRange } from '@/components/ui/month-year-picker'
import { buildUrlWithParams } from '@/lib/helpers'
import { cn } from '@/lib/cn'

type ReferenceItemT = { id: number; name: string }

type TransactionFiltersPropsT = {
  cashRegisters: ReferenceItemT[]
  baseUrl: string
  showMonthPicker?: boolean
  className?: string
}

export function TransactionFilters({
  cashRegisters,
  baseUrl,
  showMonthPicker = false,
  className,
}: TransactionFiltersPropsT) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentType = searchParams.get('type') ?? ''
  const currentCashRegister = searchParams.get('cashRegister') ?? ''
  const currentFrom = searchParams.get('from') ?? ''
  const currentTo = searchParams.get('to') ?? ''

  const now = new Date()
  const pickerMonth = currentFrom
    ? new Date(currentFrom + 'T00:00:00').getMonth() + 1
    : now.getMonth() + 1
  const pickerYear = currentFrom
    ? new Date(currentFrom + 'T00:00:00').getFullYear()
    : now.getFullYear()

  function updateParam(key: string, value: string) {
    // Reset to page 1 when changing filters
    router.push(buildUrlWithParams(baseUrl, searchParams.toString(), { [key]: value, page: '' }))
  }

  function updateMultipleParams(overrides: Record<string, string>) {
    router.push(buildUrlWithParams(baseUrl, searchParams.toString(), { ...overrides, page: '' }))
  }

  function clearFilters() {
    router.push(baseUrl)
  }

  function handleMonthChange(month: number) {
    const { from, to } = getMonthDateRange(month, pickerYear)
    updateMultipleParams({ from, to })
  }

  function handleYearChange(year: number) {
    const { from, to } = getMonthDateRange(pickerMonth, year)
    updateMultipleParams({ from, to })
  }

  const hasFilters = currentType || currentCashRegister || currentFrom || currentTo

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {showMonthPicker && (
        <MonthYearPicker
          month={pickerMonth}
          year={pickerYear}
          onMonthChange={handleMonthChange}
          onYearChange={handleYearChange}
        />
      )}

      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="Typ">
          <FilterSelect
            value={currentType}
            onValueChange={(v) => updateParam('type', v)}
            options={TRANSACTION_TYPES.map((t) => ({
              value: t,
              label: TRANSACTION_TYPE_LABELS[t],
            }))}
          />
        </FilterField>

        <FilterField label="Kasa">
          <FilterSelect
            value={currentCashRegister}
            onValueChange={(v) => updateParam('cashRegister', v)}
            options={cashRegisters.map((cr) => ({ value: String(cr.id), label: cr.name }))}
          />
        </FilterField>

        <FilterField label="Od">
          <Input
            type="date"
            value={currentFrom}
            onChange={(e) => updateParam('from', e.target.value)}
            className="w-40"
            placeholder="Od"
          />
        </FilterField>

        <FilterField label="Do">
          <Input
            type="date"
            value={currentTo}
            onChange={(e) => updateParam('to', e.target.value)}
            placeholder="Do"
          />
        </FilterField>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Wyczyść filtry
          </Button>
        )}
      </div>
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col space-y-1">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {children}
    </div>
  )
}

type FilterOptionT = { value: string; label: string }

type FilterSelectPropsT = {
  value: string
  onValueChange: (value: string) => void
  options: FilterOptionT[]
  className?: string
}

function FilterSelect({ value, onValueChange, options, className }: FilterSelectPropsT) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v === 'ALL' ? '' : v)}>
      <SelectTrigger className={'min-w-40'}>
        <SelectValue placeholder="Wszystkie" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">Wszystkie</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
