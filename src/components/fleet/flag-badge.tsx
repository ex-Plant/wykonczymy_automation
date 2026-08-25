import { AlertBadge } from '@/components/fleet/alert-badge'
import { INSPECTION_TYPE_LABELS, type FlaggableInspectionTypeT } from '@/lib/fleet/inspection-types'

/**
 * The badge prints a short noun, not the type's own label: „Wymiana oleju do wymiany" is nonsense,
 * and the „do wymiany" framing comes from the column header and the tooltip instead.
 */
const FLAG_BADGE_LABELS: Record<FlaggableInspectionTypeT, string> = {
  TECHNICAL: 'Przegląd',
  INSURANCE: 'OC',
  OIL_CHANGE: 'Olej',
  WARRANTY: 'Gwarancja',
  TYRES: 'Opony',
  SERVICE: 'Serwis',
}

export function FlagBadge({
  type,
  className,
}: {
  type: FlaggableInspectionTypeT
  className?: string
}) {
  return (
    <AlertBadge title={`Do wymiany: ${INSPECTION_TYPE_LABELS[type].pl}`} className={className}>
      {FLAG_BADGE_LABELS[type]}
    </AlertBadge>
  )
}
