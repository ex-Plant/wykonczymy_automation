// One-off: przemalowanie sekcji ISTNIEJĄCEGO kosztorysu wg SECTION_COLOR_SEQUENCE (local dev DB).
// Do eksperymentów z kolejnością palety bez ponownego seedowania — seedy nadają ten sam kolor przy
// tworzeniu, ten skrypt robi to na miejscu. DRY=1 tylko wypisuje przypisanie, nic nie zapisuje.
//
//   INV=42 node --env-file=.env --import tsx src/scripts/recolor-kosztorys-sections.ts
//   INV=42 DRY=1 node --env-file=.env --import tsx src/scripts/recolor-kosztorys-sections.ts
import { getPayload } from 'payload'
import config from '../payload.config'
import { sectionColorForIndex } from '../lib/kosztorys/section-colors'

const INVESTMENT_ID = Number(process.env.INV ?? 42)
const DRY = process.env.DRY === '1'

const ctx = { context: { skipRevalidation: true } }

async function run() {
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'kosztorys-sections',
    where: { investment: { equals: INVESTMENT_ID } },
    sort: ['displayOrder', 'id'],
    limit: 0,
    depth: 0,
  })

  // Kolor idzie po POZYCJI na liście, nie po displayOrder — dziura po skasowanej sekcji nie ma
  // pomijać koloru, sąsiednie sekcje mają się różnić.
  for (const [index, section] of docs.entries()) {
    const color = sectionColorForIndex(index)
    if (!DRY) {
      await payload.update({
        collection: 'kosztorys-sections',
        id: section.id,
        data: { color },
        ...ctx,
      })
    }
    console.log(`${String(index + 1).padStart(2)}. ${section.name} → ${color}`)
  }

  console.log(
    `${DRY ? 'DRY — nic nie zapisano' : 'Zapisano'}: ${docs.length} sekcji inw. ${INVESTMENT_ID}`,
  )
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
