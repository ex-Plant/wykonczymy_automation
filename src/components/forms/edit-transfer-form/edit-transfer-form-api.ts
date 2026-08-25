import { formOptions } from '@tanstack/react-form'
import type { ComponentProps } from 'react'
import type { z } from 'zod'

import { withForm } from '@/components/forms/hooks/form-hooks'
import { editTransferFormSchema } from '@/lib/schemas/transfer-form'

export type EditTransferFormValuesT = z.infer<typeof editTransferFormSchema>

/**
 * The form API this form hands to its field components, fully inferred — TanStack's own type is a
 * ~16-parameter generic nobody can restate by hand. This form is built with `useAppForm` directly,
 * so the type is read off a throwaway `withForm` component, the same trick as `bulk-expense-form.ts`
 * (`withForm` accepts the parent's form whatever its validator generics, which is what makes the
 * probe's bare options enough). The probe is never rendered.
 */
const _editTransferFormProbe = withForm({
  ...formOptions({ defaultValues: {} as EditTransferFormValuesT }),
  render: () => null,
})

export type EditTransferFormApiT = ComponentProps<typeof _editTransferFormProbe>['form']
