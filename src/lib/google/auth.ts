import { google } from 'googleapis'
import { serverEnv } from '@/lib/env/server'

export type ServiceAccountCredentialsT = { client_email: string; private_key: string }

// The one place the credential JSON is read. Callers that need only the address a sheet must be
// shared with (`client_email`) go through here too, so a change to the credential shape lands once.
export function parseServiceAccountCredentials(): ServiceAccountCredentialsT {
  return JSON.parse(serverEnv.GOOGLE_SERVICE_ACCOUNT_JSON) as ServiceAccountCredentialsT
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
