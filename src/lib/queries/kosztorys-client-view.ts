import 'server-only'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import {
  sanitizeClientViewSettings,
  type ClientViewSettingsT,
} from '@/lib/kosztorys/client-view-settings'

/**
 * `investment` is unique, so this is the row-or-nothing lookup every caller wants — the resolver
 * below, and both branches of the save action. `overrideAccess` stays the caller's call: the token
 * entrance has no session to check, while the save runs under an already owner-gated payload.
 */
export async function findClientViewRow(
  payload: Payload,
  investmentId: number,
  overrideAccess = false,
) {
  const rows = await payload.find({
    collection: 'kosztorys-client-view',
    where: { investment: { equals: investmentId } },
    depth: 0,
    limit: 1,
    // No COUNT query for a unique-indexed lookup that already stops at one row.
    pagination: false,
    overrideAccess,
  })
  return rows.docs[0] ?? null
}

/**
 * The one answer to "what does investment N serve a client": its own row, else the firm-wide
 * default, else the code default. Read by both preview entrances and by the settings dialog, so the
 * dialog can never show a starting state the client does not get.
 *
 * Deliberately uncached and outside `cachedPreviewKosztorysEditorData`: two indexed reads mean a
 * save is live on the next request with no cache tag, and changing the firm-wide default does not
 * invalidate every investment's tree payload. `overrideAccess` because the token entrance has no
 * session at all — exactly like the token lookup beside it.
 *
 * Both reads are issued at once. Until an investment saves its own row — the common state — the
 * fallback is the answer, so awaiting the row first would put every such request through two
 * round-trip depths to reach it; the wasted global read when a row does exist is one row of a
 * single-row table.
 */
export async function getClientViewSettings(investmentId: number): Promise<ClientViewSettingsT> {
  const payload = await getPayload({ config })

  const [row, defaults] = await Promise.all([
    findClientViewRow(payload, investmentId, true),
    payload.findGlobal({
      slug: 'kosztorys-client-view-defaults',
      depth: 0,
      overrideAccess: true,
    }),
  ])

  return sanitizeClientViewSettings(row ?? defaults ?? {})
}
