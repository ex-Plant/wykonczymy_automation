import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { PREVIEW_VISIBLE_COLUMNS } from '@/lib/kosztorys/column-config'

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

// A stored key outside the ceiling is dropped rather than honoured: `PREVIEW_VISIBLE_COLUMNS` is the
// only thing deciding what MAY be shown, and a hidden-key list must not become a second, drifting
// answer to that question when the allowlist later changes.
function sanitizeHiddenColumns(stored: unknown): string[] {
  if (!Array.isArray(stored)) return []
  return stored.filter(
    (key): key is string => typeof key === 'string' && PREVIEW_VISIBLE_COLUMNS.has(key),
  )
}

function toSettings(source: {
  hiddenColumns?: unknown
  hideEmptyRows?: unknown
}): ClientViewSettingsT {
  return {
    hiddenColumns: sanitizeHiddenColumns(source.hiddenColumns),
    hideEmptyRows: source.hideEmptyRows !== false,
  }
}

/**
 * The one answer to "what does investment N serve a client": its own row, else the firm-wide
 * default, else the code default. Read by both preview entrances and by the settings dialog, so the
 * dialog can never show a starting state the client does not get.
 *
 * Deliberately uncached and outside `cachedPreviewKosztorysEditorData`: one indexed read means a
 * save is live on the next request with no cache tag, and changing the firm-wide default does not
 * invalidate every investment's tree payload. `overrideAccess` because the token entrance has no
 * session at all — exactly like the token lookup beside it.
 */
export async function getClientViewSettings(investmentId: number): Promise<ClientViewSettingsT> {
  const payload = await getPayload({ config })

  const rows = await payload.find({
    collection: 'kosztorys-client-view',
    where: { investment: { equals: investmentId } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const row = rows.docs[0]
  if (row) return toSettings(row)

  return getClientViewDefaults()
}

/** The firm-wide starting point, falling back to the code default when the global was never saved. */
export async function getClientViewDefaults(): Promise<ClientViewSettingsT> {
  const payload = await getPayload({ config })
  const defaults = await payload.findGlobal({
    slug: 'kosztorys-client-view-defaults',
    depth: 0,
    overrideAccess: true,
  })
  return toSettings(defaults ?? {})
}
