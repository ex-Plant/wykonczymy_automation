// The two Google service-account credentials the app distinguishes: a Viewer it reads with
// everywhere, and an Editor that exists only in Vercel Production. Specs that exercise a write path
// have to supply a fake Editor — which is NOT a way around the gate, because the gate is the Viewer
// role on the real credential and no test can fake that away. Pinned centrally so the four specs
// that need it can't drift into four slightly different fixtures.
export const READER_CREDENTIAL = {
  client_email: 'kosztorys-sheets-reader@example.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nREADER\n-----END PRIVATE KEY-----\n',
}

export const WRITER_CREDENTIAL = {
  client_email: 'kosztorys-sheets@example.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nWRITER\n-----END PRIVATE KEY-----\n',
}

// `writer: false` reproduces every environment but production — the case where a write must refuse.
export function setGoogleCredentialEnv({ writer = true }: { writer?: boolean } = {}) {
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(READER_CREDENTIAL)
  if (writer) process.env.GOOGLE_SERVICE_ACCOUNT_WRITE_JSON = JSON.stringify(WRITER_CREDENTIAL)
  else delete process.env.GOOGLE_SERVICE_ACCOUNT_WRITE_JSON
}
