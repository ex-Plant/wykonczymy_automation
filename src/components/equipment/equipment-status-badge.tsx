import { BADGE_BASE } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { EQUIPMENT_STATUS_LABELS, type EquipmentStatusT } from '@/lib/equipment/equipment-status'

// Only „w użyciu" is coloured. The other four are all ways of „not ours to track any more" and read
// as one muted state — colouring them apart would suggest a difference the listing never acts on.
const STATUS_CLASSNAMES: Record<EquipmentStatusT, string> = {
  IN_USE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  RETIRED: 'bg-muted text-muted-foreground',
  SOLD: 'bg-muted text-muted-foreground',
  LOST: 'bg-muted text-muted-foreground',
  STOLEN: 'bg-muted text-muted-foreground',
}

export function EquipmentStatusBadge({ status }: { status: EquipmentStatusT }) {
  return (
    <span className={cn(BADGE_BASE, STATUS_CLASSNAMES[status])}>
      {EQUIPMENT_STATUS_LABELS[status].pl}
    </span>
  )
}
