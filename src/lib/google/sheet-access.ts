import { google } from 'googleapis'
import { serverEnv } from '@/lib/env/server'
import { createServiceAccountJWT, parseServiceAccountCredentials } from './auth'
import { getReadonlySheetsClient } from './readonly-sheets-client'
import { sheetWriteRefusal } from './sheet-write-guard'

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
// That probe is a real write to someone's document, so it obeys the same environment gate as every
// other write. Where the gate refuses, the probe is SKIPPED rather than failed: `null` here means
// „the service account has no access", and returning it for a refusal would send the reader off to
// re-share a sheet that was never the problem. Linking still works outside production; what it
// stops proving is Editor rights.
export async function verifySheetAccess(spreadsheetId: string): Promise<{ title: string } | null> {
  try {
    const res = await getReadonlySheetsClient().spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title',
    })
    const title = res.data.properties?.title ?? ''

    const refusal = sheetWriteRefusal(
      serverEnv.VERCEL_ENV,
      spreadsheetId,
      serverEnv.GOOGLE_SHEETS_WRITE_ALLOWLIST,
    )
    if (refusal) {
      console.warn(`[sheet-access] write probe skipped — ${refusal}`)
      return { title }
    }

    const auth = createServiceAccountJWT(['https://www.googleapis.com/auth/spreadsheets'])
    await google.sheets({ version: 'v4', auth }).spreadsheets.batchUpdate({
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
