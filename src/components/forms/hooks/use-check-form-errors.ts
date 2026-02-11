import { AnyFormApi, useStore } from '@tanstack/react-form'
import { useEffect } from 'react'

type FormWithStore = {
  store: {
    state: {
      errors: unknown[]
      fieldMeta: Record<string, { errors: unknown[] }>
    }
  }
}

export default function useCheckFormErrors(form: AnyFormApi) {
  useEffect(() => {
    // 1. Check form-level errors (usually from the schema validator)
    if (form.store.state.errors.length > 0) {
      console.group('🚫 Form Validation Errors')
      console.table(form.store.state.errors[0])
      console.groupEnd()
    }

    // 2. Check field-specific errors
    const fieldsWithErrors = (
      Object.entries(form.store.state.fieldMeta) as [string, { errors: unknown[] }][]
    )
      .filter(([_, meta]) => meta.errors.length > 0)
      .map(([name, meta]) => ({
        field: name,
        errors: meta.errors.map((e: unknown) =>
          typeof e === 'object' && e && 'message' in e
            ? (e as { message?: string }).message
            : String(e),
        ),
      }))

    if (fieldsWithErrors.length > 0) {
      console.group('⚠️ Field Validation Errors')
      console.table(fieldsWithErrors)
      console.groupEnd()
    }
  }, [form.store.state.errors, form.store.state.fieldMeta])
}
