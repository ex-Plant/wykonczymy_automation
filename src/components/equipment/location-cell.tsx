import { formatPLDate } from '@/lib/utils/format-date'
import { cn } from '@/lib/utils/cn'
import type { EquipmentLocationT } from '@/lib/equipment/types'

type LocationCellPropsT = {
  location: EquipmentLocationT
  locatedAt: string | null
  /**
   * Whether a missing location is a gap worth flagging. A sold or stolen item has nobody holding it
   * by definition (`isLiveStatus`), so the same empty cell must not read as an alarm there.
   */
  live: boolean
}

/**
 * A person and a warehouse render identically on purpose: „u kogo to jest" is one question with one
 * kind of answer, and giving the warehouse its own visual language would suggest a second axis the
 * module does not have. Only a workshop is marked, because an item in a workshop is unavailable.
 */
export function LocationCell({ location, locatedAt, live }: LocationCellPropsT) {
  if (location.kind === 'unknown') {
    return (
      <span className={cn('text-xs', live ? 'text-destructive' : 'text-muted-foreground')}>
        {live ? 'Nie wiadomo gdzie' : '—'}
      </span>
    )
  }

  return (
    <div className="flex flex-col leading-tight">
      <span className="text-sm">
        {location.kind === 'service' ? `Serwis: ${location.name}` : location.name}
      </span>
      {locatedAt && (
        <span className="text-muted-foreground text-xs">od {formatPLDate(locatedAt)}</span>
      )}
    </div>
  )
}
