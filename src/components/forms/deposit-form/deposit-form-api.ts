import type { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import type { CreateTransferFormT } from '@/lib/schemas/transfer'

export type DepositFormValuesT = {
  description: string
  amount: string
  // The brutto kwota, typed only on a przelew — there `amount` is the faktura's netto beside it and
  // this one is the money that actually moved. A gotówka leaves it empty; it has no brutto side.
  amountGross: string
  date: string
  type: string
  paymentMethod: string
  vatPlane?: string
  sourceRegister: string
  investment?: string
}

/**
 * The form API this form hands to its field components, fully inferred — TanStack's own type is a
 * ~16-parameter generic nobody can restate by hand. Lifted out of the `.tsx` so a field component
 * can name it without importing the component that renders it.
 *
 * `bulk-expense-form.ts` reads the same type off a throwaway `withForm` probe because its form is
 * built with `useAppForm` directly; here `useManagedForm` already names the value shape, so its
 * return type is the shorter road to the same place.
 */
export type DepositFormApiT = ReturnType<
  typeof useManagedForm<DepositFormValuesT, CreateTransferFormT>
>['form']
