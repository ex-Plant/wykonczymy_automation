// Przebieg B: analiza zrzutów z fazy 2. Bez ruchu sieciowego i bez zapisu — wsad jest fazą 4.
//
//   node --env-file=.env --import tsx src/scripts/legacy-sheet-import/analyze.ts
//
// Raport ląduje obok zrzutów (`DUMP_DIR/raport.md`), a nie w repo: niesie ceny 56 budów.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getPayload } from 'payload'
import config from '../../payload.config'
import { getDb } from '../../lib/db/get-db'
import { listCatalogueItems } from '../../lib/db/work-catalogue'
import { DUMP_DIR, type SheetDumpT } from './dump-store'
import { parseDumpedSheet, type ParsedSheetT, type SheetParseFailureT } from './parse-dumped-sheet'
import { collectCandidates } from './collect-candidates'
import { findSimilarNames } from './similar-names'
import { buildReport } from './report'

const REPORT_PATH = join(DUMP_DIR, 'raport.md')

async function main() {
  // Kolejność świeżości NIE jest tu wyliczana od nowa z bazy: `investmentCreatedAt` pojechało na
  // dysk razem ze zrzutem właśnie po to, żeby przebieg B odtworzył ten sam porządek bez sieci
  // i bez pytania o inwestycję, która mogła się w międzyczasie zmienić. System plików żadnej
  // kolejności nie gwarantuje, więc `readdirSync` jest tylko listą wejść.
  const dumps = readdirSync(DUMP_DIR)
    .filter((name) => name.endsWith('.json') && name !== 'raport.md')
    .map((name) => JSON.parse(readFileSync(join(DUMP_DIR, name), 'utf8')) as SheetDumpT)
    .sort((a, b) => {
      const byDate = (b.investmentCreatedAt ?? '').localeCompare(a.investmentCreatedAt ?? '')
      return byDate !== 0 ? byDate : (b.investmentId ?? 0) - (a.investmentId ?? 0)
    })

  const sheets: ParsedSheetT[] = []
  const failures: SheetParseFailureT[] = []

  for (const dump of dumps) {
    const result = parseDumpedSheet(dump)
    if (result.ok) sheets.push(result.sheet)
    else failures.push(result.failure)
  }

  const payload = await getPayload({ config })
  const db = await getDb(payload)
  const catalogue = await listCatalogueItems(db)

  const { candidates, skipped, totalKeys } = collectCandidates(
    sheets,
    new Set(catalogue.map((item) => item.matchKey)),
  )
  const similar = findSimilarNames(
    candidates.map((candidate) => ({
      description: candidate.rawDescription,
      unit: candidate.unit,
    })),
    catalogue.map((item) => ({ description: item.description, unit: item.unit })),
  )

  writeFileSync(
    REPORT_PATH,
    buildReport({
      sheetsRead: sheets.length,
      failures,
      candidates,
      skipped,
      totalKeys,
      similar,
    }),
  )

  console.log(`Arkusze: ${sheets.length} przeczytane, ${failures.length} nie.`)
  console.log(
    `Prace: ${totalKeys} unikalnych, ${skipped} już w katalogu, ${candidates.length} do dołożenia.`,
  )
  console.log(`Raport: ${REPORT_PATH}`)
  process.exit(0)
}

await main()
