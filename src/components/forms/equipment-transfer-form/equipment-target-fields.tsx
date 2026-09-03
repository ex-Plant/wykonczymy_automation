'use client'

import { SelectItem } from '@/components/ui/select'
import { EntityComboboxField } from '@/components/forms/form-fields/entity-combobox-field'
import { useFieldValue } from '@/components/forms/hooks/use-field-value'
import type { FormWithFieldT } from '@/components/forms/hooks/form-hooks'
import {
  EQUIPMENT_TARGET_KIND_LABELS,
  EQUIPMENT_TARGET_KINDS,
  type EquipmentTargetKindT,
} from '@/lib/equipment/target-kinds'
import type { WarehouseOptionT } from '@/lib/queries/equipment'
import type { WorkerRefT } from '@/types/reference-data'

export type TargetFieldNameT = 'occurredAt' | 'targetKind' | 'holder' | 'warehouse' | 'serviceProvider'

type EquipmentTargetFieldsPropsT = {
  form: FormWithFieldT<TargetFieldNameT>
  workers: WorkerRefT[]
  warehouses: WarehouseOptionT[]
}

/**
 * „Gdzie trafia" — one choice, then the one field that choice needs. Shared by „Przekaż" and by
 * „Dodaj sprzęt", whose first entry answers exactly the same question.
 */
export function EquipmentTargetFields({ form, workers, warehouses }: EquipmentTargetFieldsPropsT) {
  const targetKind = useFieldValue<EquipmentTargetKindT>(form, 'targetKind')

  return (
    <>
      <form.AppField name="occurredAt">
        {(field) => <field.DatePicker label="Data przekazania" showError />}
      </form.AppField>

      <form.AppField
        name="targetKind"
        // The abandoned branches are cleared, not left dangling: a holder typed and then switched
        // away from would still be sitting in the draft when the form maps its values.
        listeners={{
          onChange: () => {
            form.resetField('holder')
            form.resetField('warehouse')
            form.resetField('serviceProvider')
          },
        }}
      >
        {(field) => (
          <field.Select label="Gdzie trafia" showError>
            {EQUIPMENT_TARGET_KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {EQUIPMENT_TARGET_KIND_LABELS[kind]}
              </SelectItem>
            ))}
          </field.Select>
        )}
      </form.AppField>

      {targetKind === 'holder' && (
        <EntityComboboxField form={form} variant="holder" items={workers} />
      )}

      {targetKind === 'warehouse' && (
        <form.AppField name="warehouse">
          {(field) => (
            <field.Select label="Magazyn" placeholder="Wybierz magazyn" showError>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </field.Select>
          )}
        </form.AppField>
      )}

      {targetKind === 'service' && (
        <form.AppField name="serviceProvider">
          {(field) => <field.Input label="Serwis" placeholder="Nazwa warsztatu" showError />}
        </form.AppField>
      )}
    </>
  )
}
