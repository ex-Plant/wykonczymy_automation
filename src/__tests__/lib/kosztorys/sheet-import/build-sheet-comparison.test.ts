import { describe, expect, it } from 'vitest'
import { buildSheetComparison } from '@/lib/kosztorys/sheet-import/build-sheet-comparison'
import { fold } from '@/lib/kosztorys/sheet-import/columns'
import type { ImportGridsT } from '@/lib/kosztorys/sheet-import/read-sheet'
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import type { KosztorysItemT } from '@/lib/kosztorys/types'
import { row } from '@/__tests__/fixtures/kosztorys-sheet/grid'
import { BIALOSTOCKA_ROWS, ratesTab } from '@/__tests__/fixtures/kosztorys-sheet/rows'

const source = (overrides: Partial<ImportGridsT> = {}): ImportGridsT => ({
  robocizna: BIALOSTOCKA_ROWS,
  robociznaFormulas: [],
  rateTabs: [ratesTab('zakres pracy z narzędziami', [])],
  ...overrides,
})

const item = (overrides: Partial<KosztorysItemT> & { id: number }): KosztorysItemT => ({
  sectionId: 1,
  displayOrder: 0,
  description: null,
  unit: null,
  plannedQty: 0,
  sheetMeasuredQty: null,
  discountType: null,
  discountValue: 0,
  clientPrice: 0,
  wToolsOverrideType: null,
  wToolsOverrideValue: 0,
  ownToolsOverrideType: null,
  ownToolsOverrideValue: 0,
  hiddenInExport: false,
  note: null,
  ...overrides,
})

// The app side of Białostocka: the same three prace under the same two sections, so a default
// comparison matches everything and a test can break exactly one thing at a time.
function currentTree(overrides: Partial<SnapshotPayloadT> = {}): SnapshotPayloadT {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sections: [
      { id: 1, name: 'Prace dodatkowe', displayOrder: 0, color: 'blue' },
      { id: 2, name: 'Klimatyzacja', displayOrder: 1, color: 'green' },
    ],
    items: [
      item({
        id: 10,
        sectionId: 1,
        description: 'zakup, transport i wniesienie towaru budowlanego',
        plannedQty: 1,
        clientPrice: 1500,
        discountType: 'percent',
        discountValue: 9,
      }),
      item({
        id: 11,
        sectionId: 1,
        displayOrder: 1,
        description: 'montaż płyt akustycznych dodatek',
        plannedQty: 0,
        clientPrice: 15,
        discountType: 'percent',
        discountValue: 9,
      }),
      item({
        id: 12,
        sectionId: 2,
        description: 'montaż jednostki wewnętrznej',
        plannedQty: 2,
        clientPrice: 120,
      }),
    ],
    stages: Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      ordinal: index + 1,
      label: null,
      plane: null,
      workerId: null,
    })),
    progress: [],
    settings: { wToolsCoeff: 0.71, ownToolsCoeff: 0.42, vatRate: 8 },
    ...overrides,
  }
}

function compare(grids: ImportGridsT = source(), current: SnapshotPayloadT = currentTree()) {
  const built = buildSheetComparison(grids, current)
  if (!built.ok) expect.fail(`comparison did not build: ${built.problems.join(' | ')}`)
  return built.comparison
}

describe('buildSheetComparison', () => {
  it('matches every praca the two sides share', () => {
    const { counts, onlyInSheet, onlyInApp } = compare()

    expect(counts).toEqual({ sheetItems: 3, appItems: 3, matched: 3 })
    expect(onlyInSheet).toEqual([])
    expect(onlyInApp).toEqual([])
  })

  it('shows a renamed praca on BOTH lists — identity is the name, so it cannot say „renamed"', () => {
    const current = currentTree()
    current.items[2].description = 'montaż jednostki wewnętrznej (piętro)'

    const { onlyInSheet, onlyInApp, counts } = compare(source(), current)

    expect(onlyInSheet).toEqual([
      { section: 'Klimatyzacja', description: 'montaż jednostki wewnętrznej' },
    ])
    expect(onlyInApp).toEqual([
      { section: 'Klimatyzacja', description: 'montaż jednostki wewnętrznej (piętro)' },
    ])
    expect(counts.matched).toBe(2)
  })

  it('reckons both sides through calc, agreeing when the app holds the same prace', () => {
    const { totals } = compare()

    // The offer: 1×1500−9% + 0×15 + 2×120 = 1605.
    expect(totals.plannedNetFromSheet).toBeCloseTo(1605, 6)
    expect(totals.plannedNetFromApp).toBeCloseTo(totals.plannedNetFromSheet, 6)
    // The sheet's etapy carry work the app knows nothing about yet.
    expect(totals.executedNetFromSheet).toBeGreaterThan(0)
    expect(totals.executedNetFromApp).toBe(0)
  })

  it('still compares a sheet whose cennik cannot be read — the import refuses, this does not', () => {
    // Rates only ever feed the subcontractor overrides, and the comparison reads none. This is the
    // sheet that most needs diagnosing, so a refusal here would blank the diagnosis.
    expect(buildSheetComparison(source({ rateTabs: [] }), currentTree()).ok).toBe(true)
  })

  it('refuses only when the robocizna columns themselves cannot be located', () => {
    const broken = BIALOSTOCKA_ROWS.map((cells, index) =>
      index < 3
        ? cells.map((cell) => (fold(cell) === 'przedmiar' ? 'Przesyłam wstępny kosztorys.' : cell))
        : cells,
    )

    const built = buildSheetComparison(source({ robocizna: broken }), currentTree())

    expect(built.ok).toBe(false)
    expect(built.ok === false && built.problems.join(' ')).toContain('Przedmiar')
  })

  it('counts a reference quantity only where the sheet typed the Pomiar by hand', () => {
    // Row 5's Pomiar is the formula `=N5`: a copied offer, not a measurement, so „Rozjazd" has
    // nothing to say about that praca.
    const formulas = BIALOSTOCKA_ROWS.map((_, index) => (index === 4 ? row({ O: '=N5' }) : []))

    expect(compare(source({ robociznaFormulas: formulas })).referenceQty).toEqual({
      matched: 3,
      withValue: 2,
    })
  })

  it('carries the sheet’s own footer check and the formula scan through', () => {
    const comparison = compare()

    expect(comparison.footer.map((total) => total.key)).toEqual(['plannedNet', 'executedNet'])
    expect(comparison.health.totalRows).toBe(3)
  })
})
