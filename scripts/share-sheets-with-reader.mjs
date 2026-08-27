// Sharing a file requires Editor on it, so this runs as the WRITE account and needs
// GOOGLE_SERVICE_ACCOUNT_WRITE_JSON exported in the shell — that credential lives only in Vercel
// Production, so this is a from-production tool. Input is a TSV of `id<TAB>name` lines, exported
// from psql (the repo has no `pg` dependency, hence a file rather than a query).
//
//   node scripts/share-sheets-with-reader.mjs sheets.tsv            # dry run, changes nothing
//   node scripts/share-sheets-with-reader.mjs sheets.tsv --apply    # grants
//
// Idempotent: a sheet the reader already holds is skipped. Exits non-zero if any sheet failed, so a
// partial run cannot read as success in a `&&` chain.
import { google } from 'googleapis'
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
// Flags must not be eaten by the positional slot — `--apply` alone would otherwise be opened as the
// input file and the run would die on ENOENT before touching a single sheet.
const inputFile = args.find((a) => !a.startsWith('--')) ?? 'sheets.tsv'

const READER = 'kosztorys-sheets-reader@wykonczymy-kosztorys-bk.iam.gserviceaccount.com'

const raw = process.env.GOOGLE_SERVICE_ACCOUNT_WRITE_JSON
if (!raw)
  throw new Error(
    'Brak GOOGLE_SERVICE_ACCOUNT_WRITE_JSON — udostępnianie wymaga konta z prawem Edytora.',
  )
const creds = JSON.parse(raw)
const auth = new google.auth.JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/drive'],
})
const drive = google.drive({ version: 'v3', auth })

const rows = readFileSync(inputFile, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [id, ...rest] = line.split('\t')
    return { id, name: rest.join(' ') }
  })

console.log(
  `${rows.length} arkuszy · plik=${inputFile} · reader=${READER} · tryb=${APPLY ? 'APPLY' : 'DRY-RUN'}\n`,
)

let granted = 0,
  already = 0,
  failed = 0,
  overprivileged = 0

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
      // A reader holding anything above `reader` is the failure this whole split exists to prevent:
      // that sheet is writable from every laptop and preview deploy. Never report it as compliant.
      if (existing.role !== 'reader') {
        overprivileged++
        console.log(`! ${label} — reader ma rolę „${existing.role}" — ODBIERZ, to otwiera zapis`)
        continue
      }
      already++
      console.log(`✓ ${label} — już ma`)
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
    console.log(
      `✗ ${label} — ${err?.errors?.[0]?.reason ?? err.code ?? ''} ${err.message?.slice(0, 90)}`,
    )
  }
}

console.log(
  `\nnadane ${granted} · już miały ${already} · za dużo uprawnień ${overprivileged} · błędy ${failed}`,
)
if (failed > 0 || overprivileged > 0) process.exit(1)
