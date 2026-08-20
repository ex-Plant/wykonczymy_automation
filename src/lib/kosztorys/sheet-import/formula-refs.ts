import { columnLetter } from '@/lib/google/sheet-configs'

// Does a formula read the given column? The lookbehind is what keeps „R" from matching inside
// „AR12" — a false hit there would mistake an unrelated formula for one chained off the cell we
// asked about. Both addressing forms count: a cell (`D5`, `$D$5`) and a whole-column range, whose
// letter is followed by the colon rather than a row number — `=SUM(D:M)` names the same column as
// `=SUM(D5:M5)` and means the same thing about where the number came from.
export function referencesColumn(column: number): (formula: unknown) => boolean {
  // Compiled once per column rather than per row: the column is fixed for a whole tab, and a fresh
  // RegExp per row is one compile per praca.
  const pattern = new RegExp(`(?<![A-Z])\\$?${columnLetter(column)}(\\$?\\d|\\s*:)`)
  return (formula: unknown): boolean =>
    typeof formula === 'string' && formula.startsWith('=') && pattern.test(formula.toUpperCase())
}

export function referencesAnyColumn(columns: number[]): (formula: unknown) => boolean {
  const matchers = columns.map(referencesColumn)
  return (formula: unknown): boolean => matchers.some((matches) => matches(formula))
}
