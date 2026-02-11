import { useEffect, useRef } from 'react'

export default function useSyncFormStore<TFormData>(
  updateFormData: (data: Partial<TFormData>) => void,
  formValues: TFormData,
) {
  // Subscribe to form changes and update Zustand store in real-time

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!formValues) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    //
    timeoutRef.current = setTimeout(() => {
      updateFormData(formValues)
    }, 1000)
    //
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [formValues, updateFormData])
}
