import type { FormWithFieldT } from '@/components/forms/hooks/form-hooks'

type AmountFieldPropsT = {
  form: FormWithFieldT<'amount'>
  fieldClassName?: string
}

export function AmountField({ form, fieldClassName }: AmountFieldPropsT) {
  return (
    <form.AppField name="amount">
      {(field) => (
        <field.Input
          label="Kwota (PLN)"
          placeholder="0.00"
          type="number"
          showError
          fieldClassName={fieldClassName}
        />
      )}
    </form.AppField>
  )
}
