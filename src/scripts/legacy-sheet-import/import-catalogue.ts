// Phase 4, write side: the katalog arrives on stdin from `export-catalogue.ts` and goes into the
// database NAMED EXPLICITLY at this call site. Insert-only on `match_key`, so a re-run adds only what
// isn't there yet.
//
//   node --env-file=.env --import tsx src/scripts/legacy-sheet-import/export-catalogue.ts \
//     | node --env-file=.env --import tsx src/scripts/legacy-sheet-import/import-catalogue.ts
//
//   node --env-file=.env --import tsx src/scripts/legacy-sheet-import/export-catalogue.ts \
//     | DB_POSTGRES_URL="$DB_POSTGRES_URL_PROD" node --env-file=.env --import tsx \
//       src/scripts/legacy-sheet-import/import-catalogue.ts --apply
//
// Naming the database at the call site is the same guard db:migrate:preview / :prod use: a bare run
// hits the local Docker, never production by accident. A human loads production, not the agent.
import { getPayload } from 'payload'
import config from '../../payload.config'
import { getDb } from '../../lib/db/get-db'
import { insertCatalogueItems, listCatalogueMatchKeys } from '../../lib/db/work-catalogue'
import type { CatalogueSeedItemT } from '../../lib/kosztorys/work-catalogue/types'

async function readStdin(): Promise<string> {
  let input = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) input += chunk
  return input
}

async function main() {
  const input = await readStdin()
  // An empty stdin is how a refused export (a key collision) reaches this side — it aborts before
  // writing a byte. Saying so beats a bare JSON syntax error on a production load.
  if (input.trim() === '') {
    console.error('Puste wejście — eksport nic nie wypisał albo nie został podpięty potokiem.')
    process.exit(1)
  }
  const items = JSON.parse(input) as CatalogueSeedItemT[]

  const payload = await getPayload({ config })
  const db = await getDb(payload)
  const existing = await listCatalogueMatchKeys(db)
  const fresh = items.filter((item) => !existing.has(item.matchKey))

  console.log(`Na wejściu: ${items.length} pozycji.`)
  console.log(`W bazie już: ${items.length - fresh.length}. Do utworzenia: ${fresh.length}.`)

  if (!process.argv.includes('--apply')) {
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
