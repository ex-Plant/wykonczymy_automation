/**
 * Seed script — populates the transactions table with ~150 realistic entries.
 *
 * Usage:  pnpm seed:transactions
 *
 * What it does:
 *   1. Ensures prerequisite entities exist (users, cash registers, investments, categories)
 *   2. Creates ~150 transactions spread across all types and the last 6 months
 *   3. Hooks run normally so balances stay consistent
 */

import { getPayload } from 'payload'
import config from '@payload-config'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const randomItem = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!

const randomBetween = (min: number, max: number): number =>
  Math.round((Math.random() * (max - min) + min) * 100) / 100

/** Random date within the last `months` months. */
const randomDate = (months = 6): string => {
  const now = Date.now()
  const past = now - months * 30 * 24 * 60 * 60 * 1000
  return new Date(past + Math.random() * (now - past)).toISOString().split('T')[0]!
}

// ---------------------------------------------------------------------------
// Seed data definitions
// ---------------------------------------------------------------------------

const WORKERS = [
  { name: 'Jan Kowalski', email: 'jan@wykonczymy.pl', role: 'EMPLOYEE' as const },
  { name: 'Piotr Nowak', email: 'piotr@wykonczymy.pl', role: 'EMPLOYEE' as const },
  { name: 'Marek Zieliński', email: 'marek@wykonczymy.pl', role: 'EMPLOYEE' as const },
]

const MANAGER = { name: 'Tomasz Wójcik', email: 'tomasz@wykonczymy.pl', role: 'MANAGER' as const }
const OWNER = { name: 'Anna Kowalska', email: 'anna@wykonczymy.pl', role: 'OWNER' as const }

const REGISTERS = ['Kasa główna', 'Kasa pomocnicza']

const INVESTMENTS = [
  { name: 'Remont łazienki — Kwiatowa 12', address: 'ul. Kwiatowa 12, Warszawa' },
  { name: 'Wykończenie mieszkania — Lipowa 5', address: 'ul. Lipowa 5, Kraków' },
  { name: 'Malowanie biura — Prosta 8', address: 'ul. Prosta 8, Wrocław' },
]

const OTHER_CATEGORIES = ['Paliwo', 'Narzędzia', 'Biuro']

const PAYMENT_METHODS = ['CASH', 'BLIK', 'TRANSFER', 'CARD'] as const

const DEPOSIT_DESCRIPTIONS = [
  'Wpłata do kasy',
  'Wpłata gotówki',
  'Uzupełnienie kasy',
  'Wpłata od klienta',
]

const EXPENSE_DESCRIPTIONS = [
  'Materiały budowlane',
  'Farba i grunty',
  'Płytki ceramiczne',
  'Klej montażowy',
  'Rury i złączki',
  'Armatura łazienkowa',
  'Panele podłogowe',
  'Listwy przypodłogowe',
  'Folia malarska',
  'Gips szpachlowy',
  'Cement i piasek',
  'Narzędzia elektryczne',
  'Śruby i kołki',
  'Silikon sanitarny',
  'Taśma malarska',
]

const ADVANCE_DESCRIPTIONS = [
  'Zaliczka na materiały',
  'Zaliczka tygodniowa',
  'Zaliczka na dojazd',
  'Zaliczka na narzędzia',
]

const OTHER_DESCRIPTIONS = [
  'Tankowanie samochodu',
  'Zakup wiertarki',
  'Materiały biurowe',
  'Olej do agregatu',
  'Wymiana opon',
]

const INVOICE_NOTES = [
  'Paragon fiskalny',
  'Faktura w drodze',
  'Potwierdzenie przelewu',
  'Rachunek od dostawcy',
  'Faktura do dostarczenia',
]

// ---------------------------------------------------------------------------
// Entity seeding
// ---------------------------------------------------------------------------

type PayloadT = Awaited<ReturnType<typeof getPayload>>

