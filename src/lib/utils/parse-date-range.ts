import { dayBound, type DateRangeT } from '@/lib/utils/date-range'
import type { ResolvedSearchParamsT } from '@/types/page'

/**
 * The `?from=&to=` window as the filter bar writes it, for a page that reads it on the server. One
 * bound is a filter on its own, so the range comes back open at the other end rather than being
 * discarded as incomplete; `dayBound` says what happens to a bound that is not an ISO day.
 */
export function parseDateRange(searchParams: ResolvedSearchParamsT): DateRangeT {
  return { from: dayBound(searchParams.from), to: dayBound(searchParams.to) }
}
