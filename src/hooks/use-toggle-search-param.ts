'use client'

import { useSearchParams } from 'next/navigation'
import { useUrlFilterParams } from '@/hooks/use-url-filter-params'

type UseToggleSearchParamOptsT = {
  /** Extra params to clear when turning ON. */
  clearOnEnable?: string[]
}

export function useToggleSearchParam(
  baseUrl: string,
  paramKey: string,
  opts: UseToggleSearchParamOptsT = {},
) {
  const searchParams = useSearchParams()
  const { updateMultipleParams } = useUrlFilterParams(baseUrl)

  const isActive = searchParams.get(paramKey) === '1'

  function setActive(next: boolean) {
    const overrides: Record<string, string> = { [paramKey]: next ? '1' : '' }
    if (next) {
      for (const key of opts.clearOnEnable ?? []) overrides[key] = ''
    }
    updateMultipleParams(overrides)
  }

  return { isActive, setActive }
}
