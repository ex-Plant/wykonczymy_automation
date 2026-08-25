import type { EditTransferFormApiT } from '@/components/forms/edit-transfer-form/edit-transfer-form-api'
import { EXPENSE_CATEGORY_LABEL } from '@/lib/constants/transfers'
import type { ReferenceItemT } from '@/types/reference-data'

type ExpenseCategoryFieldPropsT = {
  // The edit form's concrete API rather than the `FormWithFieldT` shape the shared wrappers take:
  // this one serves that form alone, so name-only checking would be settling for less than is free.
  form: EditTransferFormApiT
  expenseCategories: ReferenceItemT[]
}

export function ExpenseCategoryField({ form, expenseCategories }: ExpenseCategoryFieldPropsT) {
  const items = expenseCategories.map((cat) => ({
    value: String(cat.id),
    label: cat.name,
  }))

  return (
    <form.AppField name="expenseCategory">
      {(field) => (
        <field.Combobox
          label={EXPENSE_CATEGORY_LABEL}
          placeholder="Wybierz typ"
          searchPlaceholder="Szukaj kategorii..."
          emptyMessage="Nie znaleziono kategorii."
          items={items}
          showError
        />
      )}
    </form.AppField>
  )
}
