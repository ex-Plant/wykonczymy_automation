/**
 * Survey Form Store
 *
 * This store persists the survey form state across multiple page refreshes using
 * sessionStorage. The form data includes brand evaluations, rejection reasons,
 * contact preferences, and additional feedback. The current step is also tracked
 * to allow users to resume from where they left off.
 *
 * @example
 * const { formData, currentStep, setStep, updateFormData } = useSurveyFormStore()
 */

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { SurveySchemaT } from '../schemas_example/survey-schema'

type SurveyStoreT = {
  formData: SurveySchemaT
  currentStep: number
  setStep: (step: number) => void
  updateFormData: (data: Partial<SurveySchemaT>) => void
  resetFormData: () => void
}

const defaultFormData: SurveySchemaT = {
  considered_brands: [],
  rejected_brand: '',
  brand_evaluations: {},
  rejection_reasons: [],
  rejection_other: '',
  contact_request: false,
  contact_brands: [],
  missing_brands: '',
  improvement_suggestion: '',
}

export const useSurveyFormS = create<SurveyStoreT>()(
  persist(
    (set) => ({
      formData: defaultFormData,
      currentStep: 1,
      setStep: (step) => set({ currentStep: step }),
      updateFormData: (data) =>
        set((state) => ({
          formData: { ...state.formData, ...data },
        })),
      resetFormData: () => set({ formData: defaultFormData, currentStep: 1 }),
    }),
    {
      name: 'survey-form-storage',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)

export function useSurveyFormStore() {
  const formData = useSurveyFormS((s) => s.formData)
  const currentStep = useSurveyFormS((s) => s.currentStep)
  const setStep = useSurveyFormS((s) => s.setStep)
  const updateFormData = useSurveyFormS((s) => s.updateFormData)
  const resetFormData = useSurveyFormS((s) => s.resetFormData)

  return { formData, currentStep, setStep, updateFormData, resetFormData }
}
