// Faza 4, wsad lokalny: kandydaci z przebiegu B lądują w katalogu. Dry-run domyślnie.
//
//   node --env-file=.env --import tsx src/scripts/legacy-sheet-import/apply.ts
//   node --env-file=.env --import tsx src/scripts/legacy-sheet-import/apply.ts --apply
//
// Świadomie BEZ ścieżki na inną bazę — inaczej niż `seed-work-catalogue.ts`. Akcja dzieje się
// lokalnie, a produkcja dostaje wynik jako plik eksportu (`export-catalogue.ts`), nie powtórkę.
import { getPayload } from 'payload'
import config from '../../payload.config'
import { getDb } from '../../lib/db/get-db'
import { insertCatalogueItems, listCatalogueItems } from '../../lib/db/work-catalogue'
import { runAnalysis } from './run-analysis'

const APPLY = process.argv.includes('--apply')

async function main() {
  const payload = await getPayload({ config })
  const db = await getDb(payload)
  const catalogue = await listCatalogueItems(db)

  const { candidates, skipped, totalKeys } = runAnalysis(catalogue)

  console.log(`W katalogu: ${catalogue.length} pozycji.`)
  console.log(`Z arkuszy: ${totalKeys} unikalnych prac, ${skipped} już w katalogu.`)
  console.log(`Do utworzenia: ${candidates.length}.`)

  if (!APPLY) {
    console.log('Dry-run — nic nie zapisano. Dodaj --apply.')
    process.exit(0)
  }

  // `insertCatalogueItems` jest insert-only po `match_key`, więc wsad nie ma jak nadpisać pozycji
  // wzoru ani niczego, co ktoś zdążył poprawić ręcznie.
  const created = await insertCatalogueItems(
    db,
    candidates.map(
      ({ description, category, unit, clientPrice, wToolsRate, ownToolsRate, matchKey }) => ({
        description,
        category,
        unit,
        clientPrice,
        wToolsRate,
        ownToolsRate,
        matchKey,
      }),
    ),
  )
  console.log(`Utworzono: ${created}.`)
  process.exit(0)
}

await main()
