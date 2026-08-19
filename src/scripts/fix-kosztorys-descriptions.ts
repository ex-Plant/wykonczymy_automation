// Bulk run of the „Opis prac" cleanup — the same rules the Opcje button applies, but over many
// inwestycje and over saved szablony at once. Dry by default; pass APPLY=1 to write.
//
//   INV=90 node --env-file=.env --import tsx src/scripts/fix-kosztorys-descriptions.ts
//   INV=all APPLY=1 PRESETS=1 node --env-file=.env --import tsx src/scripts/fix-kosztorys-descriptions.ts
//
//   INV      investment id, or `all` for every investment (default: all)
//   APPLY    1 = write, anything else = dry run that only prints the diff
//   PRESETS  1 = clean saved preset payloads as well
import { sql } from '@payloadcms/db-vercel-postgres'
import { getPayload } from 'payload'
import config from '../payload.config'
import { getDb, type DbExecutorT } from '../lib/db/get-db'
import { getItemDescriptions, setItemDescriptions } from '../lib/db/kosztorys-descriptions'
import { cleanDescription } from '../lib/kosztorys/clean-description'

const INV = process.env.INV ?? 'all'
const APPLY = process.env.APPLY === '1'
const PRESETS = process.env.PRESETS === '1'

type PresetPayloadT = { items?: { description?: string }[] }

async function investmentIds(db: DbExecutorT): Promise<number[]> {
  if (INV !== 'all') return [Number(INV)]
  const res = await db.execute(
    sql`SELECT DISTINCT investment_id FROM kosztorys_items ORDER BY investment_id`,
  )
  return res.rows.map((row) => Number(row.investment_id))
}

async function fixItems(db: DbExecutorT): Promise<void> {
  let scanned = 0
  let touched = 0
  for (const investmentId of await investmentIds(db)) {
    const rows = await getItemDescriptions(db, investmentId)
    const changed = rows.flatMap((row) => {
      const description = cleanDescription(row.description)
      return description === row.description ? [] : [{ ...row, cleaned: description }]
    })
    scanned += rows.length
    touched += changed.length
    for (const row of changed)
      console.log(`#${investmentId}/${row.id}\n  - ${row.description}\n  + ${row.cleaned}`)
    if (APPLY && changed.length > 0)
      await setItemDescriptions(
        db,
        investmentId,
        changed.map(({ id, cleaned }) => ({ id, description: cleaned })),
      )
  }
  console.log(`\nopisy: ${touched} do poprawy z ${scanned} przejrzanych`)
}

async function fixPresets(db: DbExecutorT): Promise<void> {
  const res = await db.execute(sql`SELECT id, name, payload FROM kosztorys_presets`)
  for (const row of res.rows) {
    const preset = row.payload as PresetPayloadT
    let touched = 0
    for (const item of preset.items ?? []) {
      if (typeof item.description !== 'string') continue
      const cleaned = cleanDescription(item.description)
      if (cleaned === item.description) continue
      item.description = cleaned
      touched += 1
    }
    console.log(`szablon „${String(row.name)}": ${touched} opisów do poprawy`)
    if (APPLY && touched > 0)
      await db.execute(
        sql`UPDATE kosztorys_presets SET payload = ${JSON.stringify(preset)}::jsonb WHERE id = ${Number(row.id)}`,
      )
  }
}

async function main() {
  const payload = await getPayload({ config })
  const db = await getDb(payload)
  await fixItems(db)
  if (PRESETS) await fixPresets(db)
  console.log(APPLY ? 'ZAPISANE' : 'PRÓBA — nic nie zapisano (APPLY=1 zapisuje)')
  process.exit(0)
}

void main()
