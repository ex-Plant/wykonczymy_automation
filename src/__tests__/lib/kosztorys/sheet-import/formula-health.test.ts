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

  // Counted but never sampled (owner, 2026-08-14): on a blank offer sheet this is the normal state
  // of every row, so a row list would send the owner hunting through prace that are not wrong.
  it('counts a Pomiar copied straight from Przedmiar without listing the rows', () => {
    const health = scan({ 4: { O: '=N5' } })

    expect(health.measuredCopiedFromPlanned).toBe(1)
    expect(health.samples.plannedReadFromStage).toEqual([])
    expect(health.samples.errorValue).toEqual([])
  })

  it('leaves the sheet’s own Σ etapów alone', () => {
    // `=SUM(D:M)` is the canonical shape of a blank offer sheet. Reporting it would flag every row
    // of every sheet and teach the owner to ignore the whole block.
    expect(scan({ 4: { O: '=SUM(D5:M5)' } }).measuredCopiedFromPlanned).toBe(0)
  })

  it('lists a punctual row even when the collective class fills the sheet above it', () => {
    // The bug this splits the buckets for: a shared cap filled in row order let 241 mass-class rows
    // exhaust it before the 7 actionable ones were reached.
    const health = scan({ 4: { O: '=N5' }, 5: { O: '=N6' }, 7: { N: '=D8' } })

    expect(health.measuredCopiedFromPlanned).toBe(2)
    expect(health.samples.plannedReadFromStage).toEqual([
      { row: 8, description: 'montaż jednostki wewnętrznej', cell: 'N8' },
    ])
  })

  it('ignores a reference to a different row — only a self-copy is the anomaly', () => {
    expect(scan({ 4: { O: '=N4' } }).measuredCopiedFromPlanned).toBe(0)
  })

  it('reports a Przedmiar read out of an etap column', () => {
    const health = scan({ 7: { N: '=D8' } })

    expect(health.plannedReadFromStage).toBe(1)
    expect(health.samples.plannedReadFromStage[0]).toMatchObject({ row: 8, cell: 'N8' })
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
    expect(health.samples.errorValue[0]).toMatchObject({ row: 5, cell: 'Q5' })
  })

  it('says nothing about a sheet whose prace are all typed by hand', () => {
    expect(scan({})).toMatchObject({
      measuredCopiedFromPlanned: 0,
      plannedReadFromStage: 0,
      errorValues: 0,
      samples: { plannedReadFromStage: [], errorValue: [] },
    })
  })
})
