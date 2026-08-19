import { PREVIEW_VISIBLE_COLUMNS } from '@/lib/kosztorys/column-config'
import { STAGES_COLUMN_GROUP, STAGE_VALUE_NET_COLUMN_GROUP } from '@/lib/kosztorys/stage-keys'

// What one investment's client sees. Lives here rather than beside its query because the client
// components consume the type too, and that query is `server-only`.
export type ClientViewSettingsT = {
  hiddenColumns: string[]
  hideEmptyRows: boolean
}

// Which stage of the investment the client's link is serving. The `ClientView` prefix is load-bearing:
// `SettlementModeT` already means how robocizna is settled, an unrelated concept.
export type ClientViewModeT = 'OFFER' | 'SETTLEMENT'

export const CLIENT_VIEW_MODES: readonly ClientViewModeT[] = ['OFFER', 'SETTLEMENT']

// What is STORED for an investment: both column sets at once, plus which one the link serves. An
// investment moving from offer to execution flips `mode` instead of re-ticking twenty checkboxes.
export type ClientViewConfigT = {
  mode: ClientViewModeT
  variants: Record<ClientViewModeT, ClientViewSettingsT>
}

// Expressed as what the client SEES, because that is what an owner reads off the dialog; the stored
// hidden set is its complement against the ceiling and is computed below, never written by hand.
// Settlement is a superset of the offer — executed work is added to the offer, it does not replace it.
const OFFER_VISIBLE_COLUMNS = [
  'description',
  'plannedQty',
  'unit',
  'price',
  'plannedNet',
  'remaining',
] as const

const SETTLEMENT_VISIBLE_COLUMNS = [
  ...OFFER_VISIBLE_COLUMNS,
  'stageQtySum',
  'net',
  STAGES_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
  'donePercent',
] as const

function defaultVariant(visible: readonly string[]): ClientViewSettingsT {
  const shown = new Set(visible)
  return {
    hiddenColumns: [...PREVIEW_VISIBLE_COLUMNS].filter((key) => !shown.has(key)),
    hideEmptyRows: true,
  }
}

// A key outside the ceiling is dropped, on write and on read alike: `PREVIEW_VISIBLE_COLUMNS` is the
// only thing deciding what MAY be shown, and a hidden-key list must not become a second, drifting
// answer to that question when the allowlist later changes.
export function sanitizeClientViewSettings(source: {
  hiddenColumns?: unknown
  hideEmptyRows?: unknown
}): ClientViewSettingsT {
  const stored = Array.isArray(source.hiddenColumns) ? source.hiddenColumns : []
  return {
    hiddenColumns: stored.filter(
      (key): key is string => typeof key === 'string' && PREVIEW_VISIBLE_COLUMNS.has(key),
    ),
    hideEmptyRows: source.hideEmptyRows !== false,
  }
}

// Called on `{}` this also IS the code default — one per variant — so an unsaved investment and an
// unsaved firm-wide global reach the same answer with no second constant to drift from it.
export function sanitizeClientViewConfig(source: {
  mode?: unknown
  variants?: unknown
}): ClientViewConfigT {
  const stored: Record<string, unknown> =
    typeof source.variants === 'object' && source.variants !== null
      ? (source.variants as Record<string, unknown>)
      : {}

  const variant = (mode: ClientViewModeT, visible: readonly string[]): ClientViewSettingsT => {
    const saved = stored[mode]
    if (typeof saved !== 'object' || saved === null) return defaultVariant(visible)
    return sanitizeClientViewSettings(saved)
  }

  return {
    mode: source.mode === 'SETTLEMENT' ? 'SETTLEMENT' : 'OFFER',
    variants: {
      OFFER: variant('OFFER', OFFER_VISIBLE_COLUMNS),
      SETTLEMENT: variant('SETTLEMENT', SETTLEMENT_VISIBLE_COLUMNS),
    },
  }
}

// The bridge from the stored shape to the served one — the only place the active variant is picked.
export function clientViewSettingsForMode(config: ClientViewConfigT): ClientViewSettingsT {
  return config.variants[config.mode]
}

// Order-insensitive, because the hidden set is a set: ticking a column off and back on reorders the
// stored array without changing what the client sees, and a write triggered by that reorder would
// detach the investment from the firm-wide default for nothing.
export function sameClientViewSettings(a: ClientViewSettingsT, b: ClientViewSettingsT): boolean {
  if (a.hideEmptyRows !== b.hideEmptyRows) return false
  if (a.hiddenColumns.length !== b.hiddenColumns.length) return false
  const inA = new Set(a.hiddenColumns)
  return b.hiddenColumns.every((key) => inA.has(key))
}

export function sameClientViewConfig(a: ClientViewConfigT, b: ClientViewConfigT): boolean {
  if (a.mode !== b.mode) return false
  return CLIENT_VIEW_MODES.every((mode) =>
    sameClientViewSettings(a.variants[mode], b.variants[mode]),
  )
}
