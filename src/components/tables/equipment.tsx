'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { EquipmentStatusBadge } from '@/components/equipment/equipment-status-badge'
import { LocationCell } from '@/components/equipment/location-cell'
import { WarrantyCell } from '@/components/equipment/warranty-cell'
import { isLiveStatus } from '@/lib/equipment/equipment-status'
import { classifyWarranty, warrantyDaysLeft } from '@/lib/equipment/warranty-thresholds'
import type { EquipmentRowT } from '@/lib/equipment/types'
import type { DayT } from '@/lib/fleet/days'

const col = createColumnHelper<EquipmentRowT>()

/**
 * `today` is a parameter rather than a `new Date()` inside a cell: every row on the page must answer
 * „za ile dni" as of the same instant, and a cell that reads the clock re-renders itself into a
 * different answer than its neighbour after midnight.
 */
export function getEquipmentColumns({ today }: { today: DayT }) {
  return [
    col.accessor('name', {
      id: 'name',
      header: 'Nazwa',
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    col.accessor((row) => [row.make, row.model].filter(Boolean).join(' '), {
      id: 'makeModel',
      header: 'Marka / model',
      cell: (info) => <span>{info.getValue() || '—'}</span>,
    }),
    col.accessor('serialNumber', {
      id: 'serialNumber',
      header: 'Nr seryjny',
      cell: (info) => <span className="text-muted-foreground text-sm">{info.getValue() || '—'}</span>,
    }),
    col.accessor((row) => (row.location.kind === 'unknown' ? '' : row.location.name), {
      id: 'location',
      header: 'Gdzie jest',
      cell: (info) => (
        <LocationCell
          location={info.row.original.location}
          locatedAt={info.row.original.locatedAt}
          live={isLiveStatus(info.row.original.status)}
        />
      ),
    }),
    col.accessor((row) => warrantyDaysLeft(row.warrantyUntil, today) ?? undefined, {
      id: 'warranty',
      header: 'Gwarancja',
      // An item with no recorded warranty has nothing to rank, so it parks at the end instead of
      // leading a soonest-first sort.
      sortUndefined: 'last',
      cell: (info) => (
        <WarrantyCell
          warrantyUntil={info.row.original.warrantyUntil}
          daysLeft={warrantyDaysLeft(info.row.original.warrantyUntil, today)}
          bucket={classifyWarranty(info.row.original.warrantyUntil, today)}
          muted={!isLiveStatus(info.row.original.status)}
        />
      ),
    }),
    col.accessor('status', {
      id: 'status',
      header: 'Status',
      cell: (info) => <EquipmentStatusBadge status={info.getValue()} />,
    }),
  ]
}
