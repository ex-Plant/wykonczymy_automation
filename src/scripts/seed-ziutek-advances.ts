/**
 * Seed script — creates 200 ADVANCE transactions assigned to "Ziutek Dwa".
 *
 * Usage:  pnpm seed:ziutek
 *
 * Prerequisites: the user "ziutek2@test.pl" and at least one cash register must exist.
 * Hooks run normally so balances stay consistent.
 */

import { getPayload } from 'payload'
import config from '@payload-config'

const ZIUTEK_EMAIL = 'ziutek2@test.pl'
const TRANSACTION_COUNT = 200

const PAYMENT_METHODS = ['CASH', 'BLIK', 'TRANSFER', 'CARD'] as const

const ADVANCE_DESCRIPTIONS = [
  'Zaliczka na materiały',
  'Zaliczka tygodniowa',
  'Zaliczka na dojazd',
  'Zaliczka na narzędzia',
  'Zaliczka na paliwo',
  'Zaliczka na zakwaterowanie',
  'Zaliczka na śniadanie ekipy',
  'Zaliczka na transport',
]

const INVOICE_NOTES = [
  'Paragon fiskalny',
  'Potwierdzenie przelewu',
  'Pokwitowanie odbioru',
  'Notatka wewnętrzna',
]

const randomItem = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!

const randomBetween = (min: number, max: number): number =>
  Math.round((Math.random() * (max - min) + min) * 100) / 100

/** Random date within the last `months` months. */
const randomDate = (months = 6): string => {
  const now = Date.now()
  const past = now - months * 30 * 24 * 60 * 60 * 1000
  return new Date(past + Math.random() * (now - past)).toISOString().split('T')[0]!
}

async function main() {
  console.log('Initializing Payload...')
  const payload = await getPayload({ config })

  // Look up Ziutek Dwa
  const ziutekResult = await payload.find({
    collection: 'users',
    where: { email: { equals: ZIUTEK_EMAIL } },
    limit: 1,
  })

  const ziutek = ziutekResult.docs[0]
  if (!ziutek) {
    console.error(`User "${ZIUTEK_EMAIL}" not found. Create the user first.`)
    process.exit(1)
  }
  console.log(`Found user: ${ziutek.name} (id: ${ziutek.id})`)

  // Find a manager/owner to be createdBy
  const managerResult = await payload.find({
    collection: 'users',
    where: { role: { in: ['ADMIN', 'OWNER', 'MANAGER'] } },
    limit: 1,
  })

  const creator = managerResult.docs[0]
  if (!creator) {
    console.error('No ADMIN/OWNER/MANAGER user found to set as createdBy.')
    process.exit(1)
  }
  console.log(`Using createdBy: ${creator.name} (${creator.role})`)

  // Get all cash registers
  const registers = await payload.find({
    collection: 'cash-registers',
    limit: 100,
  })

  if (registers.docs.length === 0) {
    console.error('No cash registers found. Create at least one first.')
    process.exit(1)
  }

  const registerIds = registers.docs.map((r) => r.id)
  console.log(`Found ${registerIds.length} cash register(s)`)

  // Build 200 ADVANCE transactions
  const transactions = Array.from({ length: TRANSACTION_COUNT }, () => ({
    description: randomItem(ADVANCE_DESCRIPTIONS),
    amount: randomBetween(100, 3000),
    date: randomDate(),
    type: 'ADVANCE' as const,
    paymentMethod: randomItem(PAYMENT_METHODS) as string,
    cashRegister: randomItem(registerIds),
    worker: ziutek.id,
    invoiceNote: randomItem(INVOICE_NOTES),
    createdBy: creator.id,
  })).sort((a, b) => a.date.localeCompare(b.date))

  console.log(`\nInserting ${TRANSACTION_COUNT} ADVANCE transactions for ${ziutek.name}...`)

  let created = 0
  for (const tx of transactions) {
    await payload.create({
      collection: 'transactions',
      data: tx,
      overrideAccess: true,
    })
    created++
    if (created % 25 === 0) {
      console.log(`  ${created}/${TRANSACTION_COUNT} created...`)
    }
  }

  console.log(`\nDone! Created ${created} ADVANCE transactions for ${ziutek.name}.`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
