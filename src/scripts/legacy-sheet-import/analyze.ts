// Przebieg B: analiza zrzutów z fazy 2. Bez ruchu sieciowego i bez zapisu — wsad jest fazą 4.
//
//   node --env-file=.env --import tsx src/scripts/legacy-sheet-import/analyze.ts
//
// Raport ląduje obok zrzutów (`DUMP_DIR/raport.md`), a nie w repo: niesie ceny 56 budów.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getPayload } from 'payload'
import config from '../../payload.config'
import { getDb } from '../../lib/db/get-db'
import { listCatalogueItems } from '../../lib/db/work-catalogue'
import { DUMP_DIR } from './dump-store'
import { runAnalysis } from './run-analysis'
import { findSimilarNames } from './similar-names'
import { buildReport } from './report'

const REPORT_PATH = join(DUMP_DIR, 'raport.md')

async function main() {
  const payload = await getPayload({ config })
  const db = await getDb(payload)
  const catalogue = await listCatalogueItems(db)

  const { sheets, failures, candidates, skipped, totalKeys } = runAnalysis(catalogue)
  const similar = findSimilarNames(
    candidates.map((candidate) => ({
      description: candidate.rawDescription,
      unit: candidate.unit,
    })),
    catalogue.map((item) => ({ description: item.description, unit: item.unit })),
  )

  writeFileSync(
    REPORT_PATH,
    buildReport({ sheetsRead: sheets.length, failures, candidates, skipped, totalKeys, similar }),
  )

  console.log(`Arkusze: ${sheets.length} przeczytane, ${failures.length} nie.`)
  console.log(
    `Prace: ${totalKeys} unikalnych, ${skipped} już w katalogu, ${candidates.length} do dołożenia.`,
  )
  console.log(`Raport: ${REPORT_PATH}`)
  process.exit(0)
}

await main()
