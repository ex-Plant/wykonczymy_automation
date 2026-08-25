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

/** TanStack's form API for this form — a ~16-parameter generic, so it is inferred, never restated. */
export type DepositFormApiT = ReturnType<
  typeof useManagedForm<DepositFormValuesT, CreateTransferFormT>
>['form']
