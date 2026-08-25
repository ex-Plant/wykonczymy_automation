import type { AppFieldComponentsT } from '@/components/forms/hooks/form-hooks'
type DateFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any
  fieldClassName?: string
}

export function DateField({ form, fieldClassName }: DateFieldPropsT) {
  return (
    <form.AppField name="date">
      {(field: AppFieldComponentsT) => (
        <field.DatePicker label="Data" showError fieldClassName={fieldClassName} />
      )}
    </form.AppField>
  )
}
