'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
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

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      // Reset to page 1 when changing filters
      params.delete('page')
      router.push(`/transakcje?${params.toString()}`)
    },
    [router, searchParams],
  )

  const clearFilters = () => {
    router.push('/transakcje')
  }

  const hasFilters = currentType || currentCashRegister || currentFrom || currentTo

  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      {/* Type filter */}
      <div className="space-y-1">
        <label className="text-muted-foreground text-xs font-medium">Typ</label>
        <Select
          value={currentType}
          onValueChange={(v) => updateParam('type', v === 'ALL' ? '' : v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Wszystkie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Wszystkie</SelectItem>
            {TRANSACTION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TRANSACTION_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cash register filter */}
      <div className="space-y-1">
        <label className="text-muted-foreground text-xs font-medium">Kasa</label>
        <Select
          value={currentCashRegister}
          onValueChange={(v) => updateParam('cashRegister', v === 'ALL' ? '' : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Wszystkie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Wszystkie</SelectItem>
            {cashRegisters.map((cr) => (
              <SelectItem key={cr.id} value={String(cr.id)}>
                {cr.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date from */}
      <div className="space-y-1">
        <label className="text-muted-foreground text-xs font-medium">Od</label>
        <Input
          type="date"
          value={currentFrom}
          onChange={(e) => updateParam('from', e.target.value)}
          className="w-40"
        />
      </div>

      {/* Date to */}
      <div className="space-y-1">
        <label className="text-muted-foreground text-xs font-medium">Do</label>
        <Input
          type="date"
          value={currentTo}
          onChange={(e) => updateParam('to', e.target.value)}
          className="w-40"
        />
      </div>

      {/* Clear filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Wyczyść filtry
        </Button>
      )}
    </div>
  )
}
