import type { DateRangeT } from '@/lib/utils/date-range'
import type { ResolvedSearchParamsT } from '@/types/page'

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * The `?from=&to=` window as the filter bar writes it. One bound is a filter on its own, so the
 * range comes back open at the other end rather than being discarded as incomplete.
 *
 * A bound that isn't an ISO day is dropped rather than passed through. Downstream comparison is
 * lexical, so junk never errors — it silently matches nothing and every total reads zero, which is
 * indistinguishable from an honest empty window. A repeated param arrives as an array and is dropped
 * for the same reason: there is no sensible single answer to `?from=a&from=b`.
 */
export function parseDateRange(searchParams: ResolvedSearchParamsT): DateRangeT {
  const bound = (value: ResolvedSearchParamsT[string]) =>
    typeof value === 'string' && ISO_DAY.test(value) ? value : undefined

  return { from: bound(searchParams.from), to: bound(searchParams.to) }
}
