import * as React from 'react'

export type FormControlPropsT = {
  label?: string
  description?: string
  placeholder?: string
  showError?: boolean
  disabled?: boolean
  type?: React.ComponentProps<'input'>['type']
  autoComplete?: React.ComponentProps<'input'>['autoComplete']
  className?: string
}
