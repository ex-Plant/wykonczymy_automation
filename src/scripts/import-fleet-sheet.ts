// One-off: import the owner's vehicle-control spreadsheet („Kontrola przeglądów i ubezpieczeń
// samochodów") into the fleet module. DELETE THIS FILE once prod is populated — the decision was to
// keep no permanent sync surface between the sheet and the app.
//
// The source is an uploaded .xlsm, not a live Google Sheet, so the data is pasted below rather than
// fetched; scripts/inspect-sheet.mjs cannot read that format and a live fetch buys nothing for a
// single run. Values verified against the raw sheet XML on 2026-08-25.
//
//   DRY_RUN=1 node --env-file=.env --import tsx src/scripts/import-fleet-sheet.ts
//   node --env-file=.env --import tsx src/scripts/import-fleet-sheet.ts
//
// Runs against whatever DB_POSTGRES_URL points at — the local docker DB. Prod is a human step,
// after `pnpm db:migrate:prod`.
import { getPayload } from 'payload'
import config from '../payload.config'
import type { ScheduledInspectionTypeT } from '../lib/fleet/inspection-types'

const DRY_RUN = process.env.DRY_RUN === '1'

// The day the sheet was read. The „aktualny przebieg" column is a snapshot with no date of its own,
// so its ODOMETER row is stamped with the reading day rather than with whenever this script runs.
const READING_DAY = '2026-08-25'

// The sheet records only the expiry, never when the przegląd or the polisa was actually done. The
// app derives „current" from `performedAt`, so a row without one is invisible to `latestByType` —
// hence the assumption, recorded on every row that carries it.
const ASSUMED_NOTE =
  'Data wykonania nieznana — przyjęto rok przed terminem (import z arkusza kontroli, 2026-08-25).'

const yearBefore = (day: string) => `${Number(day.slice(0, 4)) - 1}${day.slice(4)}`

type OdometerReadingT = { odometer: number; performedAt: string }

type CarT = {
  registration: string
  make: string
  model: string
  year?: number
  vin?: string
  tyres?: string
  note?: string
  exemptions?: ScheduledInspectionTypeT[]
  /** Expiry of the przegląd; absent for the przyczepa, whose sheet cell reads „bezterminowo". */
  technicalDue?: string
  insuranceDue?: string
  insurer?: string
  policyNumber?: string
  oilChange?: OdometerReadingT
  /** „Aktualny przebieg" where the sheet carries one that no oil change already records. */
  reading?: OdometerReadingT
}

const CARS: CarT[] = [
  {
    registration: 'WD3465W',
    make: 'Volvo',
    model: 'XC90',
    vin: 'YV1LFK2VCM1746096',
    tyres: 'całoroczne',
    technicalDue: '2027-05-15',
    insuranceDue: '2027-07-15',
    insurer: 'uniqa',
    policyNumber: '354E000003305',
    oilChange: { odometer: 100_000, performedAt: '2026-05-30' },
  },
  {
    registration: 'WD4422W',
    make: 'Cupra',
    model: 'Formentor',
    vin: 'VSSZZZKMZNR052045',
    tyres: 'całoroczne',
    technicalDue: '2027-06-09',
    insuranceDue: '2027-06-09',
    insurer: 'pzu',
    policyNumber: '1122301061',
    oilChange: { odometer: 60_104, performedAt: '2026-08-19' },
  },
  {
    registration: 'SI 71241',
    make: 'VW',
    model: 'Touran',
    vin: 'WVGZZZ1TZHW024197',
    tyres: 'letnie',
    technicalDue: '2027-03-16',
    insuranceDue: '2027-04-22',
    insurer: 'ergo hestia',
    policyNumber: '911053601167',
    oilChange: { odometer: 152_970, performedAt: '2026-02-11' },
  },
  {
    registration: 'WD4815W',
    make: 'Ford',
    model: 'FT Custom 340',
    vin: 'WF0YXXTTGYHA26283',
    tyres: 'zima',
    technicalDue: '2027-07-08',
    insuranceDue: '2027-07-07',
    insurer: 'link 4',
    policyNumber: 'F34442402700',
    oilChange: { odometer: 143_633, performedAt: '2026-07-31' },
  },
  {
    registration: 'WD3786V',
    make: 'Ford',
    model: 'Transit',
    year: 2019,
    vin: 'WF0RXXWPGRKU09131',
    tyres: 'do wymiany na cały sezon.',
    note: 'może tarcze i klocki będą do wymiany, poduszka silnika do wymiany, nowe opony',
    technicalDue: '2027-08-20',
    insuranceDue: '2027-08-20',
    insurer: 'compensa',
    // Two groups separated by a space — the reason `policyNumber` is text and not a number.
    policyNumber: '22044 4672279',
    oilChange: { odometer: 126_289, performedAt: '2026-08-19' },
  },
  {
    registration: 'WD2376W',
    make: 'Ford',
    model: 'Transit',
    year: 2016,
    vin: 'WF0SXXWPGSFK06970',
    tyres: 'całoroczne',
    technicalDue: '2027-04-07',
    insuranceDue: '2027-04-19',
    insurer: 'link 4',
    policyNumber: 'F34258614300',
    oilChange: { odometer: 219_800, performedAt: '2026-04-10' },
  },
  {
    registration: 'WF7972X',
    make: 'Chevrolet',
    model: 'Cruze',
    vin: 'KL1JF3589DK022474',
    technicalDue: '2026-10-31',
    insuranceDue: '2027-05-31',
    insurer: 'ergo hestia',
    policyNumber: '911054423436',
    oilChange: { odometer: 160_000, performedAt: '2025-11-13' },
    // The only car whose sheet row shows a newer reading than its oil change — 17 500 km on, which
    // is what makes its przekroczony interwał visible the moment the fleet page opens.
    reading: { odometer: 177_500, performedAt: READING_DAY },
  },
  {
    registration: 'WF 7029W',
    make: 'VW',
    model: 'T4',
    vin: 'WV1ZZZ70Z3X109767',
    tyres: 'całosezonowe ale do wymiany',
    technicalDue: '2026-06-27',
    insuranceDue: '2027-03-29',
  },
  {
    registration: 'WD776AL',
    make: 'Knaus',
    model: 'Przyczepa',
    // „bezterminowo" in the przegląd cell — a trailer of this class has no periodic badanie.
    exemptions: ['TECHNICAL'],
    insuranceDue: '2027-05-19',
    policyNumber: '920065608303',
  },
]

