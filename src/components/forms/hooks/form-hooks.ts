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
 * What `field` carries inside a `form.AppField` render child. Only the wrappers in `form-fields/`
 * need it: they take `form` as `any` (one wrapper serves several form value shapes), which kills
 * TanStack's inference — everywhere else `field` infers itself and needs no annotation.
 *
 * Derived from the registration above, never restated. A hand-written copy of this list is what
 * silently swallowed `rows` on every Textarea: the copy declared the prop, the real component
 * never accepted it, and at an annotated call site the copy is what tsc checks against.
 */
export type AppFieldComponentsT = typeof fieldComponents

const { useAppForm, withForm } = createFormHook({
  fieldComponents,
  formComponents: {},
  fieldContext,
  formContext,
})

export { useFieldContext, useFormContext, useStore }

// Export form hook
export { useAppForm, withForm }
