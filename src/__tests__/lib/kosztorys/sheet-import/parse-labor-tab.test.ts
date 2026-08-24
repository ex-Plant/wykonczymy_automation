import { describe, expect, it } from 'vitest'
import { parseLaborTab } from '@/lib/kosztorys/sheet-import/parse-labor-tab'
import { resolveLaborColumns } from '@/lib/kosztorys/sheet-import/resolve-columns'
import { fold } from '@/lib/kosztorys/sheet-import/columns'
import { BIALOSTOCKA_ROWS, PRZEDPOLE_ROWS } from '@/__tests__/fixtures/kosztorys-sheet/rows'

function parse(grid: (string | number)[][], formulas: (string | number)[][] = []) {
  const resolved = resolveLaborColumns(grid)
  if (!resolved.ok) expect.fail(`fixture header did not resolve: ${resolved.problems.join(' | ')}`)
  return parseLaborTab(grid, resolved, formulas)
}

const POMIAR_COLUMN = 14 // O on Białostocka

describe('parseLaborTab', () => {
  it('groups prace under the section header that precedes them', () => {
    const { sections, items } = parse(BIALOSTOCKA_ROWS)

    expect(sections.map((section) => section.name)).toEqual(['Prace dodatkowe', 'Klimatyzacja'])
    expect(items).toHaveLength(3)
    expect(items.filter((item) => item.sectionId === sections[0].id)).toHaveLength(2)
  })

  it('does not turn a section header into a praca', () => {
    const { items } = parse(BIALOSTOCKA_ROWS)
    expect(items.map((item) => item.description)).not.toContain('Klimatyzacja')
  })

  it('stops at the footer instead of importing it as prace', () => {
    // Footer rows carry the same „x" marker a section header does — only the missing name tells
    // them apart. Reading them would add „wartość netto" as a section and its 143 089 zł as data.
    const { sections, items } = parse(BIALOSTOCKA_ROWS)

    expect(sections.map((section) => section.name)).not.toContain('wartość netto')
    expect(items.some((item) => item.clientPrice > 100_000)).toBe(false)
  })

  it('reads rabat as a fraction and stores it as a percentage', () => {
    const { items } = parse(BIALOSTOCKA_ROWS)
    const item = items[0]

    expect(item.discountType).toBe('percent')
    expect(item.discountValue).toBe(9) // 0,09 in the sheet
  })

  it('leaves a praca without rabat undiscounted rather than at 0%', () => {
    const { items } = parse(BIALOSTOCKA_ROWS)
    const item = items[2] // „montaż jednostki wewnętrznej" — no R cell

    expect(item.discountType).toBeNull()
    expect(item.discountValue).toBe(0)
  })

  it('emits one wykonano entry per non-zero etap cell', () => {
    const { items, progress } = parse(BIALOSTOCKA_ROWS)
    const first = items[0]

    expect(progress.filter((entry) => entry.itemId === first.id)).toEqual([
      { itemId: first.id, stageId: 1, qtyDone: 0.5 },
      { itemId: first.id, stageId: 2, qtyDone: 0.25 },
      { itemId: first.id, stageId: 3, qtyDone: 0.25 },
    ])
  })

  it('keeps a praca whose Przedmiar is 0 but which has executed quantity', () => {
    const { items, progress } = parse(BIALOSTOCKA_ROWS)
    const item = items[1]

    expect(item.plannedQty).toBe(0)
    expect(progress.filter((entry) => entry.itemId === item.id)).toEqual([
      { itemId: item.id, stageId: 3, qtyDone: 50 },
    ])
  })

  it('emits every resolved etap, not only those carrying quantity', () => {
    // An etap planned but not started is still an etap: taking the count from the data would drop
    // the empty trailing ones and silently shrink the kosztorys.
    const { stages } = parse(BIALOSTOCKA_ROWS)

    expect(stages).toHaveLength(10)
    expect(stages.map((stage) => stage.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('imports no stage labels, planes or workers — the sheet is not their source', () => {
    const { stages } = parse(BIALOSTOCKA_ROWS)
    expect(stages.every((stage) => !stage.label && !stage.plane && !stage.workerId)).toBe(true)
  })

  it('reads the narrow layout off its own resolved columns', () => {
    const { sections, items, stages } = parse(PRZEDPOLE_ROWS)

    expect(sections).toHaveLength(1)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ unit: 'kpl', clientPrice: 1500, plannedQty: 1 })
    expect(items[0].discountValue).toBe(5)
    expect(stages).toHaveLength(6)
  })

  it('keeps reading past a blank spacer row that looks exactly like the footer', () => {
    // Regression: the parser used to stop at the FIRST marked-and-unnamed row, which a spacer row
    // between two sections also is — so a sheet with one blank divider imported only the prace above
    // it and reported the rest as „nie ma w arkuszu", i.e. silently truncated.
    const grid = [...BIALOSTOCKA_ROWS]
    const spacer = grid.at(-1)!.map(() => '')
    spacer[13] = 'x' // Przedmiar column, no name anywhere — the footer's own shape
    grid.splice(4, 0, spacer)

    const { items } = parse(grid)
    expect(items.map((item) => item.description)).toContain('montaż jednostki wewnętrznej')
  })

  it('does not make a section out of a footer label typed into the opis column', () => {
    // The owner sometimes puts „wartość netto" in the description column rather than beside it. It
    // carries the same „x" marker a section header does, so it used to open a section and adopt
    // every praca below it.
    const grid = [...BIALOSTOCKA_ROWS]
    const stray = grid.at(-1)!.map(() => '')
    stray[13] = 'x'
    stray[2] = 'wartość netto przedmiar'
    grid.splice(4, 0, stray)

    const { sections } = parse(grid)
    expect(sections.map((section) => section.name)).toEqual(['Prace dodatkowe', 'Klimatyzacja'])
  })

  it('reads a rabat typed as a whole percent as that percent, not as a 900% discount', () => {
    // The column holds fractions (0,09), but the owner types „9" into it often enough that treating
    // every value as a fraction priced those prace deeply negative.
    const grid = BIALOSTOCKA_ROWS.map((row) => [...row])
    grid[4][17] = 9

    expect(parse(grid).items[0].discountValue).toBe(9)
  })

  it('counts the rows above the first section instead of dropping them in silence', () => {
    const grid = [...BIALOSTOCKA_ROWS]
    const orphan: (string | number)[] = grid[4].map(() => '')
    orphan[2] = 'praca bez sekcji'
    orphan[13] = 3
    grid.splice(3, 0, orphan)

    const { items, skippedBeforeFirstSection } = parse(grid)
    expect(skippedBeforeFirstSection).toBe(1)
    expect(items.map((item) => item.description)).not.toContain('praca bez sekcji')
  })

  it('keeps a hand-typed „Pomiar z natury" as the reference figure', () => {
    expect(parse(BIALOSTOCKA_ROWS).items.map((item) => item.sheetMeasuredQty)).toEqual([1, 50, 2])
  })

  it('reads a „Pomiar z natury" computed from the etapy as no claim at all', () => {
    // The blank offer sheet sums the etapy in every row of that column, so its value IS Σ etapów.
    // Storing it would set up a comparison of Σ etapów against itself.
    const formulas = BIALOSTOCKA_ROWS.map((row) => {
      const blank = row.map(() => '')
      blank[POMIAR_COLUMN] = '=SUM(D3:M3)'
      return blank
    })

    expect(
      parse(BIALOSTOCKA_ROWS, formulas).items.every((item) => item.sheetMeasuredQty === null),
    ).toBe(true)
  })

  it('refuses the stage sum written as a whole-column range too', () => {
    const formulas = BIALOSTOCKA_ROWS.map((row) => {
      const blank = row.map(() => '')
      blank[POMIAR_COLUMN] = '=SUM(D:M)'
      return blank
    })

    expect(
      parse(BIALOSTOCKA_ROWS, formulas).items.every((item) => item.sheetMeasuredQty === null),
    ).toBe(true)
  })

  it('keeps a „Pomiar z natury" the sheet computed some other way', () => {
    // `=N5` mirrors the Przedmiar. Whatever produced the number, it is the owner's claim about what
    // was measured — and against Σ etapów that is a real comparison, not a tautology.
    const formulas = BIALOSTOCKA_ROWS.map((row) => {
      const blank = row.map(() => '')
      blank[POMIAR_COLUMN] = '=N5'
      return blank
    })

    expect(parse(BIALOSTOCKA_ROWS, formulas).items.map((item) => item.sheetMeasuredQty)).toEqual([
      1, 50, 2,
    ])
  })

  it('reads an empty „Pomiar z natury" as no claim, not as a measurement of zero', () => {
    const grid = BIALOSTOCKA_ROWS.map((row) => [...row])
    grid[4][POMIAR_COLUMN] = ''

    expect(parse(grid).items[0].sheetMeasuredQty).toBeNull()
  })

  it('imports a sheet with no „Pomiar z natury" column at all', () => {
    const grid = BIALOSTOCKA_ROWS.map((row, index) =>
      index < 3 ? row.map((cell) => (fold(cell) === 'pomiar z natury' ? '' : cell)) : row,
    )

    const { items } = parse(grid)
    expect(items).toHaveLength(3)
    expect(items.every((item) => item.sheetMeasuredQty === null)).toBe(true)
  })

  it('gives every section a colour by position, as the editor does', () => {
    const { sections } = parse(BIALOSTOCKA_ROWS)
    expect(sections.every((section) => section.color !== null)).toBe(true)
    expect(sections[0].color).not.toBe(sections[1].color)
  })
})
