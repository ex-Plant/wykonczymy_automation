// Faza 4, wsad z pliku: eksport katalogu wchodzi do bazy nazwanej JAWNIE przy wywołaniu.
// Insert-only po `match_key`, więc powtórka dokłada wyłącznie to, czego w bazie nie ma.
//
//   node --env-file=.env --import tsx src/scripts/legacy-sheet-import/import-catalogue.ts
//   DB_POSTGRES_URL="$DB_POSTGRES_URL_PROD" node --env-file=.env --import tsx \
//     src/scripts/legacy-sheet-import/import-catalogue.ts --apply
//
// Baza jest nazwana przy wywołaniu, jak db:migrate:preview / :prod. Bare run trafia w lokalny
// Docker — nigdy „przypadkiem" w produkcję. Wsad na produkcję robi człowiek, nie agent.
import { readFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '../../payload.config'
import { getDb } from '../../lib/db/get-db'
import { insertCatalogueItems, listCatalogueMatchKeys } from '../../lib/db/work-catalogue'
import type { CatalogueSeedItemT } from '../../lib/kosztorys/work-catalogue/types'

// Ścieżka powtórzona za `export-catalogue.ts`, a nie z niego zaimportowana: tamten moduł wykonuje
// eksport na starcie, więc import stałej uruchomiłby zapis do pliku przy każdym wsadzie.
const DEFAULT_FILE = 'src/scripts/legacy-sheet-import/katalog-prac.json'

const APPLY = process.argv.includes('--apply')
const FILE = process.env.CATALOGUE_FILE ?? DEFAULT_FILE

async function main() {
  const items = JSON.parse(readFileSync(FILE, 'utf8')) as CatalogueSeedItemT[]
  const payload = await getPayload({ config })
  const db = await getDb(payload)
  const existing = await listCatalogueMatchKeys(db)
  const fresh = items.filter((item) => !existing.has(item.matchKey))

  console.log(`Plik: ${FILE} — ${items.length} pozycji.`)
  console.log(`W bazie już: ${items.length - fresh.length}. Do utworzenia: ${fresh.length}.`)

  if (!APPLY) {
    console.log('Dry-run — nic nie zapisano. Dodaj --apply.')
    process.exit(0)
  }

  const created = await insertCatalogueItems(db, items)
  console.log(`Utworzono: ${created}.`)
  process.exit(0)
}

await main()
