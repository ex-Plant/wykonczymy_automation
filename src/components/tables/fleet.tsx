'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { VehicleStatusBadge } from '@/components/fleet/vehicle-status-badge'
import { DeadlineCell } from '@/components/fleet/deadline-cell'
import { OilIntervalBadge } from '@/components/fleet/oil-interval-badge'
import { FlagBadge } from '@/components/fleet/flag-badge'
import { INSPECTION_TYPE_LABELS, SCHEDULED_INSPECTION_TYPES } from '@/lib/fleet/inspection-types'
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
    col.accessor((row) => row.activeFlags.length, {
      id: 'flags',
      header: 'Do wymiany',
      // An unflagged car renders nothing, not a dash: the column is an alarm surface, and a column
      // of dashes is what makes an alarm easy to miss.
      cell: (info) => (
        <span className="flex flex-wrap gap-1">
          {info.row.original.activeFlags.map((type) => (
            <FlagBadge key={type} type={type} />
          ))}
        </span>
      ),
    }),
    ...SCHEDULED_INSPECTION_TYPES.map((type) =>
      col.accessor((row) => row.deadlines[type].daysLeft ?? undefined, {
        id: type,
        header: INSPECTION_TYPE_LABELS[type].pl,
        // A car with nothing recorded has no distance to sort by; park those at the end rather than
        // letting null read as "most urgent".
        sortUndefined: 'last',
        cell: (info) => (
          <div className="flex flex-col items-start gap-1">
            <DeadlineCell
              deadline={info.row.original.deadlines[type]}
              muted={info.row.original.status === 'RETIRED'}
            />
            {/* The kilometre overrun belongs to the oil deadline, not to the car as a whole. */}
            {type === 'OIL_CHANGE' && (
              <OilIntervalBadge kmSinceOilChange={info.row.original.kmSinceOilChange} />
            )}
          </div>
        ),
      }),
    ),
    col.accessor('status', {
      id: 'status',
      header: 'Status',
      meta: { align: 'right' },
      cell: (info) => <VehicleStatusBadge status={info.getValue()} />,
    }),
  ]
}
