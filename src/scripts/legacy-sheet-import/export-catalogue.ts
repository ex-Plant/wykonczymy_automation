// Phase 4, read side: the whole reviewed katalog onto stdout, for `import-catalogue.ts` to load into
// the database named at ITS call site.
//
//   node --env-file=.env --import tsx src/scripts/legacy-sheet-import/export-catalogue.ts \
//     | DB_POSTGRES_URL="$DB_POSTGRES_URL_PROD" node --env-file=.env --import tsx \
//       src/scripts/legacy-sheet-import/import-catalogue.ts --apply
//
// Two processes rather than one, because Payload binds its database at startup: a single process can
// hold the source or the target, never both. Piping keeps the katalog out of a file — a 940-row JSON
// in the repo was never read by anyone, and a stale copy of it is a second source of truth.
// Everything but the rows goes to stderr, so the pipe carries JSON and nothing else.
import { getPayload } from 'payload'
import config from '../../payload.config'
import { getDb } from '../../lib/db/get-db'
import { listCatalogueItems } from '../../lib/db/work-catalogue'
import { catalogueKey } from '../../lib/kosztorys/work-catalogue/catalogue-key'
import type { CatalogueSeedItemT } from '../../lib/kosztorys/work-catalogue/types'
import { stripLegacyMarker } from '../../lib/kosztorys/work-catalogue/legacy-marker'

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
  // other. The export therefore emits nothing rather than a stream that looks right; the reader then
  // fails on empty input, which is why the pipe needs no `pipefail` to stay safe.
  const collisions = [...Map.groupBy(items, (item) => item.matchKey).values()].filter(
    (bucket) => bucket.length > 1,
  )
  for (const bucket of collisions) {
    console.error(`\nKOLIZJA na kluczu ${bucket[0]!.matchKey} — do rozstrzygnięcia ręcznie:`)
    for (const item of bucket)
      console.error(`  „${item.description}" [${item.unit}] ${item.clientPrice} zł`)
  }
  if (collisions.length > 0) {
    console.error('\nPRZERWANE — nic nie wypisano. Najpierw scal albo skasuj kolidujące pozycje.')
    process.exit(1)
  }

  // Awaited, not fire-and-forget: writing to a PIPE is asynchronous, and `process.exit` below would
  // otherwise cut the JSON off mid-row — the reader would then load a silently truncated katalog.
  await new Promise<void>((resolve, reject) =>
    process.stdout.write(`${JSON.stringify(items)}\n`, (error) =>
      error ? reject(error) : resolve(),
    ),
  )
  console.error(`Wypisano ${items.length} pozycji.`)
  // Payload keeps the pool open, so the process needs telling to end.
  process.exit(0)
}

await main()
