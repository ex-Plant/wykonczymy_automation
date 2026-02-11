/**
 * Cart Store
 *
 * This store manages shopping cart state and persists it across browser sessions
 * using localStorage. It tracks cart items with their quantities and calculates
 * the total price automatically. Users can add, remove, and update item quantities.
 *
 * @example
 * const { formData, updateFormData, resetFormData  } = useCartStore()
 */

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { CartSchemaT } from '../schemas_example/cart-schema'

type CartFormStoreT = {
  formData: CartSchemaT
  updateFormData: (data: Partial<CartSchemaT>) => void
  resetFormData: () => void
}

const defaultFormData: CartSchemaT = {
  company_name: '',
  email: '',
  nip: '',
  project_stage: '',
  consents: {
    consent1: false,
    consent2: false,
  },
  users: [],
}

export const useCartFormS = create<CartFormStoreT>()(
  persist(
    (set) => ({
      formData: defaultFormData,
      updateFormData: (data) =>
        set((state) => ({
          formData: { ...state.formData, ...data },
        })),
      resetFormData: () => set({ formData: defaultFormData }),
    }),
    {
      name: 'cart-form-storage',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)

export default function useCartStore() {
  const formData = useCartFormS((s) => s.formData)
  const updateFormData = useCartFormS((s) => s.updateFormData)
  const resetFormData = useCartFormS((s) => s.resetFormData)
  return { formData, updateFormData, resetFormData }
}