type PlannedEventT = {
  type: 'TECHNICAL' | 'INSURANCE' | 'OIL_CHANGE' | 'ODOMETER'
  performedAt: string
  nextDueAt?: string
  odometer?: number
  insurer?: string
  policyNumber?: string
  note?: string
}

// Every event lands with `cost: null`: the sheet carries no prices at all, and a 0 would claim the
// przegląd was free.
const eventsFor = (car: CarT): PlannedEventT[] => [
  ...(car.technicalDue
    ? [
        {
          type: 'TECHNICAL' as const,
          performedAt: yearBefore(car.technicalDue),
          nextDueAt: car.technicalDue,
          note: ASSUMED_NOTE,
        },
      ]
    : []),
  ...(car.insuranceDue
    ? [
        {
          type: 'INSURANCE' as const,
          performedAt: yearBefore(car.insuranceDue),
          nextDueAt: car.insuranceDue,
          insurer: car.insurer,
          policyNumber: car.policyNumber,
          note: ASSUMED_NOTE,
        },
      ]
    : []),
  ...(car.oilChange
    ? [
        {
          type: 'OIL_CHANGE' as const,
          performedAt: car.oilChange.performedAt,
          odometer: car.oilChange.odometer,
        },
      ]
    : []),
  ...(car.reading
    ? [
        {
          type: 'ODOMETER' as const,
          performedAt: car.reading.performedAt,
          odometer: car.reading.odometer,
        },
      ]
    : []),
]

async function run() {
  const payload = await getPayload({ config })
  const ctx = { context: { skipRevalidation: true } }

  let created = 0
  let updated = 0
  let events = 0
  let skipped = 0

  for (const car of CARS) {
    const planned = eventsFor(car)
    const data = {
      registration: car.registration,
      make: car.make,
      model: car.model,
      year: car.year ?? null,
      vin: car.vin ?? null,
      tyres: car.tyres ?? null,
      note: car.note ?? null,
      exemptions: car.exemptions ?? [],
    }

    console.log(
      `${car.registration.padEnd(9)} ${car.make} ${car.model}` +
        `${car.year ? ` (${car.year})` : ''} → ${planned.length} zdarzeń: ` +
        planned.map((event) => event.type).join(', '),
    )

    if (DRY_RUN) {
      events += planned.length
      continue
    }

    // `registration` is unique, so this is the identity the sheet and the app share.
    const existing = await payload.find({
      collection: 'vehicles',
      where: { registration: { equals: car.registration } },
      limit: 1,
    })

    const vehicleId = existing.docs[0]
      ? (await payload.update({ collection: 'vehicles', id: existing.docs[0].id, data, ...ctx })).id
      : // `status` only on create — an update must not resurrect a car somebody has retired.
        (
          await payload.create({
            collection: 'vehicles',
            data: { ...data, status: 'ACTIVE' },
            ...ctx,
          })
        ).id

    if (existing.docs[0]) updated++
    else created++

    for (const event of planned) {
      // Re-runnable: an event of the same type on the same day is the one this script already wrote.
      const duplicate = await payload.find({
        collection: 'vehicle-inspections',
        where: {
          and: [
            { vehicle: { equals: vehicleId } },
            { type: { equals: event.type } },
            { performedAt: { equals: event.performedAt } },
          ],
        },
        limit: 1,
      })

      if (duplicate.docs.length > 0) {
        skipped++
        continue
      }

      await payload.create({
        collection: 'vehicle-inspections',
        data: {
          vehicle: vehicleId,
          type: event.type,
          performedAt: event.performedAt,
          nextDueAt: event.nextDueAt ?? null,
          odometer: event.odometer ?? null,
          insurer: event.insurer ?? null,
          policyNumber: event.policyNumber ?? null,
          note: event.note ?? null,
          cost: null,
        },
        ...ctx,
      })
      events++
    }
  }

  console.log(
    DRY_RUN
      ? `\nDRY RUN — ${CARS.length} pojazdów, ${events} zdarzeń, nic nie zapisano.`
      : `\n${CARS.length} pojazdów (${created} nowych, ${updated} zaktualizowanych), ` +
          `${events} zdarzeń utworzonych, ${skipped} pominiętych jako duplikaty.`,
  )
  process.exit(0)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
