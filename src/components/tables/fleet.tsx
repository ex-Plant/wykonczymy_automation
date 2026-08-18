'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { DeadlineCell } from '@/components/fleet/deadline-cell'
import { BADGE_BASE } from '@/components/ui/badge'
import {
  INSPECTION_TYPE_LABELS,
  INSPECTION_TYPES,
  VEHICLE_STATUS_LABELS,
} from '@/lib/fleet/inspection-types'
import { cn } from '@/lib/utils/cn'
import type { FleetRowT } from '@/types/fleet'

const col = createColumnHelper<FleetRowT>()

export function getFleetColumns() {
  return [
    col.accessor('registration', {
      id: 'registration',
      header: 'Rejestracja',
      meta: { canHide: false },
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    col.accessor((row) => `${row.make} ${row.model}`, {
      id: 'vehicle',
      header: 'Pojazd',
      cell: (info) => (
        <span>
          {info.getValue()}
          {info.row.original.year ? ` (${info.row.original.year})` : ''}
        </span>
      ),
    }),
    ...INSPECTION_TYPES.map((type) =>
      col.accessor((row) => row.deadlines[type].daysLeft, {
        id: type,
        header: INSPECTION_TYPE_LABELS[type].pl,
        // A car with nothing recorded has no distance to sort by; park those at the end rather than
        // letting null read as "most urgent".
        sortUndefined: 'last',
        cell: (info) => (
          <DeadlineCell
            deadline={info.row.original.deadlines[type]}
            muted={info.row.original.status === 'RETIRED'}
          />
        ),
      }),
    ),
    col.accessor('status', {
      id: 'status',
      header: 'Status',
      meta: { align: 'right' },
      cell: (info) => (
        <span
          className={cn(
            BADGE_BASE,
            info.getValue() === 'ACTIVE'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {VEHICLE_STATUS_LABELS[info.getValue()].pl}
        </span>
      ),
    }),
  ]
}
