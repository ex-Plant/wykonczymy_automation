import { createFormHook, createFormHookContexts } from '@tanstack/react-form'
import { FormCheckbox, FormFileInput, FormInput, FormSelect, FormTextarea } from '../index'

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts()

import { useStore } from '@tanstack/react-form'

// Create the full form hook with field components
const { useAppForm } = createFormHook({
  fieldComponents: {
    Input: FormInput,
    Select: FormSelect,
    Checkbox: FormCheckbox,
    Textarea: FormTextarea,
    FileInput: FormFileInput,
  },
  formComponents: {},
  fieldContext,
  formContext,
})

export { fieldContext, formContext, useFieldContext, useFormContext, useStore }

// Export form hook
export { useAppForm }
