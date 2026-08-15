import { describe, expect, it } from 'vitest'
import { compareFooterTotals } from '@/lib/kosztorys/sheet-import/footer-totals'
import { parseLaborTab } from '@/lib/kosztorys/sheet-import/parse-labor-tab'
import { resolveLaborColumns } from '@/lib/kosztorys/sheet-import/resolve-columns'
import { BIALOSTOCKA_ROWS } from '@/__tests__/fixtures/kosztorys-sheet/rows'

function compare(grid: (string | number)[][]) {
  const resolved = resolveLaborColumns(grid)
  if (!resolved.ok) expect.fail(`fixture header did not resolve: ${resolved.problems.join(' | ')}`)
  return compareFooterTotals(grid, resolved, parseLaborTab(grid, resolved, []))
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

  it('prices „wartość netto" off the sheet\'s own Pomiar, not off Przedmiar', () => {
    // The row it faces sums the sheet's Pomiar column, so the app side has to sum the same column:
    // 1×1500 −9% = 1365, 50×15 −9% = 682,50, 2×120 = 240. Przedmiar would give 1605 — a figure the
    // sheet never totals anywhere, and pairing them reported a difference on a perfect parse.
    expect(byKey(BIALOSTOCKA_ROWS, 'plannedNet').appValue).toBeCloseTo(2287.5, 6)
  })

  it('matches a „wartość netto" that only the Pomiar sum can explain', () => {
    // Pomiar 3 against one etap of 1 — the state the two stored figures cannot reach: neither
    // Przedmiar (1605) nor the etapy (2287,50) equals what the sheet totals here.
    const grid = BIALOSTOCKA_ROWS.map((row) => [...row])
    grid.find((row) => row[2] === 'zakup, transport i wniesienie towaru budowlanego')![14] = 3
    grid.find((row) => String(row[16]).startsWith('wartość netto'))![18] = 5017.5

    expect(byKey(grid, 'plannedNet')).toMatchObject({
      matches: true,
      matchedAgainst: 'measuredNet',
    })
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
    expect(planned.delta).toBeCloseTo(143089.489 - 2287.5, 6)
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
