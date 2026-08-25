import type { ReactNode } from 'react'
import { createFormHook, createFormHookContexts } from '@tanstack/react-form'

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts()

import { useStore } from '@tanstack/react-form'

import { FormCheckbox } from '../form-components/form-checkbox'
import { FormCombobox } from '../form-components/form-combobox'
import { FormDatePicker } from '../form-components/form-date-picker'
import { FormSelect } from '../form-components/form-select'
import { FormTextarea } from '../form-components/form-textarea'
import { FormInput } from '../form-components/form-input'
const fieldComponents = {
  Input: FormInput,
  Select: FormSelect,
  Combobox: FormCombobox,
  DatePicker: FormDatePicker,
  Checkbox: FormCheckbox,
  Textarea: FormTextarea,
}

/**
 * What `field` carries inside a `form.AppField` render child. Derived from the registration above,
 * never restated: a hand-written copy of this list is what silently swallowed `rows` on every
 * Textarea, because the copy declared the prop, the real component never accepted it, and at an
 * annotated call site the copy is what tsc checks against.
 */
type AppFieldComponentsT = typeof fieldComponents

/**
 * What a wrapper in `form-fields/` needs from a form: the ability to open `TName` as a field, and
 * the store the field-value helper reads. One wrapper serves several forms with different value
 * shapes, and typing the full TanStack API means restating thirteen generic parameters — so these
 * used to take `form: any`, which threw away the one check that matters. The name a wrapper hardcodes
 * is not verified against the form it is handed, and TanStack does not fail on an unknown name: it
 * opens the field at `undefined`, so a renamed schema field yields a silently empty input that saves
 * nothing, with a green typecheck.
 *
 * Naming only, deliberately — not the value type. Constraining that needs the real generics, while
 * this catches the failure that actually happens: the field is gone or was renamed.
 */
export type FormWithFieldT<TName extends string> = {
  AppField: (props: {
    name: TName
    // The one hole left, and it stays `any` on purpose: TanStack types a listener by the field's
    // VALUE, which is exactly what this type declines to name, so anything narrower fails to match
    // the real `AppField`. A wrapper only forwards this prop, so nothing here reads it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listeners?: any
    children: (field: AppFieldComponentsT) => ReactNode
  }) => ReactNode | Promise<ReactNode>
  // Only `useFieldValue` reaches for it, and it re-types the store itself.
  store: unknown
}

const { useAppForm, withForm } = createFormHook({
  fieldComponents,
  formComponents: {},
  fieldContext,
  formContext,
})

export { useFieldContext, useFormContext, useStore }

export { useAppForm, withForm }
