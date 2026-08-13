import { describe, expect, it } from 'vitest'
import {
  resolveRobocizna,
  resolveRates,
  type ResolveFailureT,
  type ResolvedRobociznaT,
  type ResolvedRatesT,
} from '@/lib/kosztorys/sheet-import/resolve-columns'
import {
  ALTOWA_ROBOCIZNA_HEADER,
  BIALOSTOCKA_RATES_HEADER,
  BIALOSTOCKA_ROBOCIZNA_HEADER,
  PRZEDPOLE_ROBOCIZNA_HEADER,
} from '@/__tests__/fixtures/kosztorys-sheet/header-blocks'

function expectResolved(
  result: ResolvedRobociznaT | ResolveFailureT,
): asserts result is ResolvedRobociznaT {
  if (!result.ok) expect.fail(`expected a resolved header, got: ${result.problems.join(' | ')}`)
}

function expectRatesResolved(
  result: ResolvedRatesT | ResolveFailureT,
): asserts result is ResolvedRatesT {
  if (!result.ok) expect.fail(`expected resolved rates, got: ${result.problems.join(' | ')}`)
}

describe('resolveRobocizna', () => {
  it('resolves the wide 10-etap layout', () => {
    const result = resolveRobocizna(BIALOSTOCKA_ROBOCIZNA_HEADER)
    expectResolved(result)

    expect(result.columns).toMatchObject({
      section: 0, // A
      description: 2, // C
      plannedQty: 13, // N — Przedmiar
      unit: 15, // P
      clientPrice: 16, // Q
      discount: 17, // R — rabat
      netValue: 18, // S — Wartość netto
    })
    expect(result.stages).toEqual({ firstColumn: 3, count: 10 }) // D–M
  })

  it('resolves a narrow layout where Przedmiar sits four columns earlier', () => {
    const result = resolveRobocizna(PRZEDPOLE_ROBOCIZNA_HEADER)
    expectResolved(result)

    expect(result.columns).toMatchObject({
      section: 0,
      description: 2,
      plannedQty: 9, // J, not N
      unit: 11, // L
      clientPrice: 12, // M
      discount: 13, // N — „rabat" here, not Przedmiar
      netValue: 14, // O
    })
    expect(result.stages).toEqual({ firstColumn: 3, count: 6 }) // D–I
  })

  it('finds stages by the „wykonano" marker even when row 3 renames them to crews', () => {
    // Row 3 reads „1 etap BRYGADA JEDEN" / „3 etap EKIPA DWA" — no „ilość" anywhere.
    const result = resolveRobocizna(PRZEDPOLE_ROBOCIZNA_HEADER)
    expectResolved(result)
    expect(result.stages.count).toBe(6)
  })

  it('does not mistake the wartość block for more etapy', () => {
    // Row 1 labels the money block identically to the qty block (V1 is =D1). Only row 2 differs.
    const result = resolveRobocizna(BIALOSTOCKA_ROBOCIZNA_HEADER)
    expectResolved(result)
    expect(result.stages.count).toBe(10) // not 20
  })

  it('resolves a layout where the money block is not adjacent to Wartość netto', () => {
    const result = resolveRobocizna(ALTOWA_ROBOCIZNA_HEADER)
    expectResolved(result)

    expect(result.columns).toMatchObject({ plannedQty: 13, netValue: 18 })
    expect(result.stages).toEqual({ firstColumn: 3, count: 10 })
  })

  it('reports the header text it matched, so the preview can show the mapping', () => {
    const result = resolveRobocizna(BIALOSTOCKA_ROBOCIZNA_HEADER)
    expectResolved(result)

    expect(result.matchedLabels.plannedQty).toBe('Przedmiar')
    expect(result.matchedLabels.unit).toBe('jednostka miary')
  })

  it('finds „Pomiar z natury" beside Przedmiar', () => {
    const result = resolveRobocizna(BIALOSTOCKA_ROBOCIZNA_HEADER)
    expectResolved(result)

    expect(result.columns.measuredQty).toBe(14)
  })

  it('imports a sheet with no „Pomiar z natury" column rather than refusing it', () => {
    const grid = BIALOSTOCKA_ROBOCIZNA_HEADER.map((row) => [...row])
    grid[0][14] = ''
    grid[2][14] = ''

    const result = resolveRobocizna(grid)
    expectResolved(result)
    expect(result.columns.measuredQty).toBeUndefined()
  })

  it('treats a missing rabat column as fine — some sheets genuinely have none', () => {
    const grid = BIALOSTOCKA_ROBOCIZNA_HEADER.map((row) => [...row])
    grid[0][17] = '' // blank out „rabat"

    const result = resolveRobocizna(grid)
    expectResolved(result)
    expect(result.columns.discount).toBeUndefined()
  })

  it('fails by naming the missing column rather than throwing', () => {
    const grid = BIALOSTOCKA_ROBOCIZNA_HEADER.map((row) => [...row])
    grid[0][16] = '' // „Cena j.m." on row 1
    grid[2][16] = '' // „cena j.m." on row 3

    const result = resolveRobocizna(grid)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problems.join(' ')).toContain('Cena j.m.')
  })

  it('fails when a required column matches twice, instead of picking the leftmost', () => {
    const grid = BIALOSTOCKA_ROBOCIZNA_HEADER.map((row) => [...row])
    grid[0][19] = 'Przedmiar' // a second one at T

    const result = resolveRobocizna(grid)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problems.join(' ')).toContain('Przedmiar')
  })

  it('fails when no row carries the „wykonano" marker', () => {
    const grid = BIALOSTOCKA_ROBOCIZNA_HEADER.map((row) => [...row])
    grid[1] = grid[1].map((cell) => (cell === 'wykonano' ? '' : cell))

    const result = resolveRobocizna(grid)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problems.join(' ')).toContain('wykonano')
  })
})

