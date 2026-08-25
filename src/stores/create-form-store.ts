import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type FormStoreT<TValues> = {
  formData: TValues | null
  /** One slot per form type, but „Dodaj pojazd" and „Edytuj pojazd 7" are two instances of it. */
  formId: string | null
  updateFormData: (formId: string, data: TValues) => void
  resetFormData: () => void
}

export function createFormStore<TValues>(name: string) {
  return create<FormStoreT<TValues>>()(
    persist(
      (set) => ({
        formData: null,
        formId: null,
        updateFormData: (formId, data) =>
          set((state) => {
            if (state.formId === formId && JSON.stringify(state.formData) === JSON.stringify(data))
              return state
            return { formId, formData: data }
          }),
        resetFormData: () => set({ formId: null, formData: null }),
      }),
      {
        name,
        storage: createJSONStorage(() => sessionStorage),
      },
    ),
  )
}
