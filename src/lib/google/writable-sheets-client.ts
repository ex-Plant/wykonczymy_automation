import { google, type sheets_v4 } from 'googleapis'
import { createWriteServiceAccountJWT } from '@/lib/google/auth'

// The one place in the app that mints a write-scoped Sheets token, which is what keeps the gate
// impossible to route around: a new writing function inherits it by needing a client at all, not by
// remembering a convention. Sibling of `readonly-sheets-client`, so the pair reads as one seam.
//
// The refusal itself is Google's, not this code's — outside production the credential is a Viewer.
// `createWriteServiceAccountJWT` only turns a missing credential into a readable sentence.
export function getWritableSheetsClient(): sheets_v4.Sheets {
  const auth = createWriteServiceAccountJWT(['https://www.googleapis.com/auth/spreadsheets'])
  return google.sheets({ version: 'v4', auth })
}
