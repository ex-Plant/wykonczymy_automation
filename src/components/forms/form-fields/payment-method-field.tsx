import { SelectItem } from '@/components/ui/select'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/constants/transfers'

type PaymentMethodFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly form: any
  // The wpłata form uses this to move the kwota onto the plane the method implies (gotówka → netto,
  // przelew → brutto).
  readonly listeners?: { onChange?: (arg: { value: string }) => void }
  readonly fieldClassName?: string
}

export function PaymentMethodField({ form, listeners, fieldClassName }: PaymentMethodFieldPropsT) {
  return (
    <form.AppField name="paymentMethod" listeners={listeners}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(field: any) => (
        <field.Select label="Metoda płatności" showError fieldClassName={fieldClassName}>
          {PAYMENT_METHODS.map((m) => (
            <SelectItem key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </SelectItem>
          ))}
        </field.Select>
      )}
    </form.AppField>
  )
}
