'use client'

import { useState } from 'react'
import { InspectionHistory } from '@/components/fleet/inspection-history'
import { VehicleCosts } from '@/components/fleet/vehicle-costs'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import type { InspectionTypeT } from '@/lib/fleet/inspection-types'
import type { InspectionHistoryEntryT } from '@/types/fleet'

type VehicleViewT = 'inspections' | 'costs'

const OPTIONS: OptionT<VehicleViewT>[] = [
  { value: 'inspections', label: 'Przeglądy' },
  { value: 'costs', label: 'Koszty' },
]

// Local state, not the URL: both views are computed from the same history the page already loaded,
// so switching costs nothing and there is no server round trip worth linking to.
export function VehicleDetailTabs({
  historyByType,
}: {
  historyByType: Record<InspectionTypeT, InspectionHistoryEntryT[]>
}) {
  const [view, setView] = useState<VehicleViewT>('inspections')

  return (
    <div className="flex flex-col gap-4">
      <div className="w-fit">
        <ToggleGroup options={OPTIONS} value={view} onChange={setView} aria-label="Widok pojazdu" />
      </div>

      {view === 'inspections' ? (
        <InspectionHistory historyByType={historyByType} />
      ) : (
        <VehicleCosts historyByType={historyByType} />
      )}
    </div>
  )
}
