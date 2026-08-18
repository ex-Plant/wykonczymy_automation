import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { INSPECTION_TYPE_LABELS, INSPECTION_TYPES } from '@/lib/fleet/inspection-types'

export const VehicleInspections: CollectionConfig = {
  slug: 'vehicle-inspections',
  labels: {
    singular: { en: 'Inspection', pl: 'Przegląd' },
    plural: { en: 'Inspections', pl: 'Przeglądy' },
  },
  admin: {
    useAsTitle: 'performedAt',
    defaultColumns: ['vehicle', 'type', 'performedAt', 'nextDueAt'],
    group: { en: 'Fleet', pl: 'Flota' },
  },
  hooks: {
    afterChange: [makeRevalidateAfterChange('vehicleInspections')],
    afterDelete: [makeRevalidateAfterDelete('vehicleInspections')],
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
    delete: isAdminOrOwner,
  },
  fields: [
    {
      name: 'vehicle',
      type: 'relationship',
      relationTo: 'vehicles',
      required: true,
      label: { en: 'Vehicle', pl: 'Pojazd' },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      label: { en: 'Type', pl: 'Rodzaj' },
      options: INSPECTION_TYPES.map((value) => ({
        label: INSPECTION_TYPE_LABELS[value],
        value,
      })),
    },
    {
      name: 'performedAt',
      type: 'date',
      required: true,
      label: { en: 'Performed at', pl: 'Data wykonania' },
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'dd.MM.yyyy',
        },
      },
    },
    {
      name: 'nextDueAt',
      type: 'date',
      label: { en: 'Next due', pl: 'Następny termin' },
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'dd.MM.yyyy',
        },
      },
    },
    {
      name: 'odometer',
      type: 'number',
      label: { en: 'Odometer (km)', pl: 'Przebieg (km)' },
    },
    {
      // The oil change is the one type that genuinely runs on mileage, so it carries a kilometre
      // target alongside its date. Every other type would have nothing to compare it against.
      name: 'nextDueOdometer',
      type: 'number',
      label: { en: 'Next due at (km)', pl: 'Następna wymiana przy (km)' },
      admin: {
        condition: (data) => data?.type === 'OIL_CHANGE',
      },
    },
    {
      name: 'cost',
      type: 'number',
      label: { en: 'Cost', pl: 'Koszt' },
    },
    {
      name: 'note',
      type: 'textarea',
      label: { en: 'Note', pl: 'Notatka' },
    },
    {
      name: 'attachments',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      label: { en: 'Attachments', pl: 'Załączniki' },
    },
    // --- Reminder bookkeeping: written by the daily sweep, edited by nobody. ---
    // Two independent axes because the date leg and the kilometre leg can each fire for the same
    // oil-change row; sharing one column would let either silence the other.
    {
      name: 'notifiedThreshold',
      type: 'number',
      admin: { hidden: true },
    },
    {
      name: 'notifiedAt',
      type: 'date',
      admin: { hidden: true },
    },
    {
      name: 'odometerNotifiedAt',
      type: 'date',
      admin: { hidden: true },
    },
  ],
}
