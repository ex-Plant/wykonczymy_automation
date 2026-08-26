'use client'

import { useSearchParams } from 'next/navigation'
import { DateRangePicker } from '@/components/filters/date-range-picker'
import { useUrlFilterParams } from '@/hooks/use-url-filter-params'
import type { DateRangeT } from '@/lib/utils/date-range'

/** Reads the window from the URL and writes it back there — one owner of `from`/`to`, not two. */
export function DateFilters({ baseUrl }: { baseUrl: string }) {
  const searchParams = useSearchParams()
  const { updateMultipleParams, isPending } = useUrlFilterParams(baseUrl)

  const value: DateRangeT = {
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
  }

  return (
    <DateRangePicker
      value={value}
      onChange={(next) => updateMultipleParams({ from: next.from ?? '', to: next.to ?? '' })}
      isPending={isPending}
    />
  )
}
