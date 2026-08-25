'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import { STATS_VERSION_PARAM, type StatsVersionT } from '@/lib/constants/stats-version'

const OPTIONS: OptionT<StatsVersionT>[] = [
  { value: 'v1', label: 'v1' },
  { value: 'v2', label: 'v2' },
]

type PropsT = {
  version: StatsVersionT
}

// The reading lives in the URL, not in component state: v1 must cost exactly what the page cost
// before this change, and only a server round trip can skip v2's fetches. Deliberately not
// persisted anywhere — this is a verification affordance the owner reaches for while the two planes
// are still being reconciled, not a saved preference.
export function StatsVersionToggle({ version }: PropsT) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(next: StatsVersionT) {
    const params = new URLSearchParams(searchParams)
    params.set(STATS_VERSION_PARAM, next)
    router.push(`${pathname}?${params}`)
  }

  return (
    <ToggleGroup
      options={OPTIONS}
      value={version}
      onChange={handleChange}
      aria-label="Źródło robocizny i rabatu"
    />
  )
}
