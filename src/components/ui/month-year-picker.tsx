'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/cn'

export const MONTHS = [
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

type MonthYearPickerPropsT = {
  readonly month: number
  readonly year: number
  readonly onMonthChange: (month: number) => void
  readonly onYearChange: (year: number) => void
  readonly yearRange?: number
  readonly className?: string
}

export function MonthYearPicker({
  month,
  year,
  onMonthChange,
  onYearChange,
  yearRange = 5,
  className,
}: MonthYearPickerPropsT) {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: yearRange }, (_, i) => currentYear - i)

  return (
    <div className={cn('flex gap-3', className)}>
      <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
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
      <Select value={String(month)} onValueChange={(v) => onMonthChange(Number(v))}>
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
    </div>
  )
}

// Re-export for convenience — the actual function lives in lib/helpers.ts (server-safe)
export { getMonthDateRange } from '@/lib/helpers'
