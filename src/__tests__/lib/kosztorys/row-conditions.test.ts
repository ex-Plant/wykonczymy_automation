import { describe, expect, it } from 'vitest'
import {
  ROW_CONDITIONS,
  countMatching,
  applyRowConditions,
  clientConditionIds,
  columnsRevealedBy,
  conditionPlane,
  engagedPlane,
  engagedConditionsOfKind,
  sectionIdsWhereAllMatch,
} from '@/lib/kosztorys/row-conditions'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

const STAGES: KosztorysStageT[] = [
  { id: 1, ordinal: 1, label: null, plane: null, workerId: null },
  { id: 2, ordinal: 2, label: null, plane: 'w_tools', workerId: 5 },
]
const CTX = { stages: STAGES, hasSettledMaterial: false }

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

  // EX-707. „Pozostało do rozliczenia" stays silent here on purpose — with no przedmiar its percentage
  // cell is a „—", and a red dash names nothing. The problem is real, so it is named here instead.
  it('„z wykonaną pracą bez przedmiaru" needs work entered AND no offer', () => {
    expect(matches('work-without-planned-qty', row({ plannedQty: 0, [stageKey(2)]: 3 }))).toBe(true)
    // Nothing executed: an unpriced-but-empty pozycja is not work booked against no offer.
    expect(matches('work-without-planned-qty', row({ plannedQty: 0 }))).toBe(false)
    // The offer exists — whether the etapy overshoot it is the rozliczenie's question, not this one's.
    expect(matches('work-without-planned-qty', row({ plannedQty: 1, [stageKey(2)]: 3 }))).toBe(
      false,
    )
    expect([...columnsRevealedBy(['work-without-planned-qty'])]).toEqual(['plannedQty'])
  })

  it('„bez przedmiaru i bez wykonanej pracy" needs BOTH axes empty', () => {
    expect(matches('client-empty', row({ plannedQty: 0 }))).toBe(true)
    // Priced-but-unstarted: the przedmiar total still counts it, so it must stay.
    expect(matches('client-empty', row({ plannedQty: 5 }))).toBe(false)
    // No przedmiar but etap work entered: the executed total still counts it.
    expect(matches('client-empty', row({ plannedQty: 0, [stageKey(2)]: 3 }))).toBe(false)
  })

  // The same guard that reddens the cell, so the filter and the colour can never disagree.
  it('„z nieprawidłową ceną wykonawcy" reads the guard, per plane', () => {
    const overridden = (type: 'amount', value: number) =>
      row({ wToolsOverrideType: type, wToolsOverrideValue: value })

    // clientPrice 100 → the ceiling is 80; typed at exactly the ceiling it must stand.
    expect(matches('overpriced-w-tools', overridden('amount', 80))).toBe(false)
    expect(matches('overpriced-w-tools', overridden('amount', 80.01))).toBe(true)
    expect(matches('overpriced-w-tools', overridden('amount', -1))).toBe(true)
    // An unpriced pozycja is „bez ceny j.m." — a different problem, and the ceiling collapses to zero.
    expect(matches('overpriced-w-tools', row({ clientPrice: 0 }))).toBe(false)
  })

  it('keeps the two planes apart — a fault on one is silent on the other', () => {
    const subject = row({ ownToolsOverrideType: 'amount', ownToolsOverrideValue: 95 })
    expect(matches('overpriced-own-tools', subject)).toBe(true)
    expect(matches('overpriced-w-tools', subject)).toBe(false)
  })

  // What an import writes onto a praca whose two cenniki disagreed: a deliberate 0 zł that looks
  // exactly like a priced one in the grid, so without this it is findable only by scrolling.
  it('„bez ceny wykonawcy" finds a stawka explicitly set to zero, per plane', () => {
    const blank = row({
      wToolsOverrideType: 'amount',
      wToolsOverrideValue: 0,
      ownToolsOverrideType: 'amount',
      ownToolsOverrideValue: 0,
    })
    expect(matches('no-w-tools-price', blank)).toBe(true)
    expect(matches('no-own-tools-price', blank)).toBe(true)

    // An ujemna stawka is the guard's row, not this one's — counted by both it would show up twice in
    // the „Problemy" list and be chased twice in the grid.
    const negative = row({ wToolsOverrideType: 'amount', wToolsOverrideValue: -1 })
    expect(matches('no-w-tools-price', negative)).toBe(false)
    expect(matches('overpriced-w-tools', negative)).toBe(true)

    // Inheriting the global multiplier is a stawka like any other — 100 × 0,65.
    expect(matches('no-w-tools-price', row())).toBe(false)
    // „bez ceny j.m." owns this row; here the crew price is zero only because the client's is.
    expect(matches('no-w-tools-price', row({ clientPrice: 0 }))).toBe(false)
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

// EX-708. Found in the owner's sheets: a pozycja whose cena zawiera materiał was left on the derived
// coefficient, so the crew took 65% of the material too. The kosztorys cannot know which pozycje carry
// material, so the detector fires on the combination it CAN see — the investment has material folded
// into robocizna, the pozycja has executed work, and the stawka for the plane that work was done at is
// a percentage of a client price that contains the material.
describe('„ze stawką wykonawcy od ceny z materiałem" — the overpaid-crew guard', () => {
  const STAGES_BOTH_PLANES: KosztorysStageT[] = [
    { id: 1, ordinal: 1, label: null, plane: 'w_tools', workerId: null },
    { id: 2, ordinal: 2, label: null, plane: 'own_tools', workerId: null },
    { id: 3, ordinal: 3, label: null, plane: null, workerId: null },
  ]
  const settled = { stages: STAGES_BOTH_PLANES, hasSettledMaterial: true }
  const noSettled = { stages: STAGES_BOTH_PLANES, hasSettledMaterial: false }
  const fires = (conditionId: string, subject: KosztorysV2RowT, ctx = settled) =>
    countMatching([subject], conditionId, ctx) === 1

  // The derived stawka: no override at all, so it is globalWToolsCoeff × cena j.m.
  const executedWTools = row({ [stageKey(1)]: 4 })

  it('fires on a derived stawka once the investment has material in robocizna', () => {
    expect(fires('material-percent-rate-w-tools', executedWTools)).toBe(true)
  })

  it('stays silent on an investment with no material folded into robocizna', () => {
    expect(fires('material-percent-rate-w-tools', executedWTools, noSettled)).toBe(false)
  })

  // Nothing has been executed, so nothing is owed yet and there is no overpayment to catch. Without
  // this the whole kosztorys would light up the moment one wydatek is marked „wliczony w robociznę".
  it('stays silent on a pozycja with przedmiar but no executed work', () => {
    expect(fires('material-percent-rate-w-tools', row({ plannedQty: 20 }))).toBe(false)
  })

  // The convention the owner confirmed: on such pozycje the stawka is typed as a fixed amount.
  it('accepts a stawka typed as a fixed amount', () => {
    const typed = row({ wToolsOverrideType: 'amount', wToolsOverrideValue: 40 })
    expect(
      fires('material-percent-rate-w-tools', { ...typed, [stageKey(1)]: 4 } as KosztorysV2RowT),
    ).toBe(false)
  })

  // A hand-typed multiplier is still a multiplier: 0,6 × a price that contains material hands the crew
  // a cut of the material just like the default 0,65 does. Only a flat amount escapes.
  it('fires on a hand-typed multiplier too, not just the inherited one', () => {
    const multiplied = row({ wToolsOverrideType: 'coeff', wToolsOverrideValue: 0.6 })
    expect(
      fires('material-percent-rate-w-tools', {
        ...multiplied,
        [stageKey(1)]: 4,
      } as KosztorysV2RowT),
    ).toBe(true)
  })

  // The case that decides the whole design: one plane typed by hand, the other left on a multiplier.
  // Which one is a fault depends on where the work was actually executed.
  it('judges the plane the work was executed at, not both', () => {
    const halfTyped = row({ wToolsOverrideType: 'amount', wToolsOverrideValue: 40 })

    const doneWTools = { ...halfTyped, [stageKey(1)]: 4 } as KosztorysV2RowT
    expect(fires('material-percent-rate-w-tools', doneWTools)).toBe(false)
    expect(fires('material-percent-rate-own-tools', doneWTools)).toBe(false)

    const doneOwnTools = { ...halfTyped, [stageKey(2)]: 4 } as KosztorysV2RowT
    expect(fires('material-percent-rate-own-tools', doneOwnTools)).toBe(true)
    expect(fires('material-percent-rate-w-tools', doneOwnTools)).toBe(false)
  })

  // An etap with no rozliczenie is where most kosztorysy sit while the work is happening — the crew
  // is decided at settlement, long after the stawka was set. Whichever it turns out to be gets a cut
  // of the material, so the etap counts toward both planes rather than toward neither.
  it('judges work on an etap with no rozliczenie against both planes', () => {
    expect(fires('material-percent-rate-w-tools', row({ [stageKey(3)]: 9 }))).toBe(true)
    expect(fires('material-percent-rate-own-tools', row({ [stageKey(3)]: 9 }))).toBe(true)
  })

  it('still lets a fixed amount clear the plane it was typed on', () => {
    const halfTyped = row({ wToolsOverrideType: 'amount', wToolsOverrideValue: 40 })
    const undecided = { ...halfTyped, [stageKey(3)]: 9 } as KosztorysV2RowT

    expect(fires('material-percent-rate-w-tools', undecided)).toBe(false)
    expect(fires('material-percent-rate-own-tools', undecided)).toBe(true)
  })

  it('sends each half to the plane it judges, and reveals the cells that repair it', () => {
    expect(conditionPlane('material-percent-rate-w-tools')).toBe('w_tools')
    expect(conditionPlane('material-percent-rate-own-tools')).toBe('own_tools')
    expect([...columnsRevealedBy(['material-percent-rate-w-tools'])].sort()).toEqual([
      'price',
      'priceCoeff',
      'priceMode',
    ])
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

  // The vanish-under-your-hands bug: the first digit of a cena makes „bez ceny j.m." false, and the
  // row it was typed into left the grid mid-keystroke.
  it('keeps a latched row a diagnostic has stopped matching', () => {
    expect(ids(applyRowConditions(rows, ['no-client-price'], CTX, new Set([4])))).toEqual([1, 3, 4])
  })

  it('keeps a latched row a filter would hide', () => {
    expect(ids(applyRowConditions(rows, ['no-planned-qty'], CTX, new Set([1])))).toEqual([1, 3, 4])
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

// The owner's „Ukryj pozycje bez przedmiaru i bez wykonanej pracy" reaching the client's document is
// a two-step wiring — stored flag → engaged condition → rows removed — and only the storage half had
// a guard. A hook refactor deleted the middle step once without a single test going red.
describe('clientConditionIds', () => {
  it('engages the client condition only when the owner stored the decision', () => {
    expect([...clientConditionIds(true)]).toEqual(['client-empty'])
    expect([...clientConditionIds(false)]).toEqual([])
    expect([...clientConditionIds(undefined)]).toEqual([])
  })

  it('names a condition the registry actually has — a typo here would hide nothing, silently', () => {
    const rows = [row({ id: 1, plannedQty: 0 }), row({ id: 2, plannedQty: 5 })]
    expect(applyRowConditions(rows, clientConditionIds(true), CTX).map((r) => r.id)).toEqual([2])
  })

  it('hands back the same instance every call, so the editor memos do not churn', () => {
    expect(clientConditionIds(true)).toBe(clientConditionIds(true))
    expect(clientConditionIds(false)).toBe(clientConditionIds(undefined))
  })
})

// Narrowing to „pozycje bez ceny j.m." while „Cena j.m." is unticked in the column picker shows the
// right rows with the missing thing still missing — the whole point of the reveal.
describe('columnsRevealedBy', () => {
  it('reveals nothing while nothing is engaged', () => {
    expect([...columnsRevealedBy([])]).toEqual([])
  })

  // The price is the symptom; „Źródło ceny wykonawcy" and „Mnożnik" are the only way to change it, so
  // revealing the first alone would show a number nobody can act on.
  it('brings the two cells that compute a stawka along with the stawka', () => {
    expect([...columnsRevealedBy(['overpriced-w-tools'])].sort()).toEqual([
      'price',
      'priceCoeff',
      'priceMode',
    ])
  })

  it('unions two engaged problems without repeating their shared column', () => {
    const revealed = columnsRevealedBy(['no-client-price', 'overpriced-own-tools'])
    expect([...revealed].sort()).toEqual(['price', 'priceCoeff', 'priceMode'])
  })

  // The subcontractor stawki derive from the client price, so a missing cena j.m. is a missing stawka
  // too and gets the same three cells rather than „Cena j.m." alone.
  it('gives a missing cena j.m. the same three cells as a bad stawka', () => {
    expect([...columnsRevealedBy(['no-client-price'])].sort()).toEqual([
      'price',
      'priceCoeff',
      'priceMode',
    ])
  })

  // Same rule as the rest of the registry: an id persisted under a condition since removed must be
  // inert, never a reveal of something nobody asked for.
  it('ignores an unknown id and a condition that reveals nothing', () => {
    expect([...columnsRevealedBy(['nie-ma-takiego', 'no-planned-qty'])]).toEqual([])
  })
})

// What the „Problemy" pick switches the grid to. Only meaningful because the list is single-choice —
// with two engaged there is no „the" view to switch to.
describe('conditionPlane', () => {
  it('sends each stawka problem to the plane it judges', () => {
    expect(conditionPlane('overpriced-w-tools')).toBe('w_tools')
    expect(conditionPlane('no-own-tools-price')).toBe('own_tools')
  })

  // Owner: cena j.m. is typed in the Inwestor view but the cells that repair it assemble in the
  // subcontractor ones, so there is no single view this problem is fixed in — it moves nobody.
  it('leaves the view alone for a problem about no plane in particular', () => {
    expect(conditionPlane('no-client-price')).toBeUndefined()
    expect(conditionPlane('measure-diverged')).toBeUndefined()
    expect(conditionPlane('nie-ma-takiego')).toBeUndefined()
  })
})

// The engaged set is what SURVIVES a reload, so the plane has to be readable from it. Remembered
// separately it was lost on refresh, and the narrowing came back judged on a view the grid was no
// longer showing.
describe('engagedPlane', () => {
  it('reads the plane straight off whatever is engaged', () => {
    expect(engagedPlane(['overpriced-own-tools'])).toBe('own_tools')
  })

  it('answers nothing when nothing engaged names a plane', () => {
    expect(engagedPlane([])).toBeUndefined()
    expect(engagedPlane(['no-client-price', 'stage-no-plane'])).toBeUndefined()
  })

  // A stale id from an older registry must not make the grid unreadable — it is skipped, not fatal.
  it('skips an id it does not recognise', () => {
    expect(engagedPlane(['nie-ma-takiego', 'overpriced-w-tools'])).toBe('w_tools')
  })
})
