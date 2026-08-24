import { AlertBadge } from '@/components/fleet/alert-badge'
import { OIL_CHANGE_INTERVAL_KM, isOilChangeOverdue } from '@/lib/fleet/thresholds'
import { formatKm } from '@/lib/utils/format-distance'

/**
 * The oil is past its interval. Renders nothing otherwise, so it can sit inline anywhere a vehicle
 * appears — the alarm is the presence of the badge, not a state it has to spell out.
 *
 * It prints the overrun, not the distance since the change: next to the full figure on the detail
 * page that would just say the same number twice, and in the table there is no figure to compare to.
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
      title={`Od ostatniej wymiany oleju minęło ${formatKm(kmSinceOilChange)}`}
    >
      Olej +{formatKm(kmSinceOilChange - OIL_CHANGE_INTERVAL_KM)}
    </AlertBadge>
  )
}
