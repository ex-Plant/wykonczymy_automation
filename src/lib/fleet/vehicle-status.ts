export const VEHICLE_STATUSES = ['ACTIVE', 'RETIRED'] as const

export type VehicleStatusT = (typeof VEHICLE_STATUSES)[number]

export const VEHICLE_STATUS_LABELS: Record<VehicleStatusT, { en: string; pl: string }> = {
  ACTIVE: { en: 'Active', pl: 'W użyciu' },
  RETIRED: { en: 'Retired', pl: 'Wycofany' },
}
