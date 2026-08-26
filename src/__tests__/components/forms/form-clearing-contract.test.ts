import { describe, expect, it } from 'vitest'
import { FormApi } from '@tanstack/react-form'

// Pins the `FormApi` contract the create forms rest on: they feed their persisted draft in as
// `defaultValues`, which silently redefines what a bare `reset()` means.
type ValuesT = { date: string; amount: string; investment: string }

const BLANK: ValuesT = { date: '2026-08-26', amount: '', investment: '' }
const DRAFT: ValuesT = { date: '2026-08-20', amount: '1200', investment: '7' }

function formSeededWithDraft() {
  const form = new FormApi({ defaultValues: DRAFT })
  form.mount()
  return form
}

describe('clearing a form whose defaultValues are a draft', () => {
  it('restores the draft on a bare reset — so the submitted values come straight back', () => {
    const form = formSeededWithDraft()

    form.reset()

    expect(form.state.values).toEqual(DRAFT)
  })

  it('clears every field when the blank set is passed explicitly', () => {
    const form = formSeededWithDraft()

    form.reset(BLANK)

    expect(form.state.values).toEqual(BLANK)
    expect(form.state.isTouched).toBe(false)
  })

  it('refuses a later defaultValues swap once a field has been set with meta', () => {
    const form = formSeededWithDraft()

    form.reset()
    form.setFieldValue('amount', '')
    form.update({ defaultValues: BLANK })

    expect(form.state.values.investment).toBe(DRAFT.investment)
  })

  it('adopts the passed values as the new defaults, which a pristine form then re-applies', () => {
    const form = formSeededWithDraft()

    form.reset({ ...BLANK, amount: '99' })
    form.update({ defaultValues: BLANK })

    expect(form.state.values.amount).toBe(BLANK.amount)
  })

  it('stays pristine when a field is set without meta, leaving the swap available', () => {
    const form = formSeededWithDraft()

    form.reset(BLANK)
    form.setFieldValue('amount', '', { dontUpdateMeta: true, dontRunListeners: true })

    expect(form.state.isTouched).toBe(false)
  })
})
