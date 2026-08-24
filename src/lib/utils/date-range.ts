/**
 * A filter window over calendar days (`YYYY-MM-DD`), open at either end.
 *
 * Both bounds are optional because one bound is a legitimate filter on its own — „everything since
 * July" is a question users ask — and requiring the pair turns that into no filter at all.
 */
export type DateRangeT = {
  from?: string
  to?: string
}

/** No window. Spelled out so a caller has to say which it wants rather than omit an argument. */
export const ALL_TIME: DateRangeT = {}

/** Lexical on purpose: `YYYY-MM-DD` sorts chronologically, so no date parsing is involved. */
export const isWithinRange = (day: string, { from, to }: DateRangeT): boolean =>
  (from === undefined || day >= from) && (to === undefined || day <= to)
