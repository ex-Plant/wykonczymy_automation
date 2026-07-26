'use client'

import { useState, type ReactNode } from 'react'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import { InfoTooltip } from '@/components/ui/info-tooltip'

type VersionT = 'v1' | 'v2'

const OPTIONS: OptionT<VersionT>[] = [
  { value: 'v1', label: 'v1' },
  { value: 'v2', label: 'v2' },
]

const TOOLTIP =
  'v1 — robocizna i rabat z transakcji (tak jak dotychczas).\n' +
  'v2 — robocizna i rabat wyliczone z kosztorysu (ceny klienta, netto); ' +
  'bilans i marża liczone tym samym wzorem, tylko z tych wartości.\n' +
  'Materiały, wpłaty, wypłaty i strata w obu wersjach pochodzą z transakcji.'

type PropsT = {
  v1: ReactNode
  v2: ReactNode
}

// Both readings are rendered as slots by the server and switched here, so the comparison costs one
// render each and no round trip. Deliberately not persisted: this is a verification affordance the
// owner reaches for while the two planes are still being reconciled, not a saved preference.
export function StatsVersionToggle({ v1, v2 }: PropsT) {
  const [version, setVersion] = useState<VersionT>('v1')

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <ToggleGroup
          options={OPTIONS}
          value={version}
          onChange={setVersion}
          aria-label="Źródło robocizny i rabatu"
        />
        <InfoTooltip content={TOOLTIP} label="Czym różnią się v1 i v2" />
      </div>
      {version === 'v1' ? v1 : v2}
    </div>
  )
}
