import { PREVIEW_VISIBLE_COLUMNS } from '@/lib/kosztorys/column-config'

// What one investment's client sees. Lives here rather than beside its query because the client
// components consume the type too, and that query is `server-only`.
export type ClientViewSettingsT = {
  hiddenColumns: string[]
  hideEmptyRows: boolean
}

// What a client sees when nobody ever decided: everything the ceiling allows, minus the rows that
// carry neither an offer nor executed work.
export const CLIENT_VIEW_CODE_DEFAULT: ClientViewSettingsT = {
  hiddenColumns: [],
  hideEmptyRows: true,
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
