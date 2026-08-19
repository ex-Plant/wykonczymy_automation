'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { VehicleStatusBadge } from '@/components/fleet/vehicle-status-badge'
import { DeadlineCell } from '@/components/fleet/deadline-cell'
import { OilIntervalBadge } from '@/components/fleet/oil-interval-badge'
import { INSPECTION_TYPE_LABELS, INSPECTION_TYPES } from '@/lib/fleet/inspection-types'
import type { FleetRowT } from '@/types/fleet'

const col = createColumnHelper<FleetRowT>()

export function getFleetColumns() {
  return [
    col.accessor('registration', {
      id: 'registration',
      header: 'Rejestracja',
      meta: { canHide: false },
      cell: (info) => (
        <span className="flex items-center gap-2 font-medium">
          {info.getValue()}
          <OilIntervalBadge kmSinceOilChange={info.row.original.kmSinceOilChange} />
        </span>
      ),
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
      col.accessor((row) => row.deadlines[type].daysLeft ?? undefined, {
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
      cell: (info) => <VehicleStatusBadge status={info.getValue()} />,
    }),
  ]
}
