// Bare pl-PL number with 2 decimals (no currency symbol) for dense grid cells and subtotals —
// distinct from `formatPLN`, which emits "zł" and is too wide for the spreadsheet layout.
// `n + 0` collapses JS's negative zero: a deduction row negates its amount for display, so an
// investment with no wpłaty reached toLocaleString as -0 and rendered „-0,00".
export const formatNet = (n: number) =>
  (n + 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// A fraction (0.746) as a percentage; `null` (no denominator — see stageDoneFraction) renders as a
// dash. Two precisions: integer for the dense grid cells, one decimal for the headline figures where
// the whole kosztorys hangs on a single number.
const percentFormat = (fraction: number | null, fractionDigits: number) =>
  fraction == null
    ? '—'
    : `${(fraction * 100).toLocaleString('pl-PL', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      })}%`

export const formatPercent = (fraction: number | null) => percentFormat(fraction, 0)

export const formatPercentPrecise = (fraction: number | null) => percentFormat(fraction, 1)
