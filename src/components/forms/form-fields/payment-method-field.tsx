import type { FormWithFieldT } from '@/components/forms/hooks/form-hooks'
import { SelectItem } from '@/components/ui/select'
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethodT,
} from '@/lib/constants/transfers'

type PaymentMethodFieldPropsT = {
  readonly form: FormWithFieldT<'paymentMethod'>
  // The wpłata form uses this to move the kwota onto the plane the method implies (gotówka → netto,
  // przelew → brutto).
  readonly listeners?: { onChange?: (arg: { value: string }) => void }
  readonly fieldClassName?: string
  readonly labels?: Record<PaymentMethodT, string>
}

export function PaymentMethodField({
  form,
  listeners,
  fieldClassName,
  labels = PAYMENT_METHOD_LABELS,
}: PaymentMethodFieldPropsT) {
  return (
    <form.AppField name="paymentMethod" listeners={listeners}>
      {(field) => (
        <field.Select label="Metoda płatności" showError fieldClassName={fieldClassName}>
          {PAYMENT_METHODS.map((m) => (
            <SelectItem key={m} value={m}>
              {labels[m]}
            </SelectItem>
          ))}
        </field.Select>
      )}
    </form.AppField>
  )
}
