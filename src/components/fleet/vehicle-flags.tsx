'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Checkbox } from '@/components/ui/checkbox'
import { setVehicleFlagsAction } from '@/lib/actions/fleet'
import { INSPECTION_TYPE_LABELS, INSPECTION_TYPES } from '@/lib/fleet/inspection-types'
import type { InspectionTypeT } from '@/lib/fleet/inspection-types'
import { toastMessage } from '@/lib/utils/toast'

/**
 * The only place marks are edited. Ticking is optimistic — the boxes are the whole UI, so waiting on
 * the round-trip would make every click feel broken — but a failed write rolls the local set back to
 * what the server last gave us rather than leaving a tick nothing persisted.
 */
export function VehicleFlags({
  vehicleId,
  active,
}: {
  vehicleId: number
  active: InspectionTypeT[]
}) {
  const [selected, setSelected] = useState<InspectionTypeT[]>(active)
  const router = useRouter()

  async function toggle(type: InspectionTypeT) {
    const next = selected.includes(type)
      ? selected.filter((candidate) => candidate !== type)
      : [...selected, type]

    setSelected(next)

    const result = await setVehicleFlagsAction(vehicleId, next)
    if (!result.success) {
      setSelected(active)
      toastMessage(result.error, 'error')
      return
    }

    router.refresh()
  }

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {INSPECTION_TYPES.map((type) => (
        <label key={type} className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={selected.includes(type)} onCheckedChange={() => toggle(type)} />
          {INSPECTION_TYPE_LABELS[type].pl}
        </label>
      ))}
    </div>
  )
}
