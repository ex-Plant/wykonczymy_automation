import type { FormWithFieldT } from '@/components/forms/hooks/form-hooks'

type DescriptionFieldPropsT = {
  form: FormWithFieldT<'description'>
  placeholder?: string
}

export function DescriptionField({ form, placeholder = 'Opis transferu' }: DescriptionFieldPropsT) {
  return (
    <form.AppField name="description">
      {(field) => <field.Input label="Opis (opcjonalnie)" placeholder={placeholder} showError />}
    </form.AppField>
  )
}
