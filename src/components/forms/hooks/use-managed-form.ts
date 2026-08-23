import { useState } from 'react'
import type { ZodType } from 'zod'
import type { UseBoundStore, StoreApi } from 'zustand'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import useCheckFormErrors from '@/components/forms/hooks/use-check-form-errors'
import type { FormStoreT } from '@/stores/create-form-store'
import type { ActionResultT } from '@/types/action'

type FormStoreHookT<TValues> = UseBoundStore<StoreApi<FormStoreT<TValues>>>

/** The copy of a confirm step raised by the values themselves, not by the button that was pressed. */
export type SubmitConfirmCopyT = {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
}

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
   * Raised between a valid form and the write: return the copy to ask with, or null to go straight
   * through. For the case where the values are legal but their CONSEQUENCE is not obvious on the
   * form — the owner is told what the write will cost him and gets to say yes anyway. It never
   * refuses: a wpłata that physically happened has to be recordable, or people start mistyping the
   * method to get past the door.
   */
  confirmBeforeSubmit?: (values: TValues) => SubmitConfirmCopyT | null
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
  confirmBeforeSubmit,
}: UseManagedFormArgsT<TValues, TData>) {
  const { submit } = useFormSubmit(formId)
  // The dialog's answer is awaited INSIDE onSubmit rather than staging the write for later: the
  // submit then keeps running as one flow, so the pending state, the toast and the store reset stay
  // where every other form has them.
  const [asked, setAsked] = useState<{
    copy: SubmitConfirmCopyT
    answer: (confirmed: boolean) => void
  } | null>(null)

  const storedValues = useFormStore((s) => s.formData)
  const updateFormData = useFormStore((s) => s.updateFormData)
  const resetFormData = useFormStore((s) => s.resetFormData)

  const reset = () => {
    resetFormData()
    onReset?.()
  }

  const initialValues =
    storedValues === null ? defaultValues : (mergeStored?.(storedValues) ?? storedValues)

  const form = useAppForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: schema,
    },
    listeners: {
      onChange: ({ formApi }) => updateFormData(formApi.state.values as TValues),
      onChangeDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      const copy = confirmBeforeSubmit?.(value as TValues)
      if (copy) {
        const confirmed = await new Promise<boolean>((answer) => setAsked({ copy, answer }))
        setAsked(null)
        if (!confirmed) return false
      }

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

  return {
    form,
    reset,
    // Spreadable onto ConfirmDialog. Empty title while closed — the dialog renders nothing then.
    submitConfirm: {
      open: asked !== null,
      title: asked?.copy.title ?? '',
      description: asked?.copy.description,
      confirmLabel: asked?.copy.confirmLabel,
      cancelLabel: asked?.copy.cancelLabel,
      onConfirm: () => asked?.answer(true),
      onCancel: () => asked?.answer(false),
    },
  }
}
