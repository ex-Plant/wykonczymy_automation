import { AlertTriangle } from 'lucide-react'
import { BADGE_BASE } from '@/components/ui/badge'
import { INSPECTION_TYPE_LABELS, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import { cn } from '@/lib/utils/cn'

/**
 * The badge prints a short noun, not the type's own label: „Wymiana oleju do wymiany" is nonsense,
 * and the „do wymiany" framing comes from the column header and the tooltip instead.
 */
const FLAG_BADGE_LABELS: Record<InspectionTypeT, string> = {
  TECHNICAL: 'Przegląd',
  INSURANCE: 'OC',
  OIL_CHANGE: 'Olej',
  WARRANTY: 'Gwarancja',
  TYRES: 'Opony',
  SERVICE: 'Serwis',
}

/**
 * A manual „do zrobienia" mark on a vehicle. Same weight as `OilIntervalBadge` on purpose — a mark
 * typed by hand and an automatically detected overrun are the same alarm to whoever reads the row.
 */
export function FlagBadge({ type, className }: { type: InspectionTypeT; className?: string }) {
  return (
    <span
      className={cn(BADGE_BASE, 'bg-destructive/10 text-destructive gap-1', className)}
      title={`Oznaczone ręcznie: ${INSPECTION_TYPE_LABELS[type].pl}`}
    >
      <AlertTriangle className="size-3" />
      {FLAG_BADGE_LABELS[type]}
    </span>
  )
}
