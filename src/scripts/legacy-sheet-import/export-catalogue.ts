// Faza 4, eksport: cały przejrzany katalog do jednego pliku, który pojedzie na produkcję.
//
//   node --env-file=.env --import tsx src/scripts/legacy-sheet-import/export-catalogue.ts
//
// Plik ląduje w repo, żeby przed wgraniem był widoczny w diffie.
import { writeFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '../../payload.config'
import { getDb } from '../../lib/db/get-db'
import { listCatalogueItems } from '../../lib/db/work-catalogue'
import { catalogueKey } from '../../lib/kosztorys/work-catalogue/catalogue-key'
import type { CatalogueSeedItemT } from '../../lib/kosztorys/work-catalogue/types'
import { LEGACY_PREFIX } from './collect-candidates'

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
      // Przeliczany, nie kopiowany z bazy: przy przeglądzie ktoś poprawia nazwę w edytorze pozycji,
      // a zapisany klucz zostałby wtedy wskaźnikiem na nazwę, której już nie ma. Dopisek zdejmowany
      // przed liczeniem — jest znacznikiem do przeglądu, nie częścią nazwy pracy, więc pozycja
      // z niezdjętym dopiskiem musi trafiać w ten sam klucz co ta sama praca bez niego.
      matchKey: catalogueKey(item.description.replace(LEGACY_PREFIX, ''), item.unit),
    }))
    .sort(
      (a, b) =>
        (a.category ?? '').localeCompare(b.category ?? '') ||
        a.description.localeCompare(b.description),
    )

  writeFileSync(EXPORT_PATH, `${JSON.stringify(items, null, 2)}\n`)
  console.log(`Zapisano ${items.length} pozycji do ${EXPORT_PATH}.`)
  process.exit(0)
}

await main()