async function ensureUsers(payload: PayloadT) {
  const allUsers = [OWNER, MANAGER, ...WORKERS]
  const ids: number[] = []

  for (const user of allUsers) {
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: user.email } },
      limit: 1,
    })

    if (existing.docs[0]) {
      ids.push(existing.docs[0].id)
    } else {
      const created = await payload.create({
        collection: 'users',
        data: { ...user, password: 'password123' },
      })
      ids.push(created.id)
      console.log(`  Created user: ${user.name} (${user.role})`)
    }
  }

  // ids[0] = owner, ids[1] = manager, ids[2..4] = workers
  return { ownerId: ids[0]!, managerId: ids[1]!, workerIds: ids.slice(2) }
}

async function ensureRegisters(payload: PayloadT, ownerId: number) {
  const ids: number[] = []

  for (const name of REGISTERS) {
    const existing = await payload.find({
      collection: 'cash-registers',
      where: { name: { equals: name } },
      limit: 1,
    })

    if (existing.docs[0]) {
      ids.push(existing.docs[0].id)
    } else {
      const created = await payload.create({
        collection: 'cash-registers',
        data: { name, owner: ownerId, balance: 0 },
        overrideAccess: true,
      })
      ids.push(created.id)
      console.log(`  Created cash register: ${name}`)
    }
  }

  return ids
}

async function ensureInvestments(payload: PayloadT) {
  const ids: number[] = []

  for (const inv of INVESTMENTS) {
    const existing = await payload.find({
      collection: 'investments',
      where: { name: { equals: inv.name } },
      limit: 1,
    })

    if (existing.docs[0]) {
      ids.push(existing.docs[0].id)
    } else {
      const created = await payload.create({
        collection: 'investments',
        data: { ...inv, status: 'active' },
        overrideAccess: true,
      })
      ids.push(created.id)
      console.log(`  Created investment: ${inv.name}`)
    }
  }

  return ids
}

async function ensureCategories(payload: PayloadT) {
  const ids: number[] = []

  for (const name of OTHER_CATEGORIES) {
    const existing = await payload.find({
      collection: 'other-categories',
      where: { name: { equals: name } },
      limit: 1,
    })

    if (existing.docs[0]) {
      ids.push(existing.docs[0].id)
    } else {
      const created = await payload.create({
        collection: 'other-categories',
        data: { name },
        overrideAccess: true,
      })
      ids.push(created.id)
      console.log(`  Created category: ${name}`)
    }
  }

  return ids
}

// ---------------------------------------------------------------------------
// Transaction generation
// ---------------------------------------------------------------------------

type TransactionTypeT =
  | 'DEPOSIT'
  | 'INVESTMENT_EXPENSE'
  | 'ACCOUNT_FUNDING'
  | 'EMPLOYEE_EXPENSE'
  | 'OTHER'
type PaymentMethodT = 'CASH' | 'BLIK' | 'TRANSFER' | 'CARD'

type TransactionDataT = {
  description: string
  amount: number
  date: string
  type: TransactionTypeT
  paymentMethod: PaymentMethodT
  cashRegister: number
  investment?: number
  worker?: number
  otherCategory?: number
  otherDescription?: string
  invoiceNote?: string
  createdBy: number
}

type EntitiesT = {
  ownerId: number
  managerId: number
  workerIds: number[]
  registerIds: number[]
  investmentIds: number[]
  categoryIds: number[]
}

function generateDeposit(e: EntitiesT): TransactionDataT {
  return {
    description: randomItem(DEPOSIT_DESCRIPTIONS),
    amount: randomBetween(1000, 20000),
    date: randomDate(),
    type: 'DEPOSIT',
    paymentMethod: randomItem(PAYMENT_METHODS),
    cashRegister: randomItem(e.registerIds),
    createdBy: e.ownerId,
  }
}

