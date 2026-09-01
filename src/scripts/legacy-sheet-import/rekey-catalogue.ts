// Jednorazowo: przelicz `match_key` w całym katalogu nową normalizacją j.m. (`foldUnit`). Bez tego
// wzór zapisany jako `m2` i stary arkusz piszący `m²` to dwie różne prace, czyli dokładnie ten
// duplikat, któremu normalizacja ma zapobiec. Próba domyślnie.
//
//   node --env-file=.env --import tsx src/scripts/legacy-sheet-import/rekey-catalogue.ts
//   node --env-file=.env --import tsx src/scripts/legacy-sheet-import/rekey-catalogue.ts --apply
//
// Baza z `DB_POSTGRES_URL`, więc bare run trafia w lokalny Docker — produkcja tabeli jeszcze nie ma.
import { sql } from '@payloadcms/db-vercel-postgres'
import { getPayload } from 'payload'
import config from '../../payload.config'
import { getDb } from '../../lib/db/get-db'
import { listCatalogueItems } from '../../lib/db/work-catalogue'
import { catalogueKey } from '../../lib/kosztorys/work-catalogue/catalogue-key'

const APPLY = process.argv.includes('--apply')

async function main() {
  const payload = await getPayload({ config })
  const db = await getDb(payload)

  const items = await listCatalogueItems(db)
  const rekeyed = items.map((item) => ({
    item,
    freshKey: catalogueKey(item.description, item.unit),
  }))
  const changed = rekeyed.filter(({ item, freshKey }) => item.matchKey !== freshKey)

  // Dwa wiersze schodzące się do jednego klucza to ta sama praca zapisana z dwoma wariantami j.m.
  // UNIQUE na `match_key` odrzuciłby drugi UPDATE, więc łapiemy je zanim baza to zrobi — i zamiast
  // zgadywać, który wiersz zostaje, oddajemy decyzję człowiekowi.
  const byFreshKey = new Map<string, typeof rekeyed>()
  for (const entry of rekeyed) {
    const bucket = byFreshKey.get(entry.freshKey) ?? []
    bucket.push(entry)
    byFreshKey.set(entry.freshKey, bucket)
  }
  const collisions = [...byFreshKey.values()].filter((bucket) => bucket.length > 1)

  console.log(`pozycji w katalogu:  ${items.length}`)
  console.log(`kluczy do zmiany:    ${changed.length}`)
  console.log(`kolizji:             ${collisions.length}`)

  for (const bucket of collisions) {
    console.log(`\nKOLIZJA na kluczu ${bucket[0]!.freshKey} — do rozstrzygnięcia ręcznie:`)
    for (const { item } of bucket)
      console.log(`  #${item.id} „${item.description}" [${item.unit}] ${item.clientPrice} zł`)
  }

  if (collisions.length > 0) {
    console.error('\nPRZERWANE — najpierw scal albo skasuj kolidujące pozycje.')
    process.exit(1)
  }

  for (const { item, freshKey } of changed)
    console.log(`  #${item.id} [${item.unit}] ${item.matchKey} → ${freshKey}`)

  if (!APPLY) {
    console.log('\nPRÓBA — nic nie zapisano (--apply zapisuje)')
    process.exit(0)
  }

  for (const { item, freshKey } of changed)
    await db.execute(
      sql`UPDATE work_catalogue_items SET match_key = ${freshKey} WHERE id = ${item.id}`,
    )
  console.log(`\nZAPISANE — przeliczono ${changed.length} kluczy`)
  process.exit(0)
}

void main()
