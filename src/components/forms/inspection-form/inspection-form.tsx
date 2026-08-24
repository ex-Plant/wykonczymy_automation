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
import { reportBlockedFiles } from '@/lib/invoices/blocked-files-message'
import { ingestFiles } from '@/lib/invoices/ingest-files'
import { discardOrphanedUploads } from '@/lib/utils/discard-orphaned-uploads'
import { toastMessage } from '@/lib/utils/toast'
import { InvoiceUploadError, resolveInvoicePageIds } from '@/lib/utils/upload-file-client'
import { formatKm } from '@/lib/utils/format-distance'
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
  vehicles: Pick<FleetRowT, 'id' | 'registration' | 'make' | 'model' | 'latestOdometer'>[]
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
  // drop them silently or refuse to rehydrate. What is held here is already ingested — HEIC decoded,
  // compressed, oversize rejected — so the submit path only ever uploads files Blob will accept.
  const [files, setFiles] = useState<File[]>([])
  const [isIngesting, setIsIngesting] = useState(false)

  // The `finally` is load-bearing: an unexpected rejection (e.g. a chunk-load failure on the lazy
  // HEIC import) must still release the form, or submit stays disabled until a reload.
  async function ingestPicked(picked: File[]) {
    setIsIngesting(true)
    try {
      const { processed, blocked } = await ingestFiles(picked)
      reportBlockedFiles(blocked)
      setFiles(processed.filter((file) => file !== undefined))
    } catch {
      // TODO(EX-449) SENTRY-REQUIRED: unexpected ingest failure (not a BlockedFileError) — capture
      // once Sentry is wired; for now the user gets a generic retry toast.
      toastMessage('Nie udało się przetworzyć pliku — spróbuj ponownie.', 'error', 6000)
      setFiles([])
    } finally {
      setIsIngesting(false)
    }
  }

  const { form, reset } = useManagedForm<InspectionFormValuesT, InspectionFormDataT>({
    formId,
    useFormStore: useInspectionFormStore,
    schema: inspectionFormSchema,
    defaultValues,
    keepOpen,
    successMessage,
    onSubmitSuccess,
    onReset: () => setFiles([]),
    // A draft saved before today restores yesterday's date, and an older one restores the empty
    // string the form used to default to — neither is what "data przeglądu = dziś" promises.
    mergeStored: (stored) => ({
      ...stored,
      ...(lockedVehicleId && { vehicle: String(lockedVehicleId) }),
      performedAt: stored.performedAt || defaultValues.performedAt,
    }),
    // Upload first, then create — the row must never reference a media id that failed to land.
    action: async (data) => {
      // Backstop to the disabled submit button, which a keyboard Enter bypasses: a file still being
      // ingested is not in `files` yet, so the przegląd would save without its załącznik.
      if (isIngesting) {
        return { success: false, error: 'Poczekaj na przetworzenie plików.' }
      }

      let attachments: number[] = []

      if (files.length > 0) {
        try {
          attachments = await resolveInvoicePageIds(files)
        } catch (err) {
          // A partly-failed batch still landed pages in Blob; those belong to no inspection.
          if (err instanceof InvoiceUploadError) discardOrphanedUploads(err.uploadedIds)
          return {
            success: false,
            error: err instanceof Error ? err.message : 'Nie udało się przesłać plików',
          }
        }
      }

      const result = await action({ ...data, attachments })
      // The pages are in Blob and the row that would have referenced them was never created, so
      // nothing can reach them again. The user keeps the form and can resubmit, which re-uploads.
      if (!result.success && attachments.length > 0) discardOrphanedUploads(attachments)

      return result
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
  const currentVehicle = useStore(form.store, (state) => state.values.vehicle)
  const currentOdometer = useStore(form.store, (state) => state.values.odometer)

  /**
   * The last reading this car is known to have had, when the one being typed is below it. A swapped
   * instrument cluster makes a lower reading legitimate, so this warns and never blocks the submit.
   */
  const previousOdometer =
    vehicles.find((vehicle) => String(vehicle.id) === currentVehicle)?.latestOdometer ?? null
  const typedOdometer = optionalNumber(currentOdometer)
  const odometerWentBackwardsFrom =
    previousOdometer !== null && typedOdometer !== undefined && typedOdometer < previousOdometer
      ? previousOdometer
      : null

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

  const onTypeChange = (type: InspectionTypeT) => {
    prefillNextDue(type)
    // The km target is rendered only for OIL_CHANGE, but hiding a field does not clear it — without
    // this a TECHNICAL row persists an oil target it has no business carrying.
    if (type !== 'OIL_CHANGE') form.setFieldValue('nextDueOdometer', '')
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
          listeners={{ onChange: ({ value }) => onTypeChange(value as InspectionTypeT) }}
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

        {odometerWentBackwardsFrom !== null && (
          <p className="text-chart-orange -mt-2 text-xs">
            Ostatni zapisany przebieg to {formatKm(odometerWentBackwardsFrom)} — wpisany odczyt jest
            niższy.
          </p>
        )}

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
          disabled={isIngesting}
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? [])
            e.target.value = '' // allow re-picking the same file after a reset or a failed ingest
            ingestPicked(picked)
          }}
        />
      </FieldGroup>

      <FormFooter
        label={submitLabel}
        submittingLabel={submittingLabel}
        className="mt-6"
        disabled={isIngesting}
      />
    </FormShell>
  )
}
