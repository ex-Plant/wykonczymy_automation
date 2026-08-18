import { Paperclip } from 'lucide-react'
import { INSPECTION_TYPE_LABELS, INSPECTION_TYPES } from '@/lib/fleet/inspection-types'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'
import type { InspectionHistoryEntryT, VehicleDetailT } from '@/types/fleet'

const formatKm = (value: number) => `${value.toLocaleString('pl-PL')} km`

function HistoryEntry({ entry }: { entry: InspectionHistoryEntryT }) {
  return (
    <li className="border-border flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b py-2 last:border-b-0">
      <span className="text-sm font-medium">{formatPLDate(entry.performedAt)}</span>

      {entry.nextDueAt && (
        <span className="text-muted-foreground text-xs">
          następny: {formatPLDate(entry.nextDueAt)}
        </span>
      )}

      {entry.odometer !== null && <span className="text-xs">{formatKm(entry.odometer)}</span>}

      {/* Only shown when it can be computed — "unknown" and "the car didn't move" are different. */}
      {entry.kmSincePrevious !== null && (
        <span className="text-muted-foreground text-xs">
          +{formatKm(entry.kmSincePrevious)} od poprzedniego
        </span>
      )}

      {entry.nextDueOdometer !== null && (
        <span className="text-muted-foreground text-xs">
          wymiana przy {formatKm(entry.nextDueOdometer)}
        </span>
      )}

      {entry.cost !== null && <span className="text-xs">{formatPLN(entry.cost)}</span>}

      {entry.attachmentCount > 0 && (
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          <Paperclip className="size-3" />
          {entry.attachmentCount}
        </span>
      )}

      {entry.note && <span className="text-muted-foreground w-full text-xs">{entry.note}</span>}
    </li>
  )
}

export function InspectionHistory({ historyByType }: Pick<VehicleDetailT, 'historyByType'>) {
  return (
    <div className="flex flex-col gap-6">
      {INSPECTION_TYPES.map((type) => (
        <section key={type}>
          <h2 className="mb-1 text-sm font-semibold">{INSPECTION_TYPE_LABELS[type].pl}</h2>

          {historyByType[type].length === 0 ? (
            <p className="text-muted-foreground text-xs">Brak wpisów</p>
          ) : (
            <ul>
              {historyByType[type].map((entry) => (
                <HistoryEntry key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
