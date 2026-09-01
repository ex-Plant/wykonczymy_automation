// Przebieg A: zassij WSZYSTKIE arkusze inwestycji na dysk i nie analizuj niczego. Rozdzielenie od
// analizy nie jest ozdobą — w kliencie Sheets nie ma ani retry, ani backoffu, więc 429 w połowie
// przejścia po 57 arkuszach kosztowałby całe przejście. Przebieg jest wznawialny: arkusz, który już
// leży na dysku, jest pomijany bez zapytania do Google.
//
//   node --env-file=.env --import tsx src/scripts/legacy-sheet-import/fetch-grids.ts
//
// Katalog roboczy poza repo (zrzuty to setki kilobajtów cudzych cen) i poza /tmp, które bywa
// sprzątane w trakcie akcji: LEGACY_SHEET_DUMP_DIR, domyślnie ~/.local/share/wykonczymy-legacy-sheets.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { google } from 'googleapis'
import { getPayload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import config from '../../payload.config'
import { getDb } from '../../lib/db/get-db'
import { classifySheetFailure } from '../../lib/kosztorys/sheet-import/classify-sheet-failure'
import { readImportGrids } from '../../lib/kosztorys/sheet-import/read-sheet'
import { DUMP_DIR, dumpPath, type SheetDumpT } from './dump-store'

// Klient budowany tu, a nie przez `getReadonlySheetsClient()`: ten idzie przez `@/lib/env/server`,
// który jest `server-only` i wywala się pod tsx. Ten sam objazd co w
// `src/scripts/check-column-resolution.ts` — zakres pozostaje readonly, więc gwarancja jest ta sama.
const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON as string)

const sheets = google.sheets({
  version: 'v4',
  auth: new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  }),
})

// Pauza między arkuszami — jedyna rzecz, jaka dzieli nas od limitu zapytań Google, skoro klient
// Sheets nie ma backoffu.
const PAUSE_MS = 1_500

async function main() {
  const payload = await getPayload({ config })
  const db = await getDb(payload)

  // Sortowanie JEST regułą świeżości i zapisuje się razem z siatkami, żeby faza 3 go nie liczyła po
  // raz drugi. Po `investments.created_at`, nie po `kosztoryses.created_at`: ten drugi ma 17 różnych
  // dat i połowę arkuszy podpiętych hurtem jednego dnia, więc o wieku arkusza nie mówi nic.
  const result = await db.execute(sql`
    SELECT k.id AS sheet_id, k.google_sheet_id, k.name AS sheet_name, k.sheet_column_mapping,
           i.id AS investment_id, i.name AS investment_name, i.created_at AS investment_created_at
    FROM kosztoryses k
    LEFT JOIN investments i ON i.id = k.investment_id
    ORDER BY i.created_at DESC NULLS LAST, i.id DESC
  `)

  mkdirSync(DUMP_DIR, { recursive: true })
  console.log(`katalog roboczy: ${DUMP_DIR}`)
  console.log(`arkuszy do zassania: ${result.rows.length}\n`)

  let fetched = 0
  let skipped = 0
  let failed = 0

  for (const row of result.rows) {
    const googleSheetId = String(row.google_sheet_id)
    const path = dumpPath(googleSheetId)
    const label = `${row.investment_name ?? '(bez inwestycji)'} — ${row.sheet_name}`

    // Pomijamy wyłącznie SUKCES. Porażka leży na dysku po to, żeby raport miał co wymienić, gdy
    // arkusz jest trwale nieczytelny — ale limit zapytań i timeout też tam lądują, a te znikają przy
    // drugim podejściu. Pomijanie porażki zamroziłoby błąd przejściowy na stałe.
    if (existsSync(path) && (JSON.parse(readFileSync(path, 'utf8')) as SheetDumpT).grids !== null) {
      skipped += 1
      continue
    }

    const meta = {
      sheetId: Number(row.sheet_id),
      googleSheetId,
      sheetName: String(row.sheet_name),
      columnMapping: (row.sheet_column_mapping ?? null) as SheetDumpT['columnMapping'],
      investmentId: row.investment_id == null ? null : Number(row.investment_id),
      investmentName: (row.investment_name as string | null) ?? null,
      investmentCreatedAt:
        row.investment_created_at == null ? null : String(row.investment_created_at),
    }

    try {
      const grids = await readImportGrids(sheets, googleSheetId)
      const dump: SheetDumpT = { ...meta, grids, failure: null }
      writeFileSync(path, JSON.stringify(dump))
      fetched += 1
      console.log(`  OK   ${label}`)
      // Trzy zapytania na arkusz bez grama backoffu po naszej stronie; pierwsze przejście
      // wyłożyło się na 9 arkuszach i wszystkie 9 czytały się potem pojedynczo bez problemu.
      await new Promise((resolve) => setTimeout(resolve, PAUSE_MS))
    } catch (error) {
      // Porażka jednego arkusza jest DANĄ, nie końcem przebiegu: zapisana na dysk trafia potem do
      // raportu z powodem, a pętla leci dalej. Inaczej jeden arkusz niewspółdzielony z kontem
      // serwisowym kosztowałby wszystkie następne.
      const reason = classifySheetFailure(error)
      const dump: SheetDumpT = {
        ...meta,
        grids: null,
        failure: { reason, message: (error as Error).message?.slice(0, 300) ?? '' },
      }
      writeFileSync(path, JSON.stringify(dump))
      failed += 1
      console.log(`  BŁĄD ${label} — ${reason}: ${(error as Error).message?.slice(0, 120)}`)
    }
  }

  console.log(`\nzassane: ${fetched}   pominięte (już na dysku): ${skipped}   błędy: ${failed}`)
  process.exit(0)
}

void main()
