'use client'

import { FieldGroup } from '@/components/ui/field'
import { Combobox } from '@/components/ui/combobox'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import FormBase from '@/components/forms/form-components/form-base'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import { UNIT_SUGGESTIONS } from '@/lib/kosztorys/constants'
import { useWorkCatalogueItemFormStore } from '@/stores/form-stores'
import {
  toMoney,
  workCatalogueItemFormSchema,
  type WorkCatalogueItemDataT,
  type WorkCatalogueItemFormValuesT,
} from './work-catalogue-item-schema'
import type { ActionResultT } from '@/types/action'

type WorkCatalogueItemFormPropsT = {
  formId: string
  defaultValues: WorkCatalogueItemFormValuesT
  /** Categories already in the katalog, offered as quick-picks so they don't fork on a typo. */
  categorySuggestions: readonly string[]
  action: (data: WorkCatalogueItemDataT) => Promise<ActionResultT>
  successMessage: string
  submitLabel: string
  submittingLabel: string
  onSubmitSuccess: () => void
  keepOpen?: boolean
  /** False on the edit dialog — see `useManagedForm`. */
  persistDraft?: boolean
}

// Matches `Input`, so the two comboboxes read as fields you can type into rather than as captions.
const COMBOBOX_FIELD = 'border-input bg-background h-9 w-full rounded-md border px-3'

export function WorkCatalogueItemForm({
  formId,
  defaultValues,
  categorySuggestions,
  action,
  successMessage,
  submitLabel,
  submittingLabel,
  onSubmitSuccess,
  keepOpen,
  persistDraft,
}: WorkCatalogueItemFormPropsT) {
  const { form, reset } = useManagedForm<WorkCatalogueItemFormValuesT, WorkCatalogueItemDataT>({
    formId,
    useFormStore: useWorkCatalogueItemFormStore,
    schema: workCatalogueItemFormSchema,
    defaultValues,
    keepOpen,
    successMessage,
    onSubmitSuccess,
    action,
    persistDraft,
    toData: (value) => ({
      description: value.description,
      category: value.category,
      unit: value.unit,
      clientPrice: toMoney(value.clientPrice),
      wToolsRate: toMoney(value.wToolsRate),
      ownToolsRate: toMoney(value.ownToolsRate),
    }),
  })

  return (
    <FormShell form={form} onReset={reset}>
      <FieldGroup>
        <form.AppField name="description">
          {(field) => (
            <field.Textarea label="Opis pracy" rows={2} placeholder="Malowanie ścian" showError />
          )}
        </form.AppField>

        <form.AppField name="category">
          {(field) => (
            <FormBase label="Kategoria" showError>
              <Combobox
                value={field.state.value}
                onChange={field.handleChange}
                options={categorySuggestions}
                allowCustom
                modal
                className={COMBOBOX_FIELD}
                contentClassName="w-(--radix-popover-trigger-width)"
                placeholder="Wybierz lub wpisz nową…"
              />
            </FormBase>
          )}
        </form.AppField>

        <form.AppField name="unit">
          {(field) => (
            <FormBase label="j.m." showError>
              <Combobox
                value={field.state.value}
                onChange={field.handleChange}
                options={UNIT_SUGGESTIONS}
                allowCustom
                modal
                className={COMBOBOX_FIELD}
                contentClassName="w-(--radix-popover-trigger-width)"
                placeholder="Wybierz lub wpisz nową…"
              />
            </FormBase>
          )}
        </form.AppField>

        <form.AppField name="clientPrice">
          {(field) => (
            <field.Input label="Cena j.m. (PLN)" type="number" placeholder="0.00" showError />
          )}
        </form.AppField>

        <form.AppField name="wToolsRate">
          {(field) => (
            <field.Input
              label="Stawka z narzędziami (PLN)"
              type="number"
              placeholder="0.00"
              showError
            />
          )}
        </form.AppField>

        <form.AppField name="ownToolsRate">
          {(field) => (
            <field.Input
              label="Stawka bez narzędzi (PLN)"
              type="number"
              placeholder="0.00"
              showError
            />
          )}
        </form.AppField>
      </FieldGroup>

      <FormFooter label={submitLabel} submittingLabel={submittingLabel} className="mt-6" />
    </FormShell>
  )
}
