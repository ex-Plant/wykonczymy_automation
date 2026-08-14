import { describe, expect, it } from 'vitest'
import { buildImportPlan } from '@/lib/kosztorys/sheet-import/build-import-plan'
import { fold } from '@/lib/kosztorys/sheet-import/columns'
import type { ImportGridsT } from '@/lib/kosztorys/sheet-import/read-sheet'
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import { BIALOSTOCKA_ROWS, ratesTab } from '@/__tests__/fixtures/kosztorys-sheet/rows'

const RATES = [
  { description: 'zakup, transport i wniesienie towaru budowlanego', wTools: 975, ownTools: 750 },
  { description: 'montaż płyt akustycznych dodatek', wTools: 9.75, ownTools: 7.5 },
  { description: 'montaż jednostki wewnętrznej', wTools: 78, ownTools: 60 },
]

const source = (overrides: Partial<ImportGridsT> = {}): ImportGridsT => ({
  robocizna: BIALOSTOCKA_ROWS,
  robociznaFormulas: [],
  robociznaGid: 70964819,
  rateTabs: [ratesTab('zakres pracy z narzędziami', RATES)],
  ...overrides,
})

// A minimal current tree: one section, one praca, six etapy, settings the import must not touch.
function currentTree(overrides: Partial<SnapshotPayloadT> = {}): SnapshotPayloadT {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sections: [{ id: 7, name: 'Klimatyzacja', displayOrder: 0, color: 'blue' }],
    items: [
      {
        id: 70,
        sectionId: 7,
        displayOrder: 0,
        description: 'montaż jednostki wewnętrznej',
        unit: 'szt.',
        plannedQty: 9,
        sheetMeasuredQty: 99,
        discountType: null,
        discountValue: 0,
        clientPrice: 999,
        wToolsOverrideType: null,
        wToolsOverrideValue: 0,
        ownToolsOverrideType: null,
        ownToolsOverrideValue: 0,
        hiddenInExport: false,
        note: 'ustalone z klientem',
      },
    ],
    stages: Array.from({ length: 6 }, (_, index) => ({
      id: 700 + index,
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

function plan(grids: ImportGridsT = source(), current: SnapshotPayloadT = currentTree()) {
  const built = buildImportPlan(grids, current)
  if (!built.ok) expect.fail(`plan did not build: ${built.problems.join(' | ')}`)
  return built
}

describe('buildImportPlan', () => {
  it('builds the sheet tree — sections, prace and etapy', () => {
    const { tree, report } = plan()

    expect(tree.sections.map((section) => section.name)).toContain('Prace dodatkowe')
    expect(tree.stages).toHaveLength(10)
    expect(report.counts).toMatchObject({ sections: 2, items: 3, stages: 10 })
  })

  it('carries the investment’s own settings through instead of the defaults', () => {
    // `restoreKosztorys` rewrites VAT and both coefficients from whatever payload it is handed, so
    // anything but a copy here silently resets figures the sheet has no opinion about.
    expect(plan().tree.settings).toEqual({ wToolsCoeff: 0.71, ownToolsCoeff: 0.42, vatRate: 8 })
  })

  it('turns each praca’s resolved rates into per-item overrides', () => {
    const { tree } = plan()
    const item = tree.items.find((row) => row.description === 'montaż jednostki wewnętrznej')!

    // 78 / 120 = 0,65 — a coefficient, so the rate tracks a later client-price edit.
    expect(item).toMatchObject({ wToolsOverrideType: 'coeff', wToolsOverrideValue: 0.65 })
    expect(item).toMatchObject({ ownToolsOverrideType: 'coeff', ownToolsOverrideValue: 0.5 })
  })

  it('freezes a praca absent from the rate tabs at a flat zero, never at the global coefficient', () => {
    const { tree, report } = plan(
      source({ rateTabs: [ratesTab('zakres pracy z narzędziami', RATES.slice(1))] }),
    )
    const item = tree.items.find((row) => row.description === RATES[0].description)!

    expect(item).toMatchObject({ wToolsOverrideType: 'amount', wToolsOverrideValue: 0 })
    // Reported as a count, not per praca: on a sheet whose cenniki fail to resolve every praca is
    // missing, and the per-praca list would drown the real disagreements it exists to show.
    expect(report.warnings).toContain('1 prac nie ma w żadnym cenniku — wejdą ze stawką 0 zł.')
  })

  it('refuses the import outright when no cennik could be read', () => {
    // Regression: with zero resolvable „zakres pracy" tabs the loop that collects warnings never ran,
    // so nothing was reported — and `deriveOverride(0, price)` then wrote a flat 0 zł subcontractor
    // cost onto EVERY praca behind an enabled confirm. A refusal is the only honest answer: a 0 zł
    // rate is indistinguishable in the editor from one the owner meant.
    const built = buildImportPlan(source({ rateTabs: [] }), currentTree())

    expect(built.ok).toBe(false)
    expect(built.ok ? [] : built.problems[0]).toMatch(/cennik/)
  })

  it('says which tab it skipped when that tab is the only cennik', () => {
    const broken = ratesTab('zakres pracy z narzędziami', RATES)
    broken.grid[1] = [] // wipe the banner row the rate resolver keys off

    const built = buildImportPlan(source({ rateTabs: [broken] }), currentTree())

    expect(built.ok).toBe(false)
    expect(built.ok ? '' : built.problems.join(' ')).toContain('zakres pracy z narzędziami')
  })

  it('retains a praca the sheet no longer has, with its own values', () => {
    const current = currentTree()
    current.items[0].description = 'demontaż starej klimatyzacji'

    const { tree, report } = plan(source(), current)
    const retained = tree.items.find((row) => row.description === 'demontaż starej klimatyzacji')

    expect(retained).toMatchObject({ plannedQty: 9, clientPrice: 999 })
    expect(report.retained).toEqual([
      { section: 'Klimatyzacja', description: 'demontaż starej klimatyzacji' },
    ])
  })

  it('puts a retained praca last in its section so the sheet’s order survives', () => {
    const current = currentTree()
    current.items[0].description = 'demontaż starej klimatyzacji'

    const { tree } = plan(source(), current)
    const section = tree.sections.find((row) => row.name === 'Klimatyzacja')!
    const inSection = tree.items
      .filter((row) => row.sectionId === section.id)
      .sort((a, b) => a.displayOrder - b.displayOrder)

    expect(inSection.at(-1)?.description).toBe('demontaż starej klimatyzacji')
  })

  it('retains a whole section the sheet dropped, after the sheet’s own sections', () => {
    const current = currentTree()
    current.sections[0].name = 'Ogrzewanie podłogowe'

    const { tree } = plan(source(), current)

    expect(tree.sections.map((section) => section.name)).toEqual([
      'Prace dodatkowe',
      'Klimatyzacja',
      'Ogrzewanie podłogowe',
    ])
  })

  it('keeps a matched praca’s note — the sheet has no column for it', () => {
    const item = plan().tree.items.find(
      (row) => row.description === 'montaż jednostki wewnętrznej',
    )!

    expect(item.note).toBe('ustalone z klientem')
    // Everything the sheet DOES carry still comes from the sheet.
    expect(item).toMatchObject({ plannedQty: 2, clientPrice: 120 })
  })

  it('overwrites a matched praca’s reference figure with what the sheet now says', () => {
    // The opposite of `note`: the figure IS the sheet's claim, so a re-import must revive a
    // rozjazd the owner dismissed if the sheet still disagrees.
    const item = plan().tree.items.find(
      (row) => row.description === 'montaż jednostki wewnętrznej',
    )!

    expect(item.sheetMeasuredQty).toBe(2)
  })

  it('leaves a retained praca’s reference figure alone — no sheet row overwrote it', () => {
    const current = currentTree()
    current.items[0].description = 'demontaż starej klimatyzacji'

    const retained = plan(source(), current).tree.items.find(
      (row) => row.description === 'demontaż starej klimatyzacji',
    )!

    expect(retained.sheetMeasuredQty).toBe(99)
  })

  it('drops a retained praca’s wykonano for etapy the sheet no longer has', () => {
    const current = currentTree({
      stages: Array.from({ length: 12 }, (_, index) => ({
        id: 700 + index,
        ordinal: index + 1,
        label: null,
        plane: null,
        workerId: null,
      })),
    })
    current.items[0].description = 'demontaż starej klimatyzacji'
    current.progress = [
      { itemId: 70, stageId: 700, qtyDone: 3 }, // etap 1 — survives
      { itemId: 70, stageId: 711, qtyDone: 4 }, // etap 12 — the sheet has 10
    ]

    const { tree } = plan(source(), current)
    const retained = tree.items.find((row) => row.description === 'demontaż starej klimatyzacji')!
    const kept = tree.progress.filter((entry) => entry.itemId === retained.id)

    expect(kept).toHaveLength(1)
    expect(tree.stages.find((stage) => stage.id === kept[0].stageId)?.ordinal).toBe(1)
  })

  it('refuses to build a tree when a column cannot be resolved', () => {
    // Dąbrowskiego 86: the „Przedmiar" header cell was typed over with a message to the client.
    const broken = BIALOSTOCKA_ROWS.map((row, index) =>
      index < 3
        ? row.map((cell) => (fold(cell) === 'przedmiar' ? 'Przesyłam wstępny kosztorys.' : cell))
        : row,
    )

    const built = buildImportPlan(source({ robocizna: broken }), currentTree())

    expect(built.ok).toBe(false)
    expect(built.ok === false && built.problems.join(' ')).toContain('Przedmiar')
  })

  it('reports the footer comparison alongside the counts', () => {
    expect(plan().report.totals.map((total) => total.key)).toEqual(['plannedNet', 'executedNet'])
  })
})
