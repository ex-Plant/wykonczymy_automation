import { describe, expect, it } from 'vitest'
import {
  ROW_CONDITIONS,
  countMatching,
  applyRowConditions,
  engagedConditionsOfKind,
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

describe('the conditions, each on its boundary', () => {
  it('„bez przedmiaru" reads a cleared cell and a zero alike, but not a real quantity', () => {
    expect(matches('no-planned-qty', row({ plannedQty: 0 }))).toBe(true)
    expect(matches('no-planned-qty', row({ plannedQty: null as unknown as number }))).toBe(true)
    expect(matches('no-planned-qty', row({ plannedQty: 0.01 }))).toBe(false)
  })

  it('„bez wykonanej pracy" asks Σ etapów, across every crew', () => {
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

  it('„bez przedmiaru i bez wykonanej pracy" needs BOTH axes empty', () => {
    expect(matches('client-empty', row({ plannedQty: 0 }))).toBe(true)
    // Priced-but-unstarted: the przedmiar total still counts it, so it must stay.
    expect(matches('client-empty', row({ plannedQty: 5 }))).toBe(false)
    // No przedmiar but etap work entered: the executed total still counts it.
    expect(matches('client-empty', row({ plannedQty: 0, [stageKey(2)]: 3 }))).toBe(false)
  })

  it('splits into working filters and diagnostics, and only filters lift to a section', () => {
    for (const condition of ROW_CONDITIONS) {
      expect(condition.sectionLabel === null).toBe(condition.kind !== 'filter')
    }
  })

  // The picker grammar rests on this: untick one half and you are left with exactly the other half.
  // A pair that overlapped (or left a gap) would make „pokaż tylko te z przedmiarem" quietly lie.
  it('pairs every filter with its exact complement', () => {
    const subjects = [
      row({ plannedQty: 0 }),
      row({ plannedQty: 5 }),
      row({ [stageKey(1)]: 0, [stageKey(2)]: 0 }),
      row({ [stageKey(2)]: 3 }),
    ]

    for (const [negative, positive] of [
      ['no-planned-qty', 'has-planned-qty'],
      ['no-measured-qty', 'has-measured-qty'],
    ]) {
      for (const subject of subjects) {
        expect(matches(positive, subject)).toBe(!matches(negative, subject))
      }
    }
  })
})

describe('applyRowConditions — each kind pulls the direction its wording promises', () => {
  const rows = [
    row({ id: 1, plannedQty: 0, clientPrice: 0 }),
    row({ id: 2, plannedQty: 0, clientPrice: 100 }),
    row({ id: 3, plannedQty: 10, clientPrice: 0 }),
    row({ id: 4, plannedQty: 10, clientPrice: 100 }),
  ]
  const ids = (subject: KosztorysV2RowT[]) => subject.map((r) => r.id)

  it('hides what a filter matches — „Schowaj pozycje bez przedmiaru"', () => {
    expect(ids(applyRowConditions(rows, ['no-planned-qty'], CTX))).toEqual([3, 4])
  })

  it('keeps only what a diagnostic matches — „Pokaż tylko pozycje bez ceny j.m."', () => {
    expect(ids(applyRowConditions(rows, ['no-client-price'], CTX))).toEqual([1, 3])
  })

  it('applies the hiders first, then keeps only what a diagnostic still matches', () => {
    expect(ids(applyRowConditions(rows, ['no-planned-qty', 'no-client-price'], CTX))).toEqual([3])
  })

  // The bug this rule exists to prevent: under AND, „bez ceny j.m. (9)" + „z rozjazdem pomiaru (5)"
  // asked for pozycje that are both at once — none — so the grid blanked while the badges promised 14.
  it('unions two diagnostics rather than intersecting them', () => {
    const divergedRows = [
      row({ id: 5, clientPrice: 100, sheetMeasuredQty: 95, [stageKey(1)]: 55 }),
      row({ id: 6, clientPrice: 0, sheetMeasuredQty: 40, [stageKey(1)]: 40 }),
      row({ id: 7, clientPrice: 100, sheetMeasuredQty: 40, [stageKey(1)]: 40 }),
    ]

    expect(
      ids(applyRowConditions(divergedRows, ['no-client-price', 'measure-diverged'], CTX)),
    ).toEqual([5, 6])
  })

  it('hides what the client condition matches, like a filter', () => {
    const clientRows = [
      row({ id: 1, plannedQty: 0 }),
      row({ id: 2, plannedQty: 0, [stageKey(1)]: 4 }),
      row({ id: 3, plannedQty: 10 }),
    ]

    expect(ids(applyRowConditions(clientRows, ['client-empty'], CTX))).toEqual([2, 3])
  })

  // The owner cannot untick it for themselves, and a client never sees a menu at all.
  it('keeps the client condition out of the „Filtry" menu', () => {
    expect(engagedConditionsOfKind(new Set(['client-empty']), 'filter')).toEqual([])
    expect(engagedConditionsOfKind(new Set(['client-empty']), 'client').map((c) => c.id)).toEqual([
      'client-empty',
    ])
  })

  it('is a no-op with nothing active — and hands back the same array, not a copy', () => {
    expect(applyRowConditions(rows, [], CTX)).toBe(rows)
  })

  it('ignores an id nobody knows rather than matching nothing', () => {
    // A filter persisted under a condition that has since been removed must not blank the kosztorys.
    expect(ids(applyRowConditions(rows, ['no-such-condition'], CTX))).toEqual([1, 2, 3, 4])
    expect(ids(applyRowConditions(rows, ['no-such-condition', 'no-client-price'], CTX))).toEqual([
      1, 3,
    ])
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
