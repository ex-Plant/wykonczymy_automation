import { serverEnv } from '@/lib/env/server'
import { parseServiceAccountCredentials } from './auth'
import { getReadonlySheetsClient } from './readonly-sheets-client'
import { getWritableSheetsClient } from './sheets'

// The service-account email — what an owner must share a sheet with for the app
// to read/sync it. Parsed from the same credential JSON the clients use.
export function serviceAccountEmail(): string {
  // The credential JSON is cast, not validated, so a malformed one yields `undefined` behind a
  // `string` type — and the dialog would print „udostępnij arkusz kontu undefined".
  return parseServiceAccountCredentials().client_email ?? ''
}

// Pull the spreadsheet id out of a pasted Google Sheets URL, or accept a raw id.
// Returns undefined when the input is neither.
export function extractSheetId(input: string): string | undefined {
  const trimmed = input.trim()
  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (fromUrl) return fromUrl[1]
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed
  return undefined
}

// Confirm the service account can actually EDIT the sheet, returning its title.
// Returns null when it can't — the caller turns that into a "share it with … as
// Editor" message rather than leaking the raw API error.
//
// We must verify write access, not just read: the sync (stampAllTabs, which
// calls setupTab / applyTabRowsBatch) needs Editor. A read-only probe would pass a Viewer-only
// share at link time, then 403 on first sync. So after reading the title we run a
// no-op write (rewrite the title to itself) under the full `spreadsheets` scope —
// a Viewer share can read but not write, so this surfaces the gap now.
//
// That probe is a real write, so it needs the Editor credential — which exists only in production.
// Everywhere else the probe is SKIPPED, not failed: `null` here means „the service account has no
// access", and returning it for a missing credential would send the reader off to re-share a sheet
// that was never the problem. Linking still works locally; what it stops proving is Editor rights.
export async function verifySheetAccess(spreadsheetId: string): Promise<{ title: string } | null> {
  try {
    const res = await getReadonlySheetsClient().spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title',
    })
    const title = res.data.properties?.title ?? ''

    if (!serverEnv.GOOGLE_SERVICE_ACCOUNT_WRITE_JSON) {
      console.warn(
        `[sheet-access] write probe skipped for ${spreadsheetId} — no Editor credential outside production`,
      )
      return { title }
    }

    await getWritableSheetsClient().spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ updateSpreadsheetProperties: { properties: { title }, fields: 'title' } }],
      },
    })
    return { title }
  } catch {
    return null
  }
}
