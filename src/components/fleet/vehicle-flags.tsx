'use client'

import { startTransition, useOptimistic } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { setVehicleFlagsAction } from '@/lib/actions/fleet'
import { FLAGGABLE_INSPECTION_TYPES, INSPECTION_TYPE_LABELS } from '@/lib/fleet/inspection-types'
import type { FlaggableInspectionTypeT } from '@/lib/fleet/inspection-types'
import { toastMessage } from '@/lib/utils/toast'

/**
 * The only place marks are edited. Ticking is optimistic — the boxes are the whole UI, so waiting on
 * the round-trip would make every click feel broken.
 *
 * `useOptimistic` rather than `useState`, because the server's set moves on its own: recording an
 * inspection from this same page retires the matching mark, and a component seeded once would keep
 * showing the tick while the badge is already gone — then re-stamp that type on the next unrelated
 * toggle. Anchoring on the prop also makes the failure path free: the tick reverts to whatever the
 * server last said, with no pre-toggle snapshot to keep.
 */
export function VehicleFlags({
  vehicleId,
  active,
}: {
  vehicleId: number
  active: FlaggableInspectionTypeT[]
}) {
  const [selected, setSelected] = useOptimistic(active)

  function toggle(type: FlaggableInspectionTypeT) {
    const next = selected.includes(type)
      ? selected.filter((candidate) => candidate !== type)
      : [...selected, type]

    startTransition(async () => {
      setSelected(next)

      try {
        const result = await setVehicleFlagsAction(vehicleId, next)
        if (!result.success) toastMessage(result.error, 'error')
      } catch {
        // The action never rejects on a handler throw — `protectedAction` catches those. Reaching
        // here means the request itself failed, so nothing was persisted.
        // TODO(EX-449) SENTRY-REQUIRED: transport failure on setVehicleFlagsAction
        toastMessage('Nie udało się zapisać oznaczenia — spróbuj ponownie.', 'error')
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {FLAGGABLE_INSPECTION_TYPES.map((type) => (
        <label key={type} className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={selected.includes(type)} onCheckedChange={() => toggle(type)} />
          {INSPECTION_TYPE_LABELS[type].pl}
        </label>
      ))}
    </div>
  )
}
