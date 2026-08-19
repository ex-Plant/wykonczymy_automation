import { AlertTriangle } from 'lucide-react'
import { BADGE_BASE } from '@/components/ui/badge'
import { OIL_CHANGE_INTERVAL_KM } from '@/lib/fleet/inspection-types'
import { cn } from '@/lib/utils/cn'
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
  if (kmSinceOilChange === null || kmSinceOilChange <= OIL_CHANGE_INTERVAL_KM) return null

  return (
    <span
      className={cn(BADGE_BASE, 'bg-destructive/10 text-destructive gap-1', className)}
      title={`Od ostatniej wymiany oleju minęło ${formatKm(kmSinceOilChange)}`}
    >
      <AlertTriangle className="size-3" />
      Olej +{formatKm(kmSinceOilChange - OIL_CHANGE_INTERVAL_KM)}
    </span>
  )
}
