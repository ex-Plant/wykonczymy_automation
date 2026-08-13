import { describe, expect, it } from 'vitest'
import { scanFormulaHealth } from '@/lib/kosztorys/sheet-import/formula-health'
import { parseRobocizna } from '@/lib/kosztorys/sheet-import/parse-robocizna'
import { resolveRobocizna } from '@/lib/kosztorys/sheet-import/resolve-columns'
import { col, row } from '@/__tests__/fixtures/kosztorys-sheet/grid'
import { BIALOSTOCKA_ROWS } from '@/__tests__/fixtures/kosztorys-sheet/rows'

// Białostocka's three prace sit at grid indices 4, 5 and 7 — sheet rows 5, 6 and 8. Przedmiar is N,
// Pomiar z natury is O, the etapy run D–M.
const resolved = () => {
  const outcome = resolveRobocizna(BIALOSTOCKA_ROWS)
  if (!outcome.ok) expect.fail(`header did not resolve: ${outcome.problems.join(' | ')}`)
  return outcome
}

function scan(
  formulasByIndex: Record<number, Record<string, string>>,
  grid: unknown[][] = BIALOSTOCKA_ROWS,
) {
  const columns = resolved()
  const formulas = BIALOSTOCKA_ROWS.map((_, index) =>
    formulasByIndex[index] ? row(formulasByIndex[index]) : [],
  )
  const { footerStart } = parseRobocizna(BIALOSTOCKA_ROWS, columns, formulas)
  return scanFormulaHealth(grid, formulas, columns, footerStart)
}

describe('scanFormulaHealth', () => {
  it('counts only the prace, never the section headers or the footer', () => {
    expect(scan({}).totalRows).toBe(3)
  })

  it('reports a Pomiar copied straight from Przedmiar', () => {
    const health = scan({ 4: { O: '=N5' } })

    expect(health.measuredCopiedFromPlanned).toBe(1)
    expect(health.samples).toEqual([
      {
        row: 5,
        description: 'zakup, transport i wniesienie towaru budowlanego',
        klass: 'measuredCopiedFromPlanned',
      },
    ])
  })

  it('leaves the sheet’s own Σ etapów alone', () => {
    // `=SUM(D:M)` is the canonical shape of a blank offer sheet. Reporting it would flag every row
    // of every sheet and teach the owner to ignore the whole block.
    expect(scan({ 4: { O: '=SUM(D5:M5)' } })).toMatchObject({
      measuredCopiedFromPlanned: 0,
      samples: [],
    })
  })

  it('ignores a reference to a different row — only a self-copy is the anomaly', () => {
    expect(scan({ 4: { O: '=N4' } }).measuredCopiedFromPlanned).toBe(0)
  })

  it('reports a Przedmiar read out of an etap column', () => {
    const health = scan({ 7: { N: '=D8' } })

    expect(health.plannedReadFromStage).toBe(1)
    expect(health.samples[0]).toMatchObject({ row: 8, klass: 'plannedReadFromStage' })
  })

  it('leaves hand-typed arithmetic alone in both columns', () => {
    // Both taken from the anomaly scan of the owner's sheet: the owner adding up two measurements
    // by hand is work, not a broken formula.
    expect(scan({ 4: { N: '=219,25+21,75' }, 5: { F: '=600-70-60' } })).toMatchObject({
      plannedReadFromStage: 0,
      measuredCopiedFromPlanned: 0,
    })
  })

  it('reports an error value the unformatted read hands over as a string', () => {
    // `#REF!` arrives as a string and `Number('#REF!') || 0` silently prices the praca at zero.
    const broken = BIALOSTOCKA_ROWS.map((cells) => [...cells])
    broken[4][col('Q')] = '#REF!'

    const health = scan({}, broken)

    expect(health.errorValues).toBe(1)
    expect(health.samples[0]).toMatchObject({ row: 5, klass: 'errorValue' })
  })

  it('says nothing about a sheet whose prace are all typed by hand', () => {
    expect(scan({})).toMatchObject({
      measuredCopiedFromPlanned: 0,
      plannedReadFromStage: 0,
      errorValues: 0,
      samples: [],
    })
  })
})
