import { AlertBadge } from '@/components/fleet/alert-badge'
import { OIL_CHANGE_INTERVAL_KM, isOilChangeOverdue } from '@/lib/fleet/thresholds'
import { formatKm } from '@/lib/utils/format-distance'

/**
 * The oil is past its interval. Renders nothing otherwise, so it can sit inline anywhere a vehicle
 * appears — the alarm is the presence of the badge, not a state it has to spell out.
 *
 * It prints the distance since the change, the same figure the vehicle page shows, so the two
 * surfaces never state two different numbers for one oil change.
 */
export function OilIntervalBadge({
  kmSinceOilChange,
  className,
}: {
  kmSinceOilChange: number | null
  className?: string
}) {
  if (!isOilChangeOverdue(kmSinceOilChange)) return null

  return (
    <AlertBadge
      className={className}
      title={`Interwał wymiany to ${formatKm(OIL_CHANGE_INTERVAL_KM)}`}
    >
      Olej {formatKm(kmSinceOilChange)}
    </AlertBadge>
  )
}
