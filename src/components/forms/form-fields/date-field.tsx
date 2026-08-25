import type { FormWithFieldT } from '@/components/forms/hooks/form-hooks'

type DateFieldPropsT = {
  form: FormWithFieldT<'date'>
  fieldClassName?: string
}

export function DateField({ form, fieldClassName }: DateFieldPropsT) {
  return (
    <form.AppField name="date">
      {(field) => <field.DatePicker label="Data" showError fieldClassName={fieldClassName} />}
    </form.AppField>
  )
}
