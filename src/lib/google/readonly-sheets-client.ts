import { google, type sheets_v4 } from 'googleapis'
import {
  createServiceAccountJWT,
  createWriteServiceAccountJWT,
  hasWriteServiceAccountCredentials,
} from '@/lib/google/auth'

const READONLY_SCOPE = ['https://www.googleapis.com/auth/spreadsheets.readonly']

// Readonly, unlike `@/lib/google/sheets` — import never writes back, so the narrower scope means a
// bug on this path cannot damage the owner's live sheet.
//
// Where the Editor credential exists (production only) the readonly-scoped token is minted from IT,
// not from the Viewer account: production has always required exactly ONE share per sheet, and
// reading with the Viewer account would silently make every sheet need a second one. The scope, not
// the account, is what keeps this path read-only.
export function getReadonlySheetsClient(): sheets_v4.Sheets {
  const auth = hasWriteServiceAccountCredentials()
    ? createWriteServiceAccountJWT(READONLY_SCOPE)
    : createServiceAccountJWT(READONLY_SCOPE)
  return google.sheets({ version: 'v4', auth })
}
