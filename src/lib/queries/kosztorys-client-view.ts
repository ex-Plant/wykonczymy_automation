import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  sanitizeClientViewSettings,
  type ClientViewSettingsT,
} from '@/lib/kosztorys/client-view-settings'

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
  if (row) return sanitizeClientViewSettings(row)

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
  return sanitizeClientViewSettings(defaults ?? {})
}
