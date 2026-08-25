import { describe, expect, it } from 'vitest'
import {
  cellKeystroke,
  cellSettle,
  numericFieldPolicy,
  type CellEditPolicyT,
} from '@/lib/kosztorys/cell-edit'
import { discountPolicy, type DiscountPairT } from '@/lib/kosztorys/discount-edit'

type QtyRowT = { id: number; plannedQty: number }

const qty = numericFieldPolicy<'plannedQty', QtyRowT>('plannedQty', String)
const row = (plannedQty: number): QtyRowT => ({ id: 1, plannedQty })

// The ceiling belongs to the subcontractor planes; here it is a stand-in, so the machine's `blocked`
// branch is tested without dragging the price guard's own rules into it.
const capped: CellEditPolicyT<QtyRowT, number> = {
  ...qty,
  guard: (candidate) => (candidate.plannedQty > 100 ? 'za dużo' : null),
}

describe('cellKeystroke', () => {
  it('przyjmuje przecinek jako separator dziesiętny', () => {
    expect(cellKeystroke('12,5', row(0), qty)).toEqual({ kind: 'commit', row: row(12.5) })
  })

  it('nie zapisuje nic po wyczyszczeniu pola', () => {
    // Writing the cleared value here would flip the cell out of edit mode mid-typing: the input is
    // swapped for read-only text, the caret dies and the old value reappears under the user's hands.
    expect(cellKeystroke('', row(7), qty)).toEqual({ kind: 'hold' })
  })

  it('trzyma niedokończony wpis zamiast go odrzucać', () => {
    expect(cellKeystroke('-', row(7), qty)).toEqual({ kind: 'hold' })
    expect(cellKeystroke('1e', row(7), qty)).toEqual({ kind: 'hold' })
  })

  it('kolejne klawisze ułamka dochodzą do pełnej liczby, nie do sklejonych cyfr', () => {
    // The rabat cell stored „12,5" as 125: it committed 12 on the comma, re-rendered over the typed
    // text, and the „5" landed on a „12" that had lost its separator.
    expect(cellKeystroke('12', row(0), qty)).toEqual({ kind: 'commit', row: row(12) })
    expect(cellKeystroke('12,', row(12), qty)).toEqual({ kind: 'commit', row: row(12) })
    expect(cellKeystroke('12,5', row(12), qty)).toEqual({ kind: 'commit', row: row(12.5) })
  })

  it('guard odrzuca wartość, zanim wiersz ją przyjmie', () => {
    expect(cellKeystroke('101', row(5), capped)).toMatchObject({ kind: 'blocked' })
    expect(cellKeystroke('99', row(5), capped)).toMatchObject({ kind: 'commit' })
  })
})

describe('cellSettle', () => {
  it('puste pole zeruje dopiero po wyjściu z komórki', () => {
    expect(cellSettle('', row(7), qty, 7)).toEqual({ kind: 'clear', row: row(0) })
  })

  it('przyjęta wartość nie wymaga zapisu — wiersz już ją ma', () => {
    expect(cellSettle('12,5', row(12.5), qty, 7)).toEqual({ kind: 'keep' })
  })

  it('odrzucony wpis cofa wiersz do stanu sprzed edycji', () => {
    // The prefix trap: typing „1e" committed „1" first, so walking away used to leave a quantity of
    // 1 standing in place of the 7 that was there.
    expect(cellSettle('1e', row(1), qty, 7)).toMatchObject({
      kind: 'rollback',
      reason: 'invalid',
      row: row(7),
      restored: row(7),
    })
  })

  it('cofnięcie do stanu, w którym wiersz już jest, nic nie zapisuje — ale nadal jest odrzuceniem', () => {
    expect(cellSettle('1e', row(7), qty, 7)).toMatchObject({
      kind: 'rollback',
      reason: 'invalid',
      row: null,
      restored: row(7),
    })
  })

  it('odrzucenie z guardu niesie własny powód', () => {
    expect(cellSettle('101', row(101), capped, 5)).toMatchObject({
      kind: 'rollback',
      reason: 'blocked',
      row: row(5),
    })
  })

  it('podaje przywróconą wartość do ogłoszenia', () => {
    const settled = cellSettle('1e', row(1), qty, 7)
    expect(settled.kind === 'rollback' && qty.restoredLabel(settled.restored)).toBe('7')
  })
})

describe('discountPolicy', () => {
  const policy = discountPolicy<DiscountPairT>()
  const noDiscount: DiscountPairT = { discountType: null, discountValue: 0 }

  it('wpisana wartość bez typu domyśla się procentu', () => {
    expect(cellKeystroke('10', noDiscount, policy)).toEqual({
      kind: 'commit',
      row: { discountType: 'percent', discountValue: 10 },
    })
  })

  it('nie nadpisuje typu wybranego wcześniej', () => {
    expect(cellKeystroke('250', { discountType: 'amount', discountValue: 0 }, policy)).toEqual({
      kind: 'commit',
      row: { discountType: 'amount', discountValue: 250 },
    })
  })

  it('wyczyszczone pole zdejmuje rabat razem z typem', () => {
    // A value with no type is inert — it looks like a live rabat and contributes nothing.
    expect(
      cellSettle('', { discountType: 'percent', discountValue: 10 }, policy, noDiscount),
    ).toEqual({ kind: 'clear', row: noDiscount })
  })

  it('ogłasza przywrócony rabat w jednostce, którą wiersz niósł', () => {
    expect(policy.restoredLabel({ discountType: 'percent', discountValue: 10 })).toBe('10%')
    expect(policy.restoredLabel({ discountType: 'amount', discountValue: 250 })).toBe('250,00 zł')
    expect(policy.restoredLabel(noDiscount)).toBe('brak rabatu')
  })
})
