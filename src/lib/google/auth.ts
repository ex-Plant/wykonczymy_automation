import { google } from 'googleapis'
import { serverEnv } from '@/lib/env/server'

export type ServiceAccountCredentialsT = { client_email: string; private_key: string }

// The one place the credential JSON is read. Callers that need only the address a sheet must be
// shared with (`client_email`) go through here too, so a change to the credential shape lands once.
export function parseServiceAccountCredentials(): ServiceAccountCredentialsT {
  return JSON.parse(serverEnv.GOOGLE_SERVICE_ACCOUNT_JSON) as ServiceAccountCredentialsT
}

// The Editor credential, present only in Vercel Production. Everywhere else this is absent BY
// DESIGN — that absence is the whole gate. Two accounts, not one flag: the credential every dev
// machine carries is a Viewer on the sheets, so no env var, no code edit and no VERCEL_ENV can turn
// it into a writer. Google refuses on its side, which is the only refusal that cannot be argued with.
export function parseWriteServiceAccountCredentials(): ServiceAccountCredentialsT {
  const raw = serverEnv.GOOGLE_SERVICE_ACCOUNT_WRITE_JSON
  if (!raw) {
    throw new Error(
      'Refusing to write to Google Sheets: GOOGLE_SERVICE_ACCOUNT_WRITE_JSON is not set. ' +
        'The Editor credential lives only in Vercel Production — every other environment reads ' +
        'sheets with a Viewer account on purpose. Repairing a sheet happens from production.',
    )
  }
  return JSON.parse(raw) as ServiceAccountCredentialsT
}

/**
 * Single source for the service-account credential parse + JWT construction.
 * Different scopes get different tokens, so each client (sheets, drive) calls
 * this with its own scope list — there is no shared JWT instance.
 */
export function createServiceAccountJWT(scopes: string[]) {
  const creds = parseServiceAccountCredentials()
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes,
  })
}

export function createWriteServiceAccountJWT(scopes: string[]) {
  const creds = parseWriteServiceAccountCredentials()
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes,
  })
}
