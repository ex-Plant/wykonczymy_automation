// Give the read-only service account Viewer on every sheet the app knows about.
// Sharing a file requires Editor on it, so this runs as the WRITE account — which means it needs
// GOOGLE_SERVICE_ACCOUNT_WRITE_JSON, and that lives only in Vercel Production. It will not run off
// a plain local .env, by design. Dry-run by default; --apply performs the grants.
import { google } from 'googleapis'
import { readFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const READER = 'kosztorys-sheets-reader@wykonczymy-kosztorys-bk.iam.gserviceaccount.com'

const raw = process.env.GOOGLE_SERVICE_ACCOUNT_WRITE_JSON
if (!raw) throw new Error('Brak GOOGLE_SERVICE_ACCOUNT_WRITE_JSON — udostępnianie wymaga konta z prawem Edytora.')
const creds = JSON.parse(raw)
const auth = new google.auth.JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/drive'],
})
const drive = google.drive({ version: 'v3', auth })

// Ids come from a psql dump on stdin-file rather than a driver — the repo has no `pg` dependency.
const rows = readFileSync(process.argv[2] ?? 'sheets.tsv', 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [id, ...rest] = line.split('\t')
    return { id, name: rest.join(' ') }
  })

console.log(`${rows.length} arkuszy · reader=${READER} · tryb=${APPLY ? 'APPLY' : 'DRY-RUN'}\n`)

let granted = 0, already = 0, failed = 0
for (const [i, row] of rows.entries()) {
  const label = `${String(i + 1).padStart(2)}/${rows.length} ${row.id} ${(row.name || '').trim().slice(0, 40)}`
  try {
    const { data } = await drive.permissions.list({
      fileId: row.id,
      fields: 'permissions(emailAddress,role)',
      supportsAllDrives: true,
    })
    const existing = (data.permissions ?? []).find((p) => p.emailAddress === READER)
    if (existing) {
      already++
      console.log(`✓ ${label} — już ma (${existing.role})`)
      continue
    }
    if (!APPLY) {
      console.log(`· ${label} — nadałbym reader`)
      continue
    }
    await drive.permissions.create({
      fileId: row.id,
      requestBody: { type: 'user', role: 'reader', emailAddress: READER },
      sendNotificationEmail: false,
      supportsAllDrives: true,
    })
    granted++
    console.log(`+ ${label} — nadane`)
  } catch (err) {
    failed++
    console.log(`✗ ${label} — ${err?.errors?.[0]?.reason ?? err.code ?? ''} ${err.message?.slice(0, 90)}`)
  }
}
console.log(`\nnadane ${granted} · już miały ${already} · błędy ${failed}`)
