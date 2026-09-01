// Phase 4, export: the whole reviewed katalog into the one file that goes to production.
//
//   node --env-file=.env --import tsx src/scripts/legacy-sheet-import/export-catalogue.ts
//
// The file lands in the repo so it shows up in a diff before anyone loads it.
import { writeFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '../../payload.config'
import { getDb } from '../../lib/db/get-db'
import { listCatalogueItems } from '../../lib/db/work-catalogue'
import { catalogueKey } from '../../lib/kosztorys/work-catalogue/catalogue-key'
import type { CatalogueSeedItemT } from '../../lib/kosztorys/work-catalogue/types'
import { stripLegacyMarker } from '../../lib/kosztorys/work-catalogue/legacy-marker'

const EXPORT_PATH = 'src/scripts/legacy-sheet-import/katalog-prac.json'

async function main() {
  const payload = await getPayload({ config })
  const db = await getDb(payload)
  const catalogue = await listCatalogueItems(db)

  const items: CatalogueSeedItemT[] = catalogue
    .map((item) => ({
      description: item.description,
      category: item.category,
      unit: item.unit,
      clientPrice: item.clientPrice,
      wToolsRate: item.wToolsRate,
      ownToolsRate: item.ownToolsRate,
      // Recomputed, never copied from the DB: the review IS people renaming pracy in the item
      // editor, and a stored key would then point at a name that no longer exists. The marker comes
      // off first — it is a note for the reviewer, not part of the praca's name, so a row that still
      // carries it must land on the same key as the same praca without it.
      matchKey: catalogueKey(stripLegacyMarker(item.description), item.unit),
    }))
    .sort(
      (a, b) =>
        (a.category ?? '').localeCompare(b.category ?? '') ||
        a.description.localeCompare(b.description),
    )

  // Two names corrected into the same name converge on one key, and the load is insert-only on
  // `match_key` — so production would take such a pair as a single praca and silently drop the
  // other. The export therefore refuses to write rather than emit a file that looks right.
  const collisions = [...Map.groupBy(items, (item) => item.matchKey).values()].filter(
    (bucket) => bucket.length > 1,
  )
  for (const bucket of collisions) {
    console.error(`\nKOLIZJA na kluczu ${bucket[0]!.matchKey} — do rozstrzygnięcia ręcznie:`)
    for (const item of bucket)
      console.error(`  „${item.description}" [${item.unit}] ${item.clientPrice} zł`)
  }
  if (collisions.length > 0) {
    console.error('\nPRZERWANE — nic nie zapisano. Najpierw scal albo skasuj kolidujące pozycje.')
    process.exit(1)
  }

  writeFileSync(EXPORT_PATH, `${JSON.stringify(items, null, 2)}\n`)
  console.log(`Zapisano ${items.length} pozycji do ${EXPORT_PATH}.`)
  process.exit(0)
}

await main()
