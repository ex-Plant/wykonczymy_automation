import { BADGE_BASE } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { VEHICLE_STATUS_LABELS, type VehicleStatusT } from '@/lib/fleet/vehicle-status'

const STATUS_CLASSNAMES: Record<VehicleStatusT, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  RETIRED: 'bg-muted text-muted-foreground',
}

export function VehicleStatusBadge({ status }: { status: VehicleStatusT }) {
  return (
    <span className={cn(BADGE_BASE, STATUS_CLASSNAMES[status])}>
      {VEHICLE_STATUS_LABELS[status].pl}
    </span>
  )
}
