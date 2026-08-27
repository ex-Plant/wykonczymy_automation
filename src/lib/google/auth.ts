import { google } from 'googleapis'
import { serverEnv } from '@/lib/env/server'

export type ServiceAccountCredentialsT = { client_email: string; private_key: string }

// Two accounts, not one flag: the credential every dev machine carries is a Viewer on the sheets, so
// no env var, no code edit and no VERCEL_ENV can turn it into a writer. Google refuses on its side,
// which is the only refusal that cannot be argued with. The Editor credential is absent everywhere
// but Vercel Production BY DESIGN — that absence is the gate, not a misconfiguration.
//
// The address is not a secret and has to be printable where the credential itself is absent — the
// dialog that tells an owner whom to grant Editor runs in every environment, and naming the Viewer
// there would hand write rights back to every laptop for that sheet.
const EDITOR_ACCOUNT_EMAIL = 'kosztorys-sheets@wykonczymy-kosztorys-bk.iam.gserviceaccount.com'

// The one place the credential JSON is read. Callers that need only the address a sheet must be
// shared with (`client_email`) go through here too, so a change to the credential shape lands once.
export function parseServiceAccountCredentials(): ServiceAccountCredentialsT {
  return JSON.parse(serverEnv.GOOGLE_SERVICE_ACCOUNT_JSON) as ServiceAccountCredentialsT
}

// Module-private on purpose: the only route to the Editor key is minting a token from it. An
// exported parse would be a second door to the raw private key, which is the arrangement this whole
// split exists to prevent.
function parseWriteServiceAccountCredentials(): ServiceAccountCredentialsT {
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

// One owner for "is the Editor credential here". A second site deciding it independently drifts on
// the next rename, and the drift is silent: the caller skips its write probe and reports success.
export function hasWriteServiceAccountCredentials(): boolean {
  return Boolean(serverEnv.GOOGLE_SERVICE_ACCOUNT_WRITE_JSON)
}

// The address a sheet must be shared with AS EDITOR. Falls back to the constant where the credential
// is absent, which is every environment but production — the instruction still has to be right there.
export function writeServiceAccountEmail(): string {
  if (!hasWriteServiceAccountCredentials()) return EDITOR_ACCOUNT_EMAIL
  return parseWriteServiceAccountCredentials().client_email || EDITOR_ACCOUNT_EMAIL
}

/**
 * Different scopes get different tokens, so each client calls this with its own
 * scope list — there is no shared JWT instance.
 */
function createJWT(creds: ServiceAccountCredentialsT, scopes: string[]) {
  return new google.auth.JWT({ email: creds.client_email, key: creds.private_key, scopes })
}

export function createServiceAccountJWT(scopes: string[]) {
  return createJWT(parseServiceAccountCredentials(), scopes)
}

export function createWriteServiceAccountJWT(scopes: string[]) {
  return createJWT(parseWriteServiceAccountCredentials(), scopes)
}