describe('resolveRates', () => {
  it('separates the two rate columns from the client price they share a label with', () => {
    // „cena j.m." appears at P (client price), R (z narzędziami) and T (bez narzędzi).
    const result = resolveRates(BIALOSTOCKA_RATES_HEADER)
    expectRatesResolved(result)

    expect(result.columns).toMatchObject({
      description: 1, // B — the rates tabs have no section column
      wToolsRate: 17, // R, under „cennik z narzędziami"
      ownToolsRate: 19, // T, under „cennik bez narzędzi"
    })
  })

  it('matches a banner typed without Polish diacritics', () => {
    // Białostocka's „z narzędziami" tab spells its own banner „cennik z narzedziami" — the same
    // sheet, one tab over, spells it with the ę.
    const grid = BIALOSTOCKA_RATES_HEADER.map((row) => [...row])
    for (const rowIndex of [0, 1]) {
      grid[rowIndex] = grid[rowIndex].map((cell) =>
        cell === 'cennik z narzędziami ' ? 'cennik z narzedziami' : cell,
      )
    }

    const result = resolveRates(grid)
    expectRatesResolved(result)
    expect(result.columns.wToolsRate).toBe(17)
  })

  it('matches banners named by who does the work rather than by tooling', () => {
    // Altowa splits the price lists as „podwykonawca" / „pracownik" — same two lists, other axis.
    const grid = BIALOSTOCKA_RATES_HEADER.map((row) => [...row])
    for (const rowIndex of [0, 1]) {
      grid[rowIndex] = grid[rowIndex].map((cell) =>
        cell === 'cennik z narzędziami '
          ? 'cennik podwykonawca'
          : cell === 'cennik bez narzędzi '
            ? 'cennik pracownik '
            : cell,
      )
    }

    const result = resolveRates(grid)
    expectRatesResolved(result)
    expect(result.columns).toMatchObject({ wToolsRate: 17, ownToolsRate: 19 })
  })

  it('finds a banner that sits on row 2 only', () => {
    const grid = BIALOSTOCKA_RATES_HEADER.map((row) => [...row])
    grid[0][17] = '' // R1
    grid[0][18] = '' // S1 — the banner survives on row 2 alone

    const result = resolveRates(grid)
    expectRatesResolved(result)
    expect(result.columns.wToolsRate).toBe(17)
  })

  it('fails when a rate group is missing rather than falling back to the client price', () => {
    const grid = BIALOSTOCKA_RATES_HEADER.map((row) => [...row])
    grid[0][19] = '' // „cennik bez narzędzi" group label at T
    grid[0][20] = ''

    const result = resolveRates(grid)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.problems.join(' ')).toContain('bez narzędzi')
  })
})
