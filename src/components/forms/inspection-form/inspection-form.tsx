'use client'

import { useState } from 'react'
import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { FileInput } from '@/components/ui/file-input'
import { useStore } from '@/components/forms/hooks/form-hooks'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import { addMonthsToDay } from '@/lib/fleet/days'
import {
  INSPECTION_INTERVAL_MONTHS,
  INSPECTION_TYPE_LABELS,
  INSPECTION_TYPES,
  type InspectionTypeT,
} from '@/lib/fleet/inspection-types'
import { resolveInvoicePageIds } from '@/lib/utils/upload-file-client'
import { useInspectionFormStore } from '@/stores/form-stores'
import { inspectionFormSchema, type InspectionFormValuesT } from './inspection-schema'
import type { InspectionFormDataT } from './inspection-schema'
import type { AppFieldComponentsT } from '@/components/forms/types/form-types'
import type { ActionResultT } from '@/types/action'
import type { FleetRowT } from '@/types/fleet'

type InspectionFormPropsT = {
  formId: string
  defaultValues: InspectionFormValuesT
  action: (data: InspectionFormDataT) => Promise<ActionResultT>
  successMessage: string
  submitLabel: string
  submittingLabel: string
  onSubmitSuccess: () => void
  keepOpen?: boolean
  vehicles: Pick<FleetRowT, 'id' | 'registration' | 'make' | 'model'>[]
  /**
   * Pins the form to one car. The draft store is shared with the listing's dialog, so a restored
   * draft can carry a different vehicle than the page the user is on — this is what makes the page
   * win over the draft.
   */
  lockedVehicleId?: number
}

const optionalNumber = (value: string): number | undefined =>
  value.trim() === '' ? undefined : Number(value)

export function InspectionForm({
  formId,
  defaultValues,
  action,
  successMessage,
  submitLabel,
  submittingLabel,
  onSubmitSuccess,
  keepOpen,
  vehicles,
  lockedVehicleId,
}: InspectionFormPropsT) {
  // Files stay out of the form value: they are unserialisable, and the persisted draft would either
  // drop them silently or refuse to rehydrate.
  const [files, setFiles] = useState<File[]>([])

  const { form, reset } = useManagedForm<InspectionFormValuesT, InspectionFormDataT>({
    formId,
    useFormStore: useInspectionFormStore,
    schema: inspectionFormSchema,
    defaultValues,
    keepOpen,
    successMessage,
    onSubmitSuccess,
    onReset: () => setFiles([]),
    mergeStored: (stored) =>
      lockedVehicleId ? { ...stored, vehicle: String(lockedVehicleId) } : stored,
    // Upload first, then create — the row must never reference a media id that failed to land.
    action: async (data) => {
      const attachments = files.length > 0 ? await resolveInvoicePageIds(files) : []
      return action({ ...data, attachments })
    },
    toData: (value) => ({
      vehicle: Number(value.vehicle),
      type: value.type,
      performedAt: value.performedAt,
      nextDueAt: value.nextDueAt || undefined,
      odometer: optionalNumber(value.odometer),
      nextDueOdometer: optionalNumber(value.nextDueOdometer),
      cost: optionalNumber(value.cost),
      note: value.note,
      attachments: [],
    }),
  })

  const currentType = useStore(form.store, (state) => state.values.type)

  /**
   * Suggest the next due date from the type's interval. The real date is printed on the document, so
   * this is a suggestion, never an answer — and once the user has touched the field it is theirs:
   * a later type change must not silently overwrite a typed date.
   */
  const prefillNextDue = (type: InspectionTypeT) => {
    if (form.getFieldMeta('nextDueAt')?.isTouched) return

    const months = INSPECTION_INTERVAL_MONTHS[type]
    const performedAt = form.getFieldValue('performedAt')

    form.setFieldValue(
      'nextDueAt',
      months && performedAt ? addMonthsToDay(performedAt, months) : '',
    )
  }

  return (
    <FormShell form={form} onReset={reset}>
      <FieldGroup>
        <form.AppField name="vehicle">
          {(field: AppFieldComponentsT) => (
            <field.Select label="Pojazd" placeholder="Wybierz pojazd" showError>
              {vehicles.map((vehicle) => (
                <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                  {vehicle.registration} — {vehicle.make} {vehicle.model}
                </SelectItem>
              ))}
            </field.Select>
          )}
        </form.AppField>

        <form.AppField
          name="type"
          listeners={{ onChange: ({ value }) => prefillNextDue(value as InspectionTypeT) }}
        >
          {(field: AppFieldComponentsT) => (
            <field.Select label="Rodzaj" showError>
              {INSPECTION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {INSPECTION_TYPE_LABELS[type].pl}
                </SelectItem>
              ))}
            </field.Select>
          )}
        </form.AppField>

        <form.AppField name="performedAt">
          {(field: AppFieldComponentsT) => (
            <field.Input label="Data wykonania" type="date" showError />
          )}
        </form.AppField>

        <form.AppField name="nextDueAt">
          {(field: AppFieldComponentsT) => (
            <field.Input label="Następny termin" type="date" showError />
          )}
        </form.AppField>

        <form.AppField name="odometer">
          {(field: AppFieldComponentsT) => (
            <field.Input label="Przebieg (km)" type="number" placeholder="120000" showError />
          )}
        </form.AppField>

        {currentType === 'OIL_CHANGE' && (
          <form.AppField name="nextDueOdometer">
            {(field: AppFieldComponentsT) => (
              <field.Input
                label="Następna wymiana przy (km)"
                type="number"
                placeholder="135000"
                showError
              />
            )}
          </form.AppField>
        )}

        <form.AppField name="cost">
          {(field: AppFieldComponentsT) => (
            <field.Input label="Koszt (PLN)" type="number" placeholder="0.00" showError />
          )}
        </form.AppField>

        <form.AppField name="note">
          {(field: AppFieldComponentsT) => <field.Textarea label="Notatka" rows={2} />}
        </form.AppField>

        <FileInput
          label="Załączniki"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </FieldGroup>

      <FormFooter label={submitLabel} submittingLabel={submittingLabel} className="mt-6" />
    </FormShell>
  )
}