function generateInvestmentExpense(e: EntitiesT): TransactionDataT {
  return {
    description: randomItem(EXPENSE_DESCRIPTIONS),
    amount: randomBetween(50, 5000),
    date: randomDate(),
    type: 'INVESTMENT_EXPENSE',
    paymentMethod: randomItem(PAYMENT_METHODS),
    cashRegister: randomItem(e.registerIds),
    investment: randomItem(e.investmentIds),
    invoiceNote: randomItem(INVOICE_NOTES),
    createdBy: e.managerId,
  }
}

function generateAdvance(e: EntitiesT): TransactionDataT {
  return {
    description: randomItem(ADVANCE_DESCRIPTIONS),
    amount: randomBetween(200, 3000),
    date: randomDate(),
    type: 'ACCOUNT_FUNDING',
    paymentMethod: randomItem(PAYMENT_METHODS),
    cashRegister: randomItem(e.registerIds),
    worker: randomItem(e.workerIds),
    invoiceNote: randomItem(INVOICE_NOTES),
    createdBy: e.managerId,
  }
}

function generateEmployeeExpense(e: EntitiesT): TransactionDataT {
  return {
    description: randomItem(EXPENSE_DESCRIPTIONS),
    amount: randomBetween(100, 4000),
    date: randomDate(),
    type: 'EMPLOYEE_EXPENSE',
    paymentMethod: randomItem(PAYMENT_METHODS),
    cashRegister: randomItem(e.registerIds),
    investment: randomItem(e.investmentIds),
    worker: randomItem(e.workerIds),
    invoiceNote: randomItem(INVOICE_NOTES),
    createdBy: e.managerId,
  }
}

function generateOther(e: EntitiesT): TransactionDataT {
  return {
    description: randomItem(OTHER_DESCRIPTIONS),
    amount: randomBetween(20, 1500),
    date: randomDate(),
    type: 'OTHER',
    paymentMethod: randomItem(PAYMENT_METHODS),
    cashRegister: randomItem(e.registerIds),
    otherCategory: randomItem(e.categoryIds),
    otherDescription: randomItem(OTHER_DESCRIPTIONS),
    invoiceNote: randomItem(INVOICE_NOTES),
    createdBy: e.ownerId,
  }
}

/** Build a list of ~150 transaction data objects with realistic distribution. */
function buildTransactionList(entities: EntitiesT): TransactionDataT[] {
  const txs: TransactionDataT[] = []

  // Distribution: 30 deposits, 40 investment, 30 advance, 25 employee, 25 other = 150
  for (let i = 0; i < 30; i++) txs.push(generateDeposit(entities))
  for (let i = 0; i < 40; i++) txs.push(generateInvestmentExpense(entities))
  for (let i = 0; i < 30; i++) txs.push(generateAdvance(entities))
  for (let i = 0; i < 25; i++) txs.push(generateEmployeeExpense(entities))
  for (let i = 0; i < 25; i++) txs.push(generateOther(entities))

  // Sort by date so balances accumulate chronologically
  return txs.sort((a, b) => a.date.localeCompare(b.date))
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Initializing Payload...')
  const payload = await getPayload({ config })

  console.log('\n1. Ensuring prerequisite entities...')
  const { ownerId, managerId, workerIds } = await ensureUsers(payload)
  const registerIds = await ensureRegisters(payload, ownerId)
  const investmentIds = await ensureInvestments(payload)
  const categoryIds = await ensureCategories(payload)

  const entities: EntitiesT = {
    ownerId,
    managerId,
    workerIds,
    registerIds,
    investmentIds,
    categoryIds,
  }

  console.log('\n2. Generating 150 transactions...')
  const transactions = buildTransactionList(entities)

  console.log('\n3. Inserting transactions (hooks will recalculate balances)...')
  let created = 0
  for (const tx of transactions) {
    await payload.create({
      collection: 'transactions',
      data: tx,
      overrideAccess: true,
    })
    created++
    if (created % 25 === 0) {
      console.log(`  ${created}/${transactions.length} created...`)
    }
  }

  console.log(`\nDone! Created ${created} transactions.`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
