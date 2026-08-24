import type { DateRangeT } from '@/lib/utils/date-range'

type SearchParamsT = Record<string, string | string[] | undefined>

/**
 * The `?from=&to=` window as the filter bar writes it. One bound is a filter on its own, so the
 * range comes back open at the other end rather than being discarded as incomplete.
 *
 * A repeated param arrives as an array — there is no sensible single answer to `?from=a&from=b`, so
 * that bound is dropped rather than guessed at.
 */
export function parseDateRange(searchParams: SearchParamsT): DateRangeT {
  const from = typeof searchParams.from === 'string' ? searchParams.from : ''
  const to = typeof searchParams.to === 'string' ? searchParams.to : ''

  return { from: from || undefined, to: to || undefined }
}
