'use client'

import { useSearchParams } from 'next/navigation'
import { Calendar } from 'lucide-react'
import { FilterGrid } from '@/components/ui/filter-grid'
import { Loader } from '@/components/ui/loader/loader'
import { FilterSelect } from '@/components/filters/filter-select'
import { DateFilterButton } from '@/components/filters/date-filter-button'
import { ClearButton } from '@/components/filters/clear-button'
import { useUrlFilterParams } from '@/hooks/use-url-filter-params'
import { MONTHS } from '@/lib/constants/months'
import { getMonthDateRange } from '@/lib/utils/date'

/** Reads the window from the URL and writes it back there — one owner of `from`/`to`, not two. */
export function DateFilters({ baseUrl }: { baseUrl: string }) {
  const searchParams = useSearchParams()
  const { updateParam, updateMultipleParams, isPending } = useUrlFilterParams(baseUrl)
  const currentFrom = searchParams.get('from') ?? ''
  const currentTo = searchParams.get('to') ?? ''

  const now = new Date()
  const pickerMonth = currentFrom ? String(new Date(currentFrom + 'T00:00:00').getMonth() + 1) : ''
  const pickerYear = currentFrom ? String(new Date(currentFrom + 'T00:00:00').getFullYear()) : ''

  function updateDateRange(month: number, year: number) {
    const { from, to } = getMonthDateRange(month, year)
    updateMultipleParams({ from, to })
  }

  function handleMonthChange(value: string) {
    if (!value) return updateMultipleParams({ from: '', to: '' })
    updateDateRange(Number(value), pickerYear ? Number(pickerYear) : now.getFullYear())
  }

  function handleYearChange(value: string) {
    if (!value) return updateMultipleParams({ from: '', to: '' })
    updateDateRange(pickerMonth ? Number(pickerMonth) : now.getMonth() + 1, Number(value))
  }

  const currentYear = now.getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const hasDateFilters = currentFrom || currentTo

  return (
    <FilterGrid>
      <Loader loading={isPending} portal />
      <FilterSelect
        value={pickerYear}
        onValueChange={handleYearChange}
        options={years.map((y) => ({ value: String(y), label: String(y) }))}
        placeholder="Rok"
        icon={Calendar}
      />

      <FilterSelect
        value={pickerMonth}
        onValueChange={handleMonthChange}
        options={MONTHS.map((label, i) => ({ value: String(i + 1), label }))}
        placeholder="Miesiąc"
        icon={Calendar}
      />

      <DateFilterButton label="Od" value={currentFrom} onChange={(v) => updateParam('from', v)} />
      <DateFilterButton label="Do" value={currentTo} onChange={(v) => updateParam('to', v)} />

      <ClearButton
        onClick={() => updateMultipleParams({ from: '', to: '' })}
        disabled={!hasDateFilters}
      >
        Wyczyść daty
      </ClearButton>
    </FilterGrid>
  )
}
