import * as React from 'react'

export type FormControlPropsT = {
  label?: string
  description?: string
  placeholder?: string
  showError?: boolean
  type?: React.ComponentProps<'input'>['type']
  className?: string
}
