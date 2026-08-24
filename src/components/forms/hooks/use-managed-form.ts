import type { ZodType } from 'zod'
import type { UseBoundStore, StoreApi } from 'zustand'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import useCheckFormErrors from '@/components/forms/hooks/use-check-form-errors'
import type { FormStoreT } from '@/stores/create-form-store'
import type { ActionResultT } from '@/types/action'

type FormStoreHookT<TValues> = UseBoundStore<StoreApi<FormStoreT<TValues>>>

type UseManagedFormArgsT<TValues, TData> = {
  formId: string
  useFormStore: FormStoreHookT<TValues>
  schema: ZodType<unknown, TValues>
  defaultValues: TValues
  keepOpen?: boolean
  successMessage: string
  onSubmitSuccess: () => void
  /** Map the string-typed form values to the action's domain payload. */
  toData: (values: TValues) => TData
  action: (data: TData) => Promise<ActionResultT>
  /** Extra cleanup run alongside clearing the persisted form data (e.g. reset registerBalance). */
  onReset?: () => void
  /**
   * Last say over the restored draft — lets a form fill a field the draft left empty from context
   * the draft can't know (e.g. the investment the URL is scoped to). Not applied to `defaultValues`,
   * which the caller seeds directly.
   */
  mergeStored?: (stored: TValues) => TValues
  /**
   * Whether typed values outlive the dialog. Only sound on a CREATE form, where the draft is the
   * only copy of what was typed and the record it describes does not exist yet.
   *
   * An EDIT form must pass `false`: there `defaultValues` is a snapshot of a live row, the draft is
   * a divergence from it, and the submit writes back EVERY field. So a restored draft silently
   * reverts whatever changed in the meantime — another editor's fix, or a status changed elsewhere
   * on the page — in fields the user never touched. Fresh server data has to win.
   */
  persistDraft?: boolean
}

/**
 * Encapsulates the wiring every transfer form repeats: the session-store selector
 * triplet, the useAppForm config (persisted onChange + onSubmit → mapped submit),
 * and the error-focus hook. Callers keep only their fields + data mapping.
 */
export function useManagedForm<TValues, TData>({
  formId,
  useFormStore,
  schema,
  defaultValues,
  keepOpen,
  successMessage,
  onSubmitSuccess,
  toData,
  action,
  onReset,
  mergeStored,
  persistDraft = true,
}: UseManagedFormArgsT<TValues, TData>) {
  const { submit } = useFormSubmit(formId)

  const storedFormId = useFormStore((s) => s.formId)
  const storedValues = useFormStore((s) => s.formData)
  const updateFormData = useFormStore((s) => s.updateFormData)
  const resetFormData = useFormStore((s) => s.resetFormData)

  const reset = () => {
    // Clearing the single slot is only ours to do if we wrote it — an edit form doing so would drop
    // an unrelated „Dodaj…" draft still in progress.
    if (persistDraft) resetFormData()
    onReset?.()
  }

  // A draft belongs to the instance that wrote it. „Dodaj pojazd" and „Edytuj pojazd 7" share one
  // store slot, so without this an abandoned add-draft would win over the record being edited.
  const draft = persistDraft && storedFormId === formId ? storedValues : null

  const initialValues = draft === null ? defaultValues : (mergeStored?.(draft) ?? draft)

  const form = useAppForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: schema,
    },
    listeners: {
      onChange: ({ formApi }) => {
        if (persistDraft) updateFormData(formId, formApi.state.values as TValues)
      },
      onChangeDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      await submit(!!keepOpen, {
        form,
        action: () => action(toData(value as TValues)),
        successMessage,
        onSubmitSuccess,
        onReset: reset,
      })

      return false
    },
  })

  useCheckFormErrors(form)

  return { form, reset }
}
