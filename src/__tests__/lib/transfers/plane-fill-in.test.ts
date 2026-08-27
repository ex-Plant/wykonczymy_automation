import { describe, it, expect } from 'vitest'
import { planeFillIn, UNANSWERED_PAYMENT_METHOD } from '@/lib/transfers/plane-fill-in'

const legacy = { type: 'INVESTOR_DEPOSIT', vatPlane: null, paymentMethod: 'CASH' } as const

describe('planeFillIn — a save that did not ask the question may not answer it', () => {
  // The regression: the plane is write-once, so a save that merely attaches a faktura would freeze
  // whatever the form pre-selected. The stored method is not evidence — every plane-less wpłata says
  // gotówka, and rows that DO carry a plane include gotówka tagged brutto.
  // Says nothing about the method either: an unchanged value is still a write, and the collection
  // hook nulls a method on every type that does not carry one, so re-sending it would let an edit
  // about something else wipe what a legacy row was booked with.
  it('leaves a legacy wpłata plane-less while the question stands unanswered', () => {
    const result = planeFillIn(legacy, UNANSWERED_PAYMENT_METHOD, '')

    expect(result).toEqual({})
  })

  it('tags it brutto with its netto once the owner says przelew', () => {
    expect(planeFillIn(legacy, 'TRANSFER', '400')).toEqual({
      paymentMethod: 'TRANSFER',
      vatPlane: 'GROSS',
      netAmount: 400,
    })
  })

  it('tags it netto and sends no second kwota once the owner says gotówka', () => {
    expect(planeFillIn(legacy, 'CASH', '')).toEqual({
      paymentMethod: 'CASH',
      vatPlane: 'NET',
      netAmount: undefined,
    })
  })

  // A netto typed under „przelew" and left behind by a switch back to gotówka is not the wpłata's
  // netto — it belongs to the answer that was abandoned.
  it('drops a netto stranded by a switch back to gotówka', () => {
    expect(planeFillIn(legacy, 'CASH', '400').netAmount).toBeUndefined()
  })

  it.each([
    ['a wpłata that already has a plane', { ...legacy, vatPlane: 'NET' as const }],
    ['a type that has no plane at all', { ...legacy, type: 'INVESTMENT_EXPENSE' as const }],
  ])('never answers for %s, even when the form names one', (_label, row) => {
    expect(planeFillIn(row, 'TRANSFER', '400')).toEqual({})
  })
})
