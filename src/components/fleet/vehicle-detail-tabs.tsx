'use client'

import { useState } from 'react'
import { DateRangePicker } from '@/components/filters/date-range-picker'
import { InspectionHistory } from '@/components/fleet/inspection-history'
import { VehicleCosts } from '@/components/fleet/vehicle-costs'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import { narrowHistory } from '@/lib/fleet/history-window'
import type { InspectionTypeT } from '@/lib/fleet/inspection-types'
import type { DateRangeT } from '@/lib/utils/date-range'
import type { InspectionHistoryEntryT } from '@/types/fleet'

type VehicleViewT = 'inspections' | 'costs'

const OPTIONS: OptionT<VehicleViewT>[] = [
  { value: 'inspections', label: 'Przeglądy' },
  { value: 'costs', label: 'Koszty' },
]

// Local state, not the URL — for the window as much as for the view. Both are lenses on the same
// history the page already loaded, and the page runs no per-vehicle query a window could narrow, so
// putting it in the URL would re-render the route (and re-run its markSeen write) to buy a filter the
// browser already holds the data for. Nobody links to a filtered card.
//
// The window is a lens on the past only: the deadline block above these tabs keeps reading the whole
// history, or filtering to March would let the card claim a przegląd is never due.
export function VehicleDetailTabs({
  historyByType,
}: {
  historyByType: Record<InspectionTypeT, InspectionHistoryEntryT[]>
}) {
  const [view, setView] = useState<VehicleViewT>('inspections')
  const [range, setRange] = useState<DateRangeT>({})

  const hasWindow = Boolean(range.from || range.to)
  const shown = narrowHistory(historyByType, range)

  return (
    <div className="flex flex-col gap-4">
      <DateRangePicker value={range} onChange={setRange} />

      <div className="w-fit">
        <ToggleGroup options={OPTIONS} value={view} onChange={setView} aria-label="Widok pojazdu" />
      </div>

      {view === 'inspections' ? (
        <InspectionHistory historyByType={shown} hasWindow={hasWindow} />
      ) : (
        <VehicleCosts historyByType={shown} hasWindow={hasWindow} />
      )}
    </div>
  )
}
