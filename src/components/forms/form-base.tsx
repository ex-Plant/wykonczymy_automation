import * as React from 'react'
import { ReactNode } from 'react'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field'
import { useFieldContext } from './hooks/form-hooks'
import { FormControlPropsT } from './types/form-types'

type FormBasePropsT = FormControlPropsT & {
  children: ReactNode
  horizontal?: boolean
  controlFirst?: boolean
}

export default function FormBase({
  children,
  label,
  description,
  controlFirst,
  horizontal,
  showError,
}: FormBasePropsT) {
  const field = useFieldContext()
  const isInvalid = field.state.meta.errors.length > 0
  const errorElem = showError && isInvalid && <FieldError errors={field.state.meta.errors} />

  return (
    <Field data-invalid={isInvalid} orientation={horizontal ? 'horizontal' : undefined}>
      {controlFirst ? (
        <>
          {children}
          <FieldContent>
            {label && <FieldLabel htmlFor={field.name}>{label}</FieldLabel>}
            {description && <FieldDescription>{description}</FieldDescription>}
            {errorElem}
          </FieldContent>
        </>
      ) : (
        <>
          {label && <FieldLabel htmlFor={field.name}>{label}</FieldLabel>}
          {children}
          {description && <FieldDescription>{description}</FieldDescription>}
          {errorElem}
        </>
      )}
    </Field>
  )
}
