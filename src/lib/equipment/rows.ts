import { numOrNull } from '@/lib/db/row-coerce'
import { EQUIPMENT_STATUSES, type EquipmentStatusT } from './equipment-status'
import type {
  EquipmentEventRowT,
  EquipmentLocationT,
  EquipmentRowT,
  EquipmentTargetT,
} from './types'

/**
 * Raw → view shape for the equipment register. Kept free of SQL and of React so the one piece of
 * real logic here — reading a location out of three mutually exclusive columns — can be asserted
 * without a database or a renderer.
 */

type LocationColumnsT = {
  holder_id: unknown
  holder_name: unknown
  warehouse_id: unknown
  warehouse_name: unknown
  service_provider: unknown
}

const text = (value: unknown): string => (value == null ? '' : String(value))

const isoOrNull = (value: unknown): string | null => {
  if (value == null) return null
  return value instanceof Date ? value.toISOString() : String(value)
}

/**
 * Precedence is not a policy choice — the write-side invariant guarantees at most one of the three
 * is set, so the order here only decides what a row that broke it would render as. Holder first,
 * because a person is the answer the owner acts on.
 */
export const toLocation = (raw: LocationColumnsT): EquipmentLocationT => {
  if (raw.holder_id != null) {
    return { kind: 'holder', id: Number(raw.holder_id), name: text(raw.holder_name) }
  }
  if (raw.warehouse_id != null) {
    return { kind: 'warehouse', id: Number(raw.warehouse_id), name: text(raw.warehouse_name) }
  }
  // Trimmed here as well as on write: a whitespace-only workshop is not a location, and the mapper
  // also reads rows that predate the hook's own trim.
  const serviceProvider = text(raw.service_provider).trim()
  if (serviceProvider !== '') return { kind: 'service', name: serviceProvider }

  return { kind: 'unknown' }
}

/**
 * The stable identity of a „gdzie jest" filter option. People and warehouses share one dropdown, so
 * their ids would collide on their own; the prefix is what keeps `holder:3` and `warehouse:3` apart.
 * A serwis is one string per repair rather than a dictionary entry, so every service entry answers
 * to the same key — filtering on it means „w serwisie", not „w tym konkretnym warsztacie".
 */
export const locationKey = (location: EquipmentLocationT): string | null => {
  switch (location.kind) {
    case 'holder':
      return `holder:${location.id}`
    case 'warehouse':
      return `warehouse:${location.id}`
    case 'service':
      return 'service'
    case 'unknown':
      return null
  }
}

const toStatus = (value: unknown): EquipmentStatusT => {
  const candidate = text(value) as EquipmentStatusT
  // The column is an enum, so this only fires if someone widened the enum without the constant —
  // and then IN_USE is the reading that keeps the item visible instead of quietly dropping it.
  return EQUIPMENT_STATUSES.includes(candidate) ? candidate : 'IN_USE'
}

export const toEquipmentRow = (raw: Record<string, unknown>): EquipmentRowT => ({
  id: Number(raw.id),
  name: text(raw.name),
  serialNumber: text(raw.serial_number),
  make: text(raw.make),
  model: text(raw.model),
  status: toStatus(raw.status),
  purchaseDate: isoOrNull(raw.purchase_date),
  warrantyUntil: isoOrNull(raw.warranty_until),
  // numOrNull, not `?? 0`: an unknown purchase price renders „—", and 0 zł is a price someone chose.
  purchasePrice: numOrNull(raw.purchase_price),
  note: text(raw.note),
  location: toLocation(raw as LocationColumnsT),
  locatedAt: isoOrNull(raw.occurred_at),
})

export const toEquipmentEventRow = (raw: Record<string, unknown>): EquipmentEventRowT => ({
  id: Number(raw.id),
  occurredAt: text(isoOrNull(raw.occurred_at)),
  // The cast holds on the invariant, not on the data: a hypothetical targetless row would render as
  // „nieznane" rather than crash, which is what `toLocation` returns for it anyway.
  target: toLocation(raw as LocationColumnsT) as EquipmentTargetT,
  investmentId: raw.investment_id == null ? null : Number(raw.investment_id),
  investmentName: text(raw.investment_name),
  cost: numOrNull(raw.cost),
  note: text(raw.note),
  attachmentIds: Array.isArray(raw.attachment_ids)
    ? raw.attachment_ids.filter((id) => id != null).map(Number)
    : [],
})
