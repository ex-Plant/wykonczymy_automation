'use client'

import { SelectItem } from '@/components/ui/select'
import type { FormWithFieldT } from '@/components/forms/hooks/form-hooks'
import {
  EQUIPMENT_STATUSES,
  EQUIPMENT_STATUS_LABELS,
} from '@/lib/equipment/equipment-status'

export type EquipmentItemFieldNameT =
  | 'name'
  | 'serialNumber'
  | 'make'
  | 'model'
  | 'purchaseDate'
  | 'warrantyUntil'
  | 'purchasePrice'
  | 'note'
  | 'status'

type EquipmentItemFieldsPropsT = {
  form: FormWithFieldT<EquipmentItemFieldNameT>
  /** Hidden while adding: a brand-new item is „W użyciu" and nothing else. */
  showStatus?: boolean
}

/** The item's own attributes — shared by „Dodaj sprzęt" and „Edytuj sprzęt". */
export function EquipmentItemFields({ form, showStatus }: EquipmentItemFieldsPropsT) {
  return (
    <>
      <form.AppField name="name">
        {(field) => <field.Input label="Nazwa" placeholder="Szlifierka kątowa" showError />}
      </form.AppField>

      <form.AppField name="serialNumber">
        {(field) => <field.Input label="Numer seryjny" showError />}
      </form.AppField>

      <form.AppField name="make">
        {(field) => <field.Input label="Marka" placeholder="Makita" showError />}
      </form.AppField>

      <form.AppField name="model">
        {(field) => <field.Input label="Model" placeholder="GA9020" showError />}
      </form.AppField>

      <form.AppField name="purchaseDate">
        {(field) => <field.DatePicker label="Data zakupu" showError />}
      </form.AppField>

      <form.AppField name="warrantyUntil">
        {(field) => <field.DatePicker label="Gwarancja do" showError />}
      </form.AppField>

      <form.AppField name="purchasePrice">
        {(field) => <field.Input label="Cena zakupu" type="number" showError />}
      </form.AppField>

      <form.AppField name="note">{(field) => <field.Textarea label="Uwagi" rows={2} />}</form.AppField>

      {showStatus && (
        <form.AppField name="status">
          {(field) => (
            <field.Select label="Status" showError>
              {EQUIPMENT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {EQUIPMENT_STATUS_LABELS[status].pl}
                </SelectItem>
              ))}
            </field.Select>
          )}
        </form.AppField>
      )}
    </>
  )
}
