// Phase 4, load from file: the exported katalog goes into the database NAMED EXPLICITLY at the call
// site. Insert-only on `match_key`, so a re-run adds only what isn't there yet.
//
//   node --env-file=.env --import tsx src/scripts/legacy-sheet-import/import-catalogue.ts
//   DB_POSTGRES_URL="$DB_POSTGRES_URL_PROD" node --env-file=.env --import tsx \
//     src/scripts/legacy-sheet-import/import-catalogue.ts --apply
//
// Naming the database at the call site is the same guard db:migrate:preview / :prod use: a bare run
// hits the local Docker, never production by accident. A human loads production, not the agent.
import { readFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '../../payload.config'
import { getDb } from '../../lib/db/get-db'
import { insertCatalogueItems, listCatalogueMatchKeys } from '../../lib/db/work-catalogue'
import type { CatalogueSeedItemT } from '../../lib/kosztorys/work-catalogue/types'

// Repeated from `export-catalogue.ts` rather than imported: that module runs the export on load, so
// importing the constant would rewrite the file on every load.
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

  // `fresh`, not `items` — exactly what the dry run announced. `ON CONFLICT DO NOTHING` would reach
  // the same end state, but then the reported number and the set actually sent to the database are
  // two different things, and on a production load the report must BE what happens.
  const created = await insertCatalogueItems(db, fresh)
  console.log(`Utworzono: ${created}.`)
  process.exit(0)
}

await main()
