import { describe, expect, it } from 'vitest'
import { cellKeystroke, cellSettle } from '@/lib/kosztorys/cell-edit'
import { formatPLN } from '@/lib/utils/format-currency'
import {
  modeChange,
  overrideSnapshot,
  subcontractorPolicy,
  type OverrideSnapshotT,
} from '@/lib/kosztorys/subcontractor-price-edit'
import type { ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

// The grid's own call shape: the cell hands `useCellDraft` a policy and the machine does the rest,
// so the spec drives the same two functions rather than a wrapper only it would keep alive.
const keystroke = (raw: string, rowData: ViewPricingT, view: ToolPlaneT) =>
  cellKeystroke(raw, rowData, subcontractorPolicy<ViewPricingT>(view))

const settle = (draft: string, rowData: ViewPricingT, view: ToolPlaneT, entry: OverrideSnapshotT) =>
  cellSettle(draft, rowData, subcontractorPolicy<ViewPricingT>(view), entry)

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

describe('cellKeystroke pod polityką podwykonawcy', () => {
  it('nie zapisuje nic po wyczyszczeniu pola', () => {
    // The bug this guards: writing `type: null` here swapped the input for read-only text mid-edit,
    // killing the caret and restoring the old price.
    expect(keystroke('', flat(70), 'w_tools')).toEqual({ kind: 'hold' })
  })

  it('trzyma niedokończony wpis zamiast go odrzucać', () => {
    expect(keystroke('1e', flat(70), 'w_tools')).toEqual({ kind: 'hold' })
  })

  it('wpisana cena przestawia „auto" na kwotę stałą', () => {
    expect(keystroke('50', row, 'w_tools')).toMatchObject({
      kind: 'commit',
      row: { wToolsOverrideType: 'amount', wToolsOverrideValue: 50 },
    })
  })

  it('wpisana cena zastępuje poprzednią kwotę stałą', () => {
    expect(keystroke('75', flat(60), 'w_tools')).toMatchObject({
      kind: 'commit',
      row: { wToolsOverrideType: 'amount', wToolsOverrideValue: 75 },
    })
  })

  it('przyjmuje przecinek jako separator dziesiętny', () => {
    expect(keystroke('50,5', flat(70), 'w_tools')).toMatchObject({
      kind: 'commit',
      row: { wToolsOverrideValue: 50.5 },
    })
  })

  it('zapisuje cenę powyżej stawki z mnożnika inwestycji — pod sufitem to zwykła cena', () => {
    expect(keystroke('70', flat(50), 'w_tools').kind).toBe('commit')
  })

  it('blokuje cenę powyżej sufitu', () => {
    expect(keystroke('81', flat(70), 'w_tools').kind).toBe('blocked')
  })

  it('blokuje cenę ujemną', () => {
    expect(keystroke('-50', flat(70), 'w_tools').kind).toBe('blocked')
  })

  it('pisze do pól planu, w którym edytujemy', () => {
    expect(keystroke('30', flat(70), 'own_tools')).toMatchObject({
      kind: 'commit',
      row: { ownToolsOverrideType: 'amount', ownToolsOverrideValue: 30, wToolsOverrideValue: 70 },
    })
  })
})

describe('cellSettle pod polityką podwykonawcy', () => {
  const entry = overrideSnapshot(flat(70), 'w_tools')

  it('puste pole wraca do „auto" dopiero po wyjściu z komórki', () => {
    expect(settle('', flat(70), 'w_tools', entry)).toMatchObject({
      kind: 'clear',
      row: { wToolsOverrideType: null, wToolsOverrideValue: 0 },
    })
  })

  it('przyjęta wartość nie wymaga dopisku — wiersz już ją ma', () => {
    expect(settle('70', flat(70), 'w_tools', entry)).toEqual({ kind: 'keep' })
  })

  it('odrzucona wartość cofa wiersz do stanu sprzed edycji', () => {
    // Typing „2344000" commits the prefixes 2, 23, 234 … until one breaches the ceiling. Walking
    // away used to leave 234 standing — a price the user never chose.
    expect(settle('2344000', flat(234), 'w_tools', entry)).toMatchObject({
      kind: 'rollback',
      reason: 'blocked',
      row: { wToolsOverrideType: 'amount', wToolsOverrideValue: 70 },
    })
  })

  it('podaje przywróconą cenę, żeby dało się ją ogłosić', () => {
    const settled = settle('2344000', flat(234), 'w_tools', entry)
    expect(
      settled.kind === 'rollback' &&
        subcontractorPolicy<ViewPricingT>('w_tools').restoredLabel(settled.restored),
    ).toBe(formatPLN(70))
  })

  it('niedokończony wpis cofa się jako „nieprawidłowy"', () => {
    expect(settle('1e', flat(1), 'w_tools', entry)).toMatchObject({
      kind: 'rollback',
      reason: 'invalid',
      row: { wToolsOverrideValue: 70 },
    })
  })

  it('cofnięcie do stanu, w którym wiersz już jest, nic nie zapisuje — ale nadal jest odrzuceniem', () => {
    expect(settle('81', flat(70), 'w_tools', entry)).toMatchObject({
      kind: 'rollback',
      reason: 'blocked',
      row: null,
      restored: { wToolsOverrideType: 'amount', wToolsOverrideValue: 70 },
    })
  })

  it('odrzucona cena nie zostawia wiersza na prefiksie „9"', () => {
    // The prefix trap from the „auto" side: typing 90 commits the leading „9" first, so a refusal on
    // the last keystroke used to strand the row at 9 zł — a price nobody chose.
    const autoEntry = overrideSnapshot(row, 'w_tools')
    expect(settle('90', flat(9), 'w_tools', autoEntry)).toMatchObject({
      kind: 'rollback',
      reason: 'blocked',
      row: { wToolsOverrideType: null, wToolsOverrideValue: 0 },
    })
  })
})

describe('modeChange', () => {
  it('„auto" → „kwota stała" zamraża cenę, którą wiersz już pokazuje', () => {
    expect(modeChange(row, 'amount', 'w_tools')).toMatchObject({
      wToolsOverrideType: 'amount',
      wToolsOverrideValue: 65,
    })
  })

  it('zamraża cenę planu, w którym przełączamy źródło', () => {
    const switched = modeChange(row, 'amount', 'own_tools')
    expect(switched.ownToolsOverrideType).toBe('amount')
    expect(switched.ownToolsOverrideValue).toBeCloseTo(55, 6)
    expect(switched.wToolsOverrideType).toBeNull()
  })

  it('powrót do „auto" oddaje wiersz mnożnikowi inwestycji', () => {
    expect(modeChange(flat(60), null, 'w_tools')).toMatchObject({
      wToolsOverrideType: null,
      wToolsOverrideValue: 0,
    })
  })
})
