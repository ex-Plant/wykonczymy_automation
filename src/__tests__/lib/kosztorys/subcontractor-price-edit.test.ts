import { describe, expect, it } from 'vitest'
import { cellKeystroke, cellSettle } from '@/lib/kosztorys/cell-edit'
import { formatPLN } from '@/lib/utils/format-currency'
import {
  modeChange,
  overrideSnapshot,
  subcontractorPolicy,
  type OverrideSnapshotT,
} from '@/lib/kosztorys/subcontractor-price-edit'
import type { SubcontractorOverrideTypeT, ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

// The grid's own call shape: the cell hands `useCellDraft` a policy and the machine does the rest,
// so the spec drives the same two functions rather than a wrapper only it would keep alive.
const keystroke = (
  raw: string,
  rowData: ViewPricingT,
  view: ToolPlaneT,
  mode: SubcontractorOverrideTypeT,
) => cellKeystroke(raw, rowData, subcontractorPolicy<ViewPricingT>(view, mode))

const settle = (
  draft: string,
  rowData: ViewPricingT,
  view: ToolPlaneT,
  mode: SubcontractorOverrideTypeT,
  entry: OverrideSnapshotT,
) => cellSettle(draft, rowData, subcontractorPolicy<ViewPricingT>(view, mode), entry)

// Client price 100 makes every threshold readable at a glance: ceiling 80, w_tools coefficient
// price 65.
const row: ViewPricingT = {
  id: 1,
  sectionId: 10,
  displayOrder: 0,
  description: 'Malowanie',
  unit: 'm2',
  plannedQty: 10,
  sheetMeasuredQty: null,
  discountType: null,
  discountValue: 0,
  clientPrice: 100,
  wToolsOverrideType: null,
  wToolsOverrideValue: 0,
  ownToolsOverrideType: null,
  ownToolsOverrideValue: 0,
  note: null,
  globalDiscountActive: false,
  globalWToolsCoeff: 0.65,
  globalOwnToolsCoeff: 0.55,
}

const flat = (value: number): ViewPricingT => ({
  ...row,
  wToolsOverrideType: 'amount',
  wToolsOverrideValue: value,
})

const coeff = (value: number): ViewPricingT => ({
  ...row,
  wToolsOverrideType: 'coeff',
  wToolsOverrideValue: value,
})

describe('cellKeystroke pod polityką podwykonawcy', () => {
  it('nie zapisuje nic po wyczyszczeniu pola', () => {
    // The bug this guards: writing `type: null` here swapped the input for read-only text mid-edit,
    // killing the caret and restoring the old price.
    expect(keystroke('', flat(70), 'w_tools', 'amount')).toEqual({ kind: 'hold' })
  })

  it('trzyma niedokończony wpis zamiast go odrzucać', () => {
    expect(keystroke('1e', flat(70), 'w_tools', 'amount')).toEqual({ kind: 'hold' })
  })

  it('wpisana cena przestawia „auto" na kwotę stałą', () => {
    expect(keystroke('50', row, 'w_tools', 'amount')).toMatchObject({
      kind: 'commit',
      row: { wToolsOverrideType: 'amount', wToolsOverrideValue: 50 },
    })
  })

  it('wpisana cena kasuje własny mnożnik — zostaje kwota stała', () => {
    expect(keystroke('75', coeff(0.6), 'w_tools', 'amount')).toMatchObject({
      kind: 'commit',
      row: { wToolsOverrideType: 'amount', wToolsOverrideValue: 75 },
    })
  })

  it('przyjmuje przecinek jako separator dziesiętny', () => {
    expect(keystroke('50,5', flat(70), 'w_tools', 'amount')).toMatchObject({
      kind: 'commit',
      row: { wToolsOverrideValue: 50.5 },
    })
  })

  it('zapisuje cenę powyżej stawki z mnożnika — pod sufitem to zwykła cena', () => {
    expect(keystroke('70', flat(50), 'w_tools', 'amount').kind).toBe('commit')
  })

  it('blokuje cenę powyżej sufitu', () => {
    expect(keystroke('81', flat(70), 'w_tools', 'amount').kind).toBe('blocked')
  })

  it('blokuje cenę ujemną', () => {
    expect(keystroke('-50', flat(70), 'w_tools', 'amount').kind).toBe('blocked')
  })

  it('pisze do pól planu, w którym edytujemy', () => {
    expect(keystroke('30', flat(70), 'own_tools', 'amount')).toMatchObject({
      kind: 'commit',
      row: { ownToolsOverrideType: 'amount', ownToolsOverrideValue: 30, wToolsOverrideValue: 70 },
    })
  })

  it('wpisany mnożnik przestawia „auto" na własny mnożnik', () => {
    expect(keystroke('0,7', row, 'w_tools', 'coeff')).toMatchObject({
      kind: 'commit',
      row: { wToolsOverrideType: 'coeff', wToolsOverrideValue: 0.7 },
    })
  })

  it('blokuje mnożnik powyżej sufitu', () => {
    expect(keystroke('0,9', coeff(0.65), 'w_tools', 'coeff').kind).toBe('blocked')
  })
})

describe('cellSettle pod polityką podwykonawcy', () => {
  const entry = overrideSnapshot(flat(70), 'w_tools')

  it('puste pole wraca do „auto" dopiero po wyjściu z komórki', () => {
    expect(settle('', flat(70), 'w_tools', 'amount', entry)).toMatchObject({
      kind: 'clear',
      row: { wToolsOverrideType: null, wToolsOverrideValue: 0 },
    })
  })

  it('przyjęta wartość nie wymaga dopisku — wiersz już ją ma', () => {
    expect(settle('70', flat(70), 'w_tools', 'amount', entry)).toEqual({ kind: 'keep' })
  })

  it('odrzucona wartość cofa wiersz do stanu sprzed edycji', () => {
    // Typing „2344000" commits the prefixes 2, 23, 234 … until one breaches the ceiling. Walking
    // away used to leave 234 standing — a price the user never chose.
    expect(settle('2344000', flat(234), 'w_tools', 'amount', entry)).toMatchObject({
      kind: 'rollback',
      reason: 'blocked',
      row: { wToolsOverrideType: 'amount', wToolsOverrideValue: 70 },
    })
  })

  it('podaje przywróconą cenę, żeby dało się ją ogłosić', () => {
    const settled = settle('2344000', flat(234), 'w_tools', 'amount', entry)
    expect(
      settled.kind === 'rollback' &&
        subcontractorPolicy<ViewPricingT>('w_tools', 'amount').restoredLabel(settled.restored),
    ).toBe(formatPLN(70))
  })

  it('niedokończony wpis cofa się jako „nieprawidłowy"', () => {
    expect(settle('1e', flat(1), 'w_tools', 'amount', entry)).toMatchObject({
      kind: 'rollback',
      reason: 'invalid',
      row: { wToolsOverrideValue: 70 },
    })
  })

  it('cofnięcie do stanu, w którym wiersz już jest, nic nie zapisuje — ale nadal jest odrzuceniem', () => {
    expect(settle('81', flat(70), 'w_tools', 'amount', entry)).toMatchObject({
      kind: 'rollback',
      reason: 'blocked',
      row: null,
      restored: { wToolsOverrideType: 'amount', wToolsOverrideValue: 70 },
    })
  })

  it('odrzucony mnożnik nie zostawia wiersza na prefiksie „0"', () => {
    // „Mnożnik" is the sharp end of the prefix trap: typing 0,9 commits the leading „0" first, so a
    // refusal on the last keystroke used to strand the row at a multiplier of zero — a free row.
    const autoEntry = overrideSnapshot(row, 'w_tools')
    expect(settle('0,9', coeff(0), 'w_tools', 'coeff', autoEntry)).toMatchObject({
      kind: 'rollback',
      reason: 'blocked',
      row: { wToolsOverrideType: null, wToolsOverrideValue: 0 },
    })
  })
})

describe('modeChange', () => {
  it('„kwota stała" → „własny mnożnik" nie rusza ceny', () => {
    // Carrying the raw 200 across turned a 200 zł price into a multiplier of 200 — a 20 000 zł row
    // no keystroke ever showed the guard.
    expect(modeChange(flat(60), 'coeff', 'w_tools')).toMatchObject({
      wToolsOverrideType: 'coeff',
      wToolsOverrideValue: 0.6,
    })
  })

  it('„własny mnożnik" → „kwota stała" nie rusza ceny', () => {
    expect(modeChange(coeff(0.7), 'amount', 'w_tools')).toMatchObject({
      wToolsOverrideType: 'amount',
      wToolsOverrideValue: 70,
    })
  })

  it('„auto" → „własny mnożnik" startuje od mnożnika inwestycji', () => {
    expect(modeChange(row, 'coeff', 'w_tools')).toMatchObject({
      wToolsOverrideType: 'coeff',
      wToolsOverrideValue: 0.65,
    })
  })

  it('powrót do „auto" oddaje wiersz mnożnikowi inwestycji', () => {
    expect(modeChange(flat(60), null, 'w_tools')).toMatchObject({
      wToolsOverrideType: null,
      wToolsOverrideValue: 0,
    })
  })

  it('bez ceny klienta mnożnika nie da się odtworzyć — bierze ten z inwestycji', () => {
    const free: ViewPricingT = { ...flat(0), clientPrice: 0 }
    expect(modeChange(free, 'coeff', 'w_tools')).toMatchObject({ wToolsOverrideValue: 0.65 })
  })
})
