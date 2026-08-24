// FIXTURE (EX-725): dosiewa wpłaty brutto do zbioru testowego. Prodowy dump nie zawiera ani jednej —
// wszystkie wpłaty są nieotagowane, więc bez tego skryptu cała płaszczyzna brutto i most legacy są w
// fixture zerem, a `pnpm test:parity` failuje na podłodze zbioru.
//
// Trzeci krok resetu db-test, po `pnpm db:import:test` i `pnpm seed:kosztorys:test`:
//
//   pnpm seed:deposits:test          # albo: INV=7 DB_POSTGRES_URL=… node --env-file=.env --import tsx src/scripts/seed-deposit-planes.ts
//
// Idempotentny: wiersze noszą marker w opisie i są nim czyszczone przed każdym przebiegiem.
//
// Zapis idzie surowym SQL-em, nie przez Payload, z dwóch powodów. Po pierwsze `afterChange` na
// `transactions` synchronizuje wiersz do arkusza właściciela, a `afterDelete` robi to bez żadnej
// furtki `skipSheetSync` — seed fixture'u nie ma prawa dotknąć żywego arkusza. Po drugie wiersz
// legacy (brutto bez kwoty netto) jest przez ścieżkę zapisu ZABRONIONY — `getNetAmountError` go
// odrzuca — a fixture ma go mieć, bo prod ma wiersze sprzed spike'u. Kształt przelewów jest za to
// sprawdzany tą samą jedyną instancją reguły, więc pominięcie hooka nie znaczy pominięcia walidacji.
import { getPayload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import config from '../payload.config'
import { getDb } from '@/lib/db/get-db'
import { getNetAmountError } from '@/lib/utils/validation'

const MARKER = '[fixture:gross-deposit]'
const KOSZTORYS_INVESTMENT_ID = Number(process.env.INV ?? 7)

type SeedRowT = {
  // Kwota brutto z faktury.
  amount: number
  // Kwota netto, którą faktura nazwała — `null` znaczy wiersz legacy, sprzed istnienia tej kolumny.
  // Celowo NIE jest `amount ÷ (1+VAT)`: rachunek złożony z robocizny i materiałów ma dwie stawki,
  // więc netto jest CZYTANE, nie wyprowadzane. Regresja, która je wyprowadzi, rusza liczbę.
  netAmount: number | null
  date: string
}

const KOSZTORYS_ROWS: SeedRowT[] = [
  { amount: 129_600, netAmount: 118_000, date: '2026-06-10' },
  { amount: 54_000, netAmount: 49_000, date: '2026-06-24' },
  { amount: 8_640, netAmount: 8_000, date: '2026-07-08' },
  { amount: 21_600, netAmount: null, date: '2026-05-12' },
]

const SECOND_ROWS: SeedRowT[] = [
  { amount: 32_400, netAmount: 29_500, date: '2026-06-18' },
  { amount: 10_800, netAmount: null, date: '2026-05-20' },
]

const label = (row: SeedRowT) =>
  `${MARKER} ${row.netAmount === null ? 'przelew legacy — bez kwoty netto' : 'przelew z faktury'}`

async function run() {
  const payload = await getPayload({ config })
  const db = await getDb(payload)

  // Druga inwestycja rozwiązywana z danych, nie zahardkodowana: `id` przychodzą z dumpa prodowego.
  // Bez kosztorysu — żeby wpłata brutto istniała też tam, gdzie robocizna czytana z kosztorysu jest
  // zerem, czyli w stanie „klient nadpłacił", w którym bilans brutto jest jedyną figurą, jaka się
  // rusza.
  const second = await db.execute(sql`
    SELECT t.investment_id AS id
    FROM transactions t
    WHERE t.type = 'INVESTOR_DEPOSIT'
      AND t.cancelled IS NOT TRUE
      AND t.investment_id IS NOT NULL
      AND t.investment_id <> ${KOSZTORYS_INVESTMENT_ID}
      AND NOT EXISTS (SELECT 1 FROM kosztorys_items ki WHERE ki.investment_id = t.investment_id)
    GROUP BY t.investment_id
    ORDER BY t.investment_id
    LIMIT 1
  `)
  const secondInvestmentId = second.rows[0] ? Number(second.rows[0].id) : null
  if (secondInvestmentId === null) {
    throw new Error(
      'brak inwestycji bez kosztorysu z wpłatami — czy dump jest zaimportowany (pnpm db:import:test)?',
    )
  }

  const targets: { investmentId: number; rows: SeedRowT[] }[] = [
    { investmentId: KOSZTORYS_INVESTMENT_ID, rows: KOSZTORYS_ROWS },
    { investmentId: secondInvestmentId, rows: SECOND_ROWS },
  ]

  for (const { investmentId, rows } of targets) {
    for (const row of rows) {
      const error = getNetAmountError(row.netAmount, row.amount, 'INVESTOR_DEPOSIT', 'GROSS')
      // Wiersz legacy łamie tę regułę Z DEFINICJI — po to istnieje. Każdy inny błąd to literówka w
      // kwotach powyżej i seed ma stanąć, zanim wstawi wiersz, którego aplikacja nie umiałaby zapisać.
      if (error && row.netAmount !== null) {
        throw new Error(`wiersz ${row.amount}/${row.netAmount} na inw. ${investmentId}: ${error}`)
      }
    }
  }

  const investmentIds = targets.map((t) => t.investmentId)
  let wiped = 0
  let seeded = 0
  for (const { investmentId, rows } of targets) {
    const gone = await db.execute(sql`
      DELETE FROM transactions
      WHERE description LIKE ${`${MARKER}%`}
        AND investment_id = ${investmentId}
      RETURNING id
    `)
    wiped += gone.rows.length

    // Kasa z ostatniej wpłaty tej inwestycji — `INVESTOR_DEPOSIT` ma kasę wymaganą, a wybór z danych
    // trzyma seed odpornym na `id` przychodzące z dumpa.
    const register = await db.execute(sql`
      SELECT source_register_id AS id
      FROM transactions
      WHERE type = 'INVESTOR_DEPOSIT'
        AND investment_id = ${investmentId}
        AND source_register_id IS NOT NULL
      ORDER BY date DESC, id DESC
      LIMIT 1
    `)
    const registerId = register.rows[0] ? Number(register.rows[0].id) : null
    if (registerId === null) {
      throw new Error(`inw. ${investmentId} nie ma wpłaty z kasą — nie ma z czego wziąć kasy`)
    }

    for (const row of rows) {
      await db.execute(sql`
        INSERT INTO transactions
          (description, amount, net_amount, vat_plane, date, type, payment_method,
           source_register_id, investment_id, cancelled, settled)
        VALUES
          (${label(row)}, ${row.amount}, ${row.netAmount}, 'GROSS', ${row.date}::timestamptz,
           'INVESTOR_DEPOSIT', 'TRANSFER', ${registerId}, ${investmentId}, false, false)
      `)
      seeded++
    }
  }

  console.log(
    `Fixture wpłat brutto: usunięto ${wiped}, wstawiono ${seeded} ` +
      `(inw. ${investmentIds.join(', ')})`,
  )
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
