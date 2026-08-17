import { PREVIEW_VISIBLE_COLUMNS } from '@/lib/kosztorys/column-config'

// What one investment's client sees. Lives here rather than beside its query because the client
// components consume the type too, and that query is `server-only`.
export type ClientViewSettingsT = {
  hiddenColumns: string[]
  hideEmptyRows: boolean
}

// A key outside the ceiling is dropped, on write and on read alike: `PREVIEW_VISIBLE_COLUMNS` is the
// only thing deciding what MAY be shown, and a hidden-key list must not become a second, drifting
// answer to that question when the allowlist later changes.
//
// Called on `{}` this also IS the code default — everything the ceiling allows, minus the rows that
// carry neither an offer nor executed work — so there is no second constant to drift from it.
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

// Order-insensitive, because the hidden set is a set: ticking a column off and back on reorders the
// stored array without changing what the client sees, and a write triggered by that reorder would
// detach the investment from the firm-wide default for nothing.
export function sameClientViewSettings(a: ClientViewSettingsT, b: ClientViewSettingsT): boolean {
  if (a.hideEmptyRows !== b.hideEmptyRows) return false
  if (a.hiddenColumns.length !== b.hiddenColumns.length) return false
  const inA = new Set(a.hiddenColumns)
  return b.hiddenColumns.every((key) => inA.has(key))
}
