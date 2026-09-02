// One-off wsad: fill „Katalog prac" from a saved szablon. Insert-only, and it touches
// work_catalogue_items and nothing else — that is the whole basis on which running it against
// produkcja was agreed (see the plan's „Świadome odstępstwo"). Dry by default.
//
//   PRESET=3 node --env-file=.env --import tsx src/scripts/seed-work-catalogue.ts
//   PRESET=3 DB_POSTGRES_URL="$DB_POSTGRES_URL_PREVIEW" node --env-file=.env --import tsx \
//     src/scripts/seed-work-catalogue.ts --apply
//
// The target database is named EXPLICITLY at the call site, like db:migrate:preview / :prod. Run it
// bare and it hits the local Docker — never „accidentally" produkcja.
import { getPayload } from 'payload'
import config from '../payload.config'
import { getDb } from '../lib/db/get-db'
import { getPreset } from '../lib/db/presets'
import { insertCatalogueItems, listCatalogueMatchKeys } from '../lib/db/work-catalogue'
import { buildCatalogueSeed } from '../lib/kosztorys/work-catalogue/build-catalogue-seed'

const PRESET = Number(process.env.PRESET)
const APPLY = process.argv.includes('--apply')

const money = (value: number) => value.toFixed(2)
const rate = (value: number | null) => (value === null ? 'auto' : `${money(value)} zł`)

async function main() {
  if (!Number.isFinite(PRESET)) {
    console.error('Podaj PRESET=<id szablonu>')
    process.exit(1)
  }

  const payload = await getPayload({ config })
  const db = await getDb(payload)

  const preset = await getPreset(db, PRESET)
  if (!preset) {
    console.error(`Nie ma szablonu o id ${PRESET}`)
    process.exit(1)
  }

  const { items, conflicts } = buildCatalogueSeed(preset.payload)
  const existing = await listCatalogueMatchKeys(db)
  const fresh = items.filter((item) => !existing.has(item.matchKey))

  console.log(`szablon „${preset.name}"`)
  console.log(`  prac w szablonie:   ${preset.payload.items.length}`)
  console.log(`  unikalnych kluczy:  ${items.length}`)
  console.log(`  już w katalogu:     ${items.length - fresh.length}`)
  console.log(`  do utworzenia:      ${fresh.length}`)

  if (conflicts.length > 0) {
    const onPrice = conflicts.filter((conflict) => conflict.fields.includes('clientPrice')).length
    console.log(
      `\nrozbieżności (${conflicts.length}, w tym ${onPrice} na „Cena j.m.")` +
        ' — zwyciężyła wartość najczęstsza:',
    )
    for (const conflict of conflicts) {
      console.log(`  ${conflict.description}`)
      for (const occurrence of conflict.occurrences)
        console.log(
          `    ${occurrence.sectionName || '(bez sekcji)'}: ${money(occurrence.clientPrice)} zł` +
            ` / z narz. ${rate(occurrence.wToolsRate)} / bez narz. ${rate(occurrence.ownToolsRate)}`,
        )
    }
  }

  if (APPLY) {
    const created = await insertCatalogueItems(db, fresh)
    console.log(`\nZAPISANE — utworzono ${created} pozycji`)
  } else {
    console.log('\nPRÓBA — nic nie zapisano (--apply zapisuje)')
  }
  process.exit(0)
}

void main()
