import { google, type sheets_v4 } from 'googleapis'
import { createServiceAccountJWT } from '@/lib/google/auth'

// Readonly, unlike `@/lib/google/sheets` — import never writes back, so the narrower scope means a
// bug on this path cannot damage the owner's live sheet.
export function getReadonlySheetsClient(): sheets_v4.Sheets {
  const auth = createServiceAccountJWT(['https://www.googleapis.com/auth/spreadsheets.readonly'])
  return google.sheets({ version: 'v4', auth })
}
