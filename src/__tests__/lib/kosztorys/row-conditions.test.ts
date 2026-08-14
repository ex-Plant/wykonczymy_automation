import { describe, expect, it } from 'vitest'
import {
  ROW_CONDITIONS,
  countMatching,
  rowsMatchingConditions,
  sectionIdsWhereAllMatch,
} from '@/lib/kosztorys/row-conditions'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

const STAGES: KosztorysStageT[] = [
  { id: 1, ordinal: 1, label: null, plane: null, workerId: null },
  { id: 2, ordinal: 2, label: null, plane: 'w_tools', workerId: 5 },
]
const CTX = { stages: STAGES }

function row(overrides: Partial<KosztorysV2RowT> = {}): KosztorysV2RowT {
  return {
    id: 1,
    sectionId: 10,
    displayOrder: 0,
    description: 'Posadzki z mikrocementu',
    unit: 'm2',
    plannedQty: 95,
    sheetMeasuredQty: null,
    discountType: null,
    discountValue: 0,
    clientPrice: 100,
    wToolsOverrideType: null,
    wToolsOverrideValue: 0,
    ownToolsOverrideType: null,
    ownToolsOverrideValue: 0,
    hiddenInExport: false,
    note: null,
    sectionName: 'Podłogi',
    sectionColor: null,
    vatRate: 0.08,
    globalDiscountActive: false,
    globalWToolsCoeff: 0.65,
    globalOwnToolsCoeff: 0.5,
    [stageKey(1)]: 0,
    [stageKey(2)]: 0,
    ...overrides,
  } as KosztorysV2RowT
}

const matches = (conditionId: string, subject: KosztorysV2RowT) =>
  countMatching([subject], conditionId, CTX) === 1

describe('the four conditions, each on its boundary', () => {
  it('„bez przedmiaru" reads a cleared cell and a zero alike, but not a real quantity', () => {
    expect(matches('no-planned-qty', row({ plannedQty: 0 }))).toBe(true)
    expect(matches('no-planned-qty', row({ plannedQty: null as unknown as number }))).toBe(true)
    expect(matches('no-planned-qty', row({ plannedQty: 0.01 }))).toBe(false)
  })

  it('„bez pomiaru z natury" asks Σ etapów, across every crew', () => {
    expect(matches('no-measured-qty', row())).toBe(true)
    expect(matches('no-measured-qty', row({ [stageKey(1)]: 0, [stageKey(2)]: 0 }))).toBe(true)
    // A subcontractor-plane etap is still executed work — the pomiar covers the whole scope.
    expect(matches('no-measured-qty', row({ [stageKey(2)]: 3 }))).toBe(false)
  })

  it('„bez ceny j.m." asks the client price, the only one typed by hand', () => {
    expect(matches('no-client-price', row({ clientPrice: 0 }))).toBe(true)
    // A subcontractor override cannot stand in for a missing client price.
    expect(
      matches(
        'no-client-price',
        row({ clientPrice: 0, wToolsOverrideType: 'amount', wToolsOverrideValue: 80 }),
      ),
    ).toBe(true)
    expect(matches('no-client-price', row({ clientPrice: 100 }))).toBe(false)
  })

  it('„rozjazd" is the sheet’s pomiar against Σ etapów, silent when the sheet said nothing', () => {
    expect(matches('measure-diverged', row({ [stageKey(1)]: 55 }))).toBe(false)
    expect(matches('measure-diverged', row({ sheetMeasuredQty: 95, [stageKey(1)]: 55 }))).toBe(true)
    expect(matches('measure-diverged', row({ sheetMeasuredQty: 55, [stageKey(1)]: 55 }))).toBe(
      false,
    )
  })

  it('splits into working filters and diagnostics, and only filters lift to a section', () => {
    for (const condition of ROW_CONDITIONS) {
      expect(condition.sectionLabel === null).toBe(condition.kind === 'diagnostic')
    }
  })
})

describe('rowsMatchingConditions — several conditions narrow to their intersection', () => {
  const rows = [
    row({ id: 1, plannedQty: 0, clientPrice: 0 }),
    row({ id: 2, plannedQty: 0, clientPrice: 100 }),
    row({ id: 3, plannedQty: 10, clientPrice: 0 }),
    row({ id: 4, plannedQty: 10, clientPrice: 100 }),
  ]
  const ids = (subject: KosztorysV2RowT[]) => subject.map((r) => r.id)

  it('combines with AND', () => {
    expect(ids(rowsMatchingConditions(rows, ['no-planned-qty', 'no-client-price'], CTX))).toEqual([
      1,
    ])
  })

  it('is a no-op with nothing active — and hands back the same array, not a copy', () => {
    expect(rowsMatchingConditions(rows, [], CTX)).toBe(rows)
  })

  it('ignores an id nobody knows rather than matching nothing', () => {
    // A filter persisted under a condition that has since been removed must not blank the kosztorys.
    expect(ids(rowsMatchingConditions(rows, ['no-such-condition'], CTX))).toEqual([1, 2, 3, 4])
    expect(
      ids(rowsMatchingConditions(rows, ['no-such-condition', 'no-client-price'], CTX)),
    ).toEqual([1, 3])
  })
})

describe('countMatching — over the full dataset, so it can reach zero', () => {
  it('counts every match, whatever survived a filter', () => {
    const rows = [row({ id: 1, clientPrice: 0 }), row({ id: 2, clientPrice: 0 }), row({ id: 3 })]

    expect(countMatching(rows, 'no-client-price', CTX)).toBe(2)
  })

  it('reads an unknown id as zero', () => {
    expect(countMatching([row({ clientPrice: 0 })], 'no-such-condition', CTX)).toBe(0)
  })
})

describe('sectionIdsWhereAllMatch — „wszystkie co do jednej", not „suma = 0"', () => {
  it('takes a section only when every pozycja matches', () => {
    const rows = [
      row({ id: 1, sectionId: 10, plannedQty: 0 }),
      row({ id: 2, sectionId: 10, plannedQty: 0 }),
      row({ id: 3, sectionId: 20, plannedQty: 0 }),
      row({ id: 4, sectionId: 20, plannedQty: 5 }),
    ]

    expect([...sectionIdsWhereAllMatch(rows, 'no-planned-qty', CTX)]).toEqual([10])
  })

  it('does not qualify a section vacuously — a section with no rows is never named', () => {
    expect([...sectionIdsWhereAllMatch([], 'no-planned-qty', CTX)]).toEqual([])
  })

  it('names nothing for an unknown id', () => {
    expect([
      ...sectionIdsWhereAllMatch([row({ plannedQty: 0 })], 'no-such-condition', CTX),
    ]).toEqual([])
  })
})
