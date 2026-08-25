import { formOptions } from '@tanstack/react-form'
import type { ComponentProps } from 'react'

import { withForm } from '@/components/forms/hooks/form-hooks'

/**
 * TanStack's form API is a ~16-parameter generic that cannot be restated by hand, and a structural
 * stand-in is rejected as too wide (`AppField`'s `name` is a `DeepKeys` union). `withForm` accepts
 * the parent's form whatever its validator generics, so the type is read off a probe component that
 * is never rendered. Use it where a field component must name one specific form's API.
 */
function _formApiProbe<TValues>() {
  return withForm({ ...formOptions({ defaultValues: {} as TValues }), render: () => null })
}

export type FormApiOfT<TValues> = ComponentProps<ReturnType<typeof _formApiProbe<TValues>>>['form']
