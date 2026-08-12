import { describe, expect, it } from 'vitest'
import { compareFooterTotals } from '@/lib/kosztorys/sheet-import/footer-totals'
import { parseRobocizna } from '@/lib/kosztorys/sheet-import/parse-robocizna'
import { resolveRobocizna } from '@/lib/kosztorys/sheet-import/resolve-columns'
import { BIALOSTOCKA_ROWS } from '@/__tests__/fixtures/kosztorys-sheet/rows'

function compare(grid: (string | number)[][]) {
  const resolved = resolveRobocizna(grid)
  if (!resolved.ok) expect.fail(`fixture header did not resolve: ${resolved.problems.join(' | ')}`)
  return compareFooterTotals(grid, resolved, parseRobocizna(grid, resolved))
}

const byKey = (grid: (string | number)[][], key: string) =>
  compare(grid).find((row) => row.key === key)!

describe('compareFooterTotals', () => {
  it('reads the sheet total from the row bearing the label, whatever row that is', () => {
    // Position varies per sheet — Białostocka's summary block sits under 435 prace, another sheet's
    // under 40. Only the label is stable.
    expect(byKey(BIALOSTOCKA_ROWS, 'plannedNet').sheetValue).toBe(143089.489)
    expect(byKey(BIALOSTOCKA_ROWS, 'executedNet').sheetValue).toBe(129036.359)
  })

  it('tolerates the double space the executed-total label actually carries', () => {
    // The sheet reads „R netto - suma prac  wykonannych " — two spaces and a trailing one.
    expect(byKey(BIALOSTOCKA_ROWS, 'executedNet').sheetValue).not.toBeNull()
  })

  it('computes the app total from the parsed prace, rabat included', () => {
    // 1×1500 −9% = 1365, 0×15 = 0, 2×120 = 240.
    expect(byKey(BIALOSTOCKA_ROWS, 'plannedNet').appValue).toBeCloseTo(1605, 6)
  })

  it('prices the executed total off the etap quantities, not Przedmiar', () => {
    // 1×1500 −9% = 1365, 50×15 −9% = 682,50, 2×120 = 240.
    expect(byKey(BIALOSTOCKA_ROWS, 'executedNet').appValue).toBeCloseTo(2287.5, 6)
  })

  it('flags a mismatch rather than blocking on it', () => {
    // The fixture's footer belongs to the full 435-row sheet, so it disagrees with three sample
    // rows by design — a mismatch is a reported delta, never a thrown error.
    const planned = byKey(BIALOSTOCKA_ROWS, 'plannedNet')

    expect(planned.matches).toBe(false)
    expect(planned.delta).toBeCloseTo(143089.489 - 1605, 6)
  })

  it('agrees when the sheet total matches to the grosz', () => {
    const grid = BIALOSTOCKA_ROWS.map((row) => [...row])
    const footer = grid.find((row) => String(row[16]).startsWith('wartość netto'))!
    footer[18] = 1605.004 // under one grosz off

    expect(byKey(grid, 'plannedNet')).toMatchObject({ matches: true })
  })

  it('reports a footer row it cannot find instead of passing it silently', () => {
    const withoutFooter = BIALOSTOCKA_ROWS.filter((row) => !String(row[16]).startsWith('R netto'))

    expect(byKey(withoutFooter, 'executedNet')).toMatchObject({
      sheetValue: null,
      delta: null,
      matchedAgainst: null,
    })
  })

  it('matches a footer row against the other figure when that is the one it agrees with', () => {
    // The owner's labels do not reliably say which figure a row holds — „wartość netto" sits over the
    // executed total on some sheets. Comparing each row only against its namesake reported a false
    // mismatch on a sheet that was in fact parsed correctly.
    const grid = BIALOSTOCKA_ROWS.map((row) => [...row])
    const planned = grid.find((row) => String(row[16]).startsWith('wartość netto'))!
    planned[18] = 2287.5 // the EXECUTED total for these three prace

    expect(byKey(grid, 'plannedNet')).toMatchObject({
      matches: true,
      matchedAgainst: 'executedNet',
    })
  })

  it('finds the summary figure when the owner merged it out of the Wartość netto column', () => {
    const grid = BIALOSTOCKA_ROWS.map((row) => [...row])
    const planned = grid.find((row) => String(row[16]).startsWith('wartość netto'))!
    planned[18] = ''
    planned[19] = 1605

    expect(byKey(grid, 'plannedNet')).toMatchObject({ sheetValue: 1605, matches: true })
  })
})
