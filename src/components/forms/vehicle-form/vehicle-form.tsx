'use client'

import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import { VEHICLE_STATUS_LABELS, VEHICLE_STATUSES } from '@/lib/fleet/vehicle-status'
import { useVehicleFormStore } from '@/stores/form-stores'
import { vehicleFormSchema, type VehicleFormValuesT } from './vehicle-schema'
import type { VehicleFormDataT } from './vehicle-schema'
import type { AppFieldComponentsT } from '@/components/forms/types/form-types'
import type { ActionResultT } from '@/types/action'

type VehicleFormPropsT = {
  formId: string
  defaultValues: VehicleFormValuesT
  action: (data: VehicleFormDataT) => Promise<ActionResultT>
  successMessage: string
  submitLabel: string
  submittingLabel: string
  onSubmitSuccess: () => void
  keepOpen?: boolean
  /** False on the edit dialogs — see `useManagedForm`. */
  persistDraft?: boolean
}

export function VehicleForm({
  formId,
  defaultValues,
  action,
  successMessage,
  submitLabel,
  submittingLabel,
  onSubmitSuccess,
  keepOpen,
  persistDraft,
}: VehicleFormPropsT) {
  const { form, reset } = useManagedForm<VehicleFormValuesT, VehicleFormDataT>({
    formId,
    useFormStore: useVehicleFormStore,
    schema: vehicleFormSchema,
    defaultValues,
    keepOpen,
    successMessage,
    onSubmitSuccess,
    action,
    persistDraft,
    toData: (value) => ({
      registration: value.registration.trim().toUpperCase(),
      make: value.make,
      model: value.model,
      year: value.year ? Number(value.year) : null,
      vin: value.vin.trim().toUpperCase(),
      status: value.status,
    }),
  })

  return (
    <FormShell form={form} onReset={reset}>
      <FieldGroup>
        <form.AppField name="registration">
          {(field: AppFieldComponentsT) => (
            <field.Input label="Numer rejestracyjny" placeholder="WX 12345" showError />
          )}
        </form.AppField>

        <form.AppField name="make">
          {(field: AppFieldComponentsT) => (
            <field.Input label="Marka" placeholder="Ford" showError />
          )}
        </form.AppField>

        <form.AppField name="model">
          {(field: AppFieldComponentsT) => (
            <field.Input label="Model" placeholder="Transit" showError />
          )}
        </form.AppField>

        <form.AppField name="year">
          {(field: AppFieldComponentsT) => (
            <field.Input label="Rocznik" type="number" placeholder="2019" showError />
          )}
        </form.AppField>

        <form.AppField name="vin">
          {(field: AppFieldComponentsT) => <field.Input label="VIN" showError />}
        </form.AppField>

        <form.AppField name="status">
          {(field: AppFieldComponentsT) => (
            <field.Select label="Status" showError>
              {VEHICLE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {VEHICLE_STATUS_LABELS[status].pl}
                </SelectItem>
              ))}
            </field.Select>
          )}
        </form.AppField>
      </FieldGroup>

      <FormFooter label={submitLabel} submittingLabel={submittingLabel} className="mt-6" />
    </FormShell>
  )
}
