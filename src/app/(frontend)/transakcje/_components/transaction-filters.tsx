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
import { buildUrlWithParams } from '@/lib/helpers'
import { cn } from '@/lib/cn'

type ReferenceItemT = { id: number; name: string }

type TransactionFiltersPropsT = {
  cashRegisters: ReferenceItemT[]
  className?: string
}

export function TransactionFilters({ cashRegisters, className }: TransactionFiltersPropsT) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentType = searchParams.get('type') ?? ''
  const currentCashRegister = searchParams.get('cashRegister') ?? ''
  const currentFrom = searchParams.get('from') ?? ''
  const currentTo = searchParams.get('to') ?? ''

  function updateParam(key: string, value: string) {
    // Reset to page 1 when changing filters
    router.push(
      buildUrlWithParams('/transakcje', searchParams.toString(), { [key]: value, page: '' }),
    )
  }

  function clearFilters() {
    router.push('/transakcje')
  }

  const hasFilters = currentType || currentCashRegister || currentFrom || currentTo

  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      <FilterField label="Typ">
        <FilterSelect
          value={currentType}
          onValueChange={(v) => updateParam('type', v)}
          options={TRANSACTION_TYPES.map((t) => ({ value: t, label: TRANSACTION_TYPE_LABELS[t] }))}
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
