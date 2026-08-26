# Fleet parity with the owner's vehicle-control sheet — Implementation Plan

## Overview

The owner keeps the fleet in a spreadsheet (`Kopia Kontrola_przegladow_i_ubezpieczen_samochodow.xlsm`).
Five of its columns have no home in the app, so moving off the sheet would lose data. This change adds
those five, then imports the nine cars.

## Current State Analysis

`vehicles` (registration, make, model, year, vin, flags, status) + `vehicle-inspections` (vehicle,
type, performedAt, nextDueAt, odometer, nextDueOdometer, cost, note, attachments). Everything the
sheet computes — dni do terminu, OK/DO 30 DNI/PO TERMINIE, km od wymiany oleju — is already derived
(`src/lib/fleet/deadlines.ts`, `thresholds.ts`, `rows.ts`) and the app goes further than the sheet on
costs, załączniki, historia, przypomnienia and warranty/service.

What has nowhere to go:

| Sheet                            | Gap                                              |
| -------------------------------- | ------------------------------------------------ |
| Ubezpieczyciel, Nr polisy        | no field anywhere                                |
| „bezterminowo" (Przyczepa Knaus) | no way to say a type does not apply              |
| Uwagi (car-level)                | `note` exists per-inspection only                |
| opony                            | TYRES is an event; nothing holds the current set |
| aktualny przebieg                | `latestOdometerReading` derives from events only |

Constraints found while reading the code:

- `cost` is `NOT NULL` since `20260824_1_require_inspection_cost` — deliberate (EX-729), so a `0`
  in the listing means „kosztowało zero". The sheet carries no costs at all, so importing `0` would
  make that column lie on nine cars at once.
- `findMissingInspections` (`src/lib/fleet/missing-data.ts`) reports every scheduled type with zero
  events on an ACTIVE vehicle, weekly. The przyczepa would be nagged about a przegląd it will never
  have.
- `latestByType` / `latestOdometerReading` (`deadlines.ts`) key everything off `performedAt`, so a
  new non-scheduled type joins the mileage derivation with no change to it.
- Migrations are hand-written here (AGENTS.md); `ALTER TYPE … ADD VALUE` is legal in the
  transactional runner as long as the value is not used in the same transaction —
  `20260819_1_add_service_type_and_vehicle_flags` is the precedent to copy.

## Desired End State

A vehicle carries its current tyres, a car-level remark, and the scheduled types that do not apply to
it. An INSURANCE inspection carries its insurer and policy number. A mileage reading can be recorded
without inventing an inspection. An unknown cost is „—", not `0 zł`. The nine cars from the sheet are
in prod with their przegląd, OC, oil history and the trailer's exemption.

### Key Discoveries

- `354E000003305` (uniqa) parses to `Infinity` as a number and `22044 4672279` contains a space —
  **nr polisy must be text**.
- The przyczepa has a policy number but **no insurer**, so the two fields must be independently
  optional.
- „opony" is prose in practice („do wymiany na cały sezon.", „całosezonowe ale do wymiany") — an enum
  would discard the half the owner cared about.
- „aktualny przebieg" is filled on exactly one car (`WF7972X` = 177 500).
- `vehicles.flags` is already a jsonb map type → day (`src/lib/fleet/flags.ts`). Exemptions are a
  different concept (a permanent property, not a self-clearing mark) and get their own column.

## What We're NOT Doing

- No insurer/policy columns on the fleet **listing** — they live on the vehicle page and in the
  INSURANCE history. The listing already carries five deadline columns plus costs.
- No enum for opony, no reminder for „polisa wygasa u tego ubezpieczyciela", no per-insurer reporting.
- No parsing of the sheet at runtime and no recurring sync — the import is one-off and the script is
  deleted afterwards.
- No backfill of costs for imported rows; unknown stays unknown.
- No E2E spec — the risk here is data-shape, and it is covered by unit specs. (Browser-level cover
  for the fleet forms is the existing E2E backlog's business, not this change's.)

## Implementation Approach

Bottom-up, because every surface reads the same derived row: migration → domain layer (`lib/fleet`)
→ forms/actions → UI → import. Each of the first four phases is independently shippable; the import
runs last, once a human has applied the migration to prod.

## Critical Implementation Details

**Migration ordering.** This is an **additive** migration (new columns, a new enum value, a dropped
NOT NULL), so per AGENTS.md the prod migration is applied **before** the code ships — and by a human
via `pnpm db:migrate:prod`, never by the agent. The `ADD VALUE 'ODOMETER'` must not be _used_ in the
same transaction; it isn't, the first such row comes from the import afterwards.

**`cost` nullability is a reversal of part of EX-729, not a mistake.** The invariant EX-729 bought —
„`0 zł` means it was free" — survives, because unknown now renders as „—" instead of collapsing into
`0`. Every consumer that sums costs (`sumCosts`, `summariseCosts`, the listing footer) must skip
`null` rather than coerce it, and the vehicle-costs table must not count an unknown-cost row into a
type's total while still counting it in that type's `count`.

## Phase 1: Schema and migration

### Overview

Add the columns and the enum value; make `cost` nullable.

### Changes Required:

#### 1. Vehicles collection

**File**: `src/collections/vehicles.ts`

**Intent**: Give a vehicle its current tyre set, a car-level remark, and the scheduled types that do
not apply to it.

**Contract**: `tyres` (text, optional, label „Opony"), `note` (textarea, optional, label „Uwagi"),
`exemptions` (json, `admin.hidden`, mirroring how `flags` is hidden — a hand-edited raw array only
corrupts it). `exemptions` holds an array of `ScheduledInspectionTypeT`.

#### 2. Vehicle-inspections collection

**File**: `src/collections/vehicle-inspections.ts`

**Intent**: Carry the polisa's insurer and number on the INSURANCE event, where they belong — both
change with each polisa, and the event is what keeps the history honest. Let a cost be unknown.

**Contract**: `insurer` (text, optional, `condition: (data) => data?.type === 'INSURANCE'`),
`policyNumber` (**text**, optional, same condition — never `number`), `cost` loses `required: true`
and keeps `min: 0`.

#### 3. Migration

**File**: `src/migrations/20260825_1_fleet_sheet_parity.ts` (+ registration in `src/migrations/index.ts`)

**Intent**: Apply the three schema deltas above to Postgres by hand, following
`20260819_1_add_service_type_and_vehicle_flags`.

**Contract**: `ALTER TYPE "enum_vehicle_inspections_type" ADD VALUE IF NOT EXISTS 'ODOMETER'`;
`vehicles` gains `tyres text`, `note text`, `exemptions jsonb`; `vehicle_inspections` gains
`insurer text`, `policy_number text` and does `ALTER COLUMN "cost" DROP NOT NULL`. `down` throws:
Postgres cannot remove the enum value, and restoring the NOT NULL means writing „0 zł" over every
unknown price — the lie this migration exists to remove. Roll back from the dump instead.

### Success Criteria:

#### Automated Verification:

- `pnpm generate:types` emits `tyres` / `note` / `exemptions` on `Vehicle` and `insurer` /
  `policyNumber` on `VehicleInspection`, with `cost: number | null`
- The migration applies against the local docker DB: `pnpm payload migrate`

#### Manual Verification:

- The Payload admin shows „Ubezpieczyciel"/„Nr polisy" only when Rodzaj = OC
- An inspection saves with the cost field left empty

---

## Phase 2: Domain layer

### Overview

Teach `lib/fleet` about the new type, the exemptions, and an unknown cost. This is where the specs live.

### Changes Required:

#### 1. The ODOMETER type

**File**: `src/lib/fleet/inspection-types.ts`

**Intent**: A plain meter reading — no deadline, no schedule, so it joins `INSPECTION_TYPES` without
joining `SCHEDULED_INSPECTION_TYPES`, exactly as SERVICE does.

**Contract**: `INSPECTION_TYPES = [...SCHEDULED_INSPECTION_TYPES, 'SERVICE', 'ODOMETER']`;
labels `{ en: 'Odometer reading', pl: 'Odczyt licznika' }`; `INSPECTION_INTERVAL_MONTHS.ODOMETER = null`.
Extend the existing doc comment — SERVICE is no longer the only odd one out.

#### 2. Exemptions

**File**: `src/lib/fleet/exemptions.ts` (new)

**Intent**: Parse the jsonb defensively (same reasoning as `parseVehicleFlags`: the column holds
whatever was last written, including `null` from every pre-existing vehicle) and answer „does this
type apply to this car".

**Contract**: `parseVehicleExemptions(raw: unknown): ScheduledInspectionTypeT[]` — unknown values
dropped, returned in `SCHEDULED_INSPECTION_TYPES` order; `isExempt(exemptions, type): boolean`.

#### 3. Silence the exempt type everywhere urgency is decided

**Files**: `src/lib/fleet/missing-data.ts`, `src/lib/fleet/rows.ts`

**Intent**: A type that does not apply is neither a blind spot nor a deadline. `findMissingInspections`
must skip it (or the weekly digest nags about the przyczepa's przegląd forever) and the row's deadline
for it must be distinguishable from „nothing recorded yet".

**Contract**: `findMissingInspections` filters exempt pairs out. `FleetDeadlineT` gains
`exempt: boolean`; `toRow` sets it from the vehicle. `hasEvent` keeps its current meaning — the two
flags are independent, and the renderer picks „bezterminowo" over „brak danych".

#### 4. Unknown costs

**Files**: `src/lib/fleet/costs.ts`, `src/lib/fleet/types.ts`, `src/lib/fleet/map-inspection.ts`,
`src/types/fleet.ts`

**Intent**: Carry `cost: number | null` end to end and make every sum skip the unknown ones rather
than treat them as free.

**Contract**: `InspectionRecordT.cost` and `InspectionHistoryEntryT.cost` become `number | null`;
`sumCosts` ignores `null` entries; `summariseCosts` keeps an unknown-cost row in its type's `count`
but out of its `total`. `FleetRowT.totalCosts` stays `number` (a sum of the known ones).

#### 5. Dataset mapping

**File**: `src/lib/fleet/dataset.ts`

**Intent**: Surface the new vehicle columns on `VehicleRecordT`.

**Contract**: `VehicleRecordT` gains `tyres: string`, `note: string`, `exemptions:
ScheduledInspectionTypeT[]`; `loadFleetDataset` maps them (`?? ''` / `parseVehicleExemptions`).

#### 6. Specs

**Files**: `src/__tests__/lib/fleet/exemptions.test.ts` (new), and additions to
`missing-data.test.ts`, `costs.test.ts`, `rows.test.ts`, `deadlines.test.ts`

**Intent**: Pin the four behaviours that would otherwise regress silently.

**Contract**: exemption parsing drops junk and keeps domain order; an exempt (vehicle, type) never
appears in `findMissingInspections`; `sumCosts` over a mix of `null` and numbers returns the sum of
the numbers, and an all-`null` set returns `0`; an ODOMETER event feeds `latestOdometerReading` and
`kmSinceOilChange` but produces no deadline and never reaches the digest.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/fleet/` passes, including the new exemptions spec

#### Manual Verification:

- None — this phase has no UI.

---

## Phase 3: Forms and actions

### Overview

Let a human type what the schema now holds.

### Changes Required:

#### 1. Vehicle form

**Files**: `src/components/forms/vehicle-form/vehicle-schema.ts`,
`src/components/forms/vehicle-form/vehicle-form.tsx`, `src/lib/actions/fleet.ts`

**Intent**: Add „Opony" (free text — the owner writes prose there and an enum would discard it),
„Uwagi" (textarea), and a „Nie dotyczy / bezterminowo" multi-select over the scheduled types.

**Contract**: form layer gains `tyres: string`, `note: string`, `exemptions: ScheduledInspectionTypeT[]`;
the domain layer mirrors it. The action writes all three; `exemptions` is stored as a plain array.

#### 2. Inspection form

**Files**: `src/components/forms/inspection-form/inspection-schema.ts`,
`src/components/forms/inspection-form/inspection-form.tsx`, `src/lib/actions/fleet.ts`

**Intent**: Insurer and policy number appear only for OC; cost stops being required; ODOMETER hides
the fields that make no sense for a reading.

**Contract**: `insurer: string` and `policyNumber: string` on both layers, conditional on
`type === 'INSURANCE'` and independently optional (the przyczepa has a policy with no insurer).
`cost` becomes optional on both layers — `''` maps to `null`, not `0`. For `type === 'ODOMETER'`
the form shows `performedAt`, `odometer`, `note`, attachments and nothing else; `nextDueAt` stays
empty so no deadline is ever born from a reading.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/actions/vehicle-update.test.ts src/__tests__/lib/actions/inspection-cost-required.test.ts`
  passes — the cost-required spec is rewritten to assert the new contract (empty cost persists as
  `null`, a typed `0` persists as `0`)

#### Manual Verification:

- Adding an OC shows Ubezpieczyciel + Nr polisy; switching Rodzaj to Przegląd hides them
- `354E000003305` and `22044 4672279` both save and read back unchanged
- Saving an inspection with the cost left empty succeeds
- „Odczyt licznika" asks only for date, przebieg, notatka
- Ticking „bezterminowo" for Przegląd techniczny on a vehicle persists across a reload

---

## Phase 4: UI surfaces

### Overview

Render the five new facts where the sheet renders them.

### Changes Required:

#### 1. Deadline cell

**File**: `src/components/fleet/deadline-cell.tsx`

**Intent**: An exempt type must read „bezterminowo", not „brak danych" — the whole point of the flag
is that the empty cell stops looking like a gap.

**Contract**: when `deadline.exempt`, render a muted „bezterminowo" chip and ignore `hasEvent` /
`bucket`.

#### 2. Fleet listing

**File**: `src/components/tables/fleet.tsx`, `src/components/fleet/fleet-data-table.tsx`

**Intent**: Unknown costs must not read as free, and the footer must not sum them in.

**Contract**: the costs cell renders „—" for a row whose events carry no known cost at all; the
footer keeps summing `totalCosts` (already null-free after Phase 2). Deadline columns sort exempt
rows with the same `sortUndefined: 'last'` treatment as unrecorded ones.

#### 3. Vehicle detail

**Files**: `src/app/(frontend)/flota/[id]/page.tsx`, `src/components/fleet/inspection-history.tsx`,
`src/components/fleet/vehicle-costs.tsx`

**Intent**: Show the car-level remark and its tyres; show the current polisa's insurer and number;
render an unknown cost as „—".

**Contract**: the `InfoList` gains „Opony" and „Uwagi" rows (both fall back to „—"), plus
„Ubezpieczenie" showing the newest INSURANCE event's `insurer` + `policyNumber`. The INSURANCE
history rows show both. Every cost cell in `inspection-history.tsx` and `vehicle-costs.tsx` renders
`null` as „—".

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/fleet/` still passes (the row/costs contracts these
  components read are pinned there; no component spec is added — this phase is presentational)

#### Manual Verification:

- The przyczepa's Przegląd column reads „bezterminowo" and it no longer appears in the weekly
  „nigdy nie zarejestrowano" digest section
- A car with only unknown-cost inspections shows „—" in Koszty, and Razem ignores it
- The vehicle page shows Opony, Uwagi and the current polisa

---

## Phase 5: Import the nine cars

### Overview

One-off, then deleted. The migration must already be on prod before this runs.

### Changes Required:

#### 1. Import script

**File**: `scripts/import-fleet-sheet.ts` (**deleted at the end of this phase**, per the decision to
keep no permanent sync surface)

**Intent**: Upsert the nine vehicles by registration and create their history, from data pasted into
the script — not fetched. The source is an uploaded `.xlsm`, so `scripts/inspect-sheet.mjs` cannot
read it and a live fetch would buy nothing for a one-off.

**Contract**: `DRY_RUN=1` prints what it would write and exits; matching is on `registration`
(`vehicles.registration` is unique); events created per car — TECHNICAL (`nextDueAt` = przegląd),
INSURANCE (`nextDueAt` = ubezpieczenie, + insurer/policyNumber), OIL_CHANGE (`performedAt` = data
ost. wymiany, `odometer` = przebieg przy wymianie), ODOMETER for `WF7972X` only (177 500). Every
event gets `cost: null`. `performedAt` for TECHNICAL/INSURANCE is unknown, so it is set to one year
before `nextDueAt` — the app derives „current" from `performedAt`, and a missing one would make the
row invisible to `latestByType`. Record that assumption in a note on each such row.

**Data**, verified against the raw XML (2026-08-25):

| Rej.     | Pojazd             | Przegląd     | Ubezpieczyciel | Nr polisy     | Ubezp. do  | Opony                       | Olej                |
| -------- | ------------------ | ------------ | -------------- | ------------- | ---------- | --------------------------- | ------------------- |
| WD3465W  | Volvo XC90         | 2027-05-15   | uniqa          | 354E000003305 | 2027-07-15 | całoroczne                  | 100000 / 2026-05-30 |
| WD4422W  | Cupra Formentor    | 2027-06-09   | pzu            | 1122301061    | 2027-06-09 | całoroczne                  | 60104 / 2026-08-19  |
| SI 71241 | VW Touran          | 2027-03-16   | ergo hestia    | 911053601167  | 2027-04-22 | letnie                      | 152970 / 2026-02-11 |
| WD4815W  | Ford FT Custom 340 | 2027-07-08   | link 4         | F34442402700  | 2027-07-07 | zima                        | 143633 / 2026-07-31 |
| WD3786V  | Ford Transit 2019  | 2027-08-20   | compensa       | 22044 4672279 | 2027-08-20 | do wymiany na cały sezon.   | 126289 / 2026-08-19 |
| WD2376W  | Ford Transit 2016  | 2027-04-07   | link 4         | F34258614300  | 2027-04-19 | całoroczne                  | 219800 / 2026-04-10 |
| WF7972X  | Chevrolet Cruze    | 2026-10-31   | ergo hestia    | 911054423436  | 2027-05-31 | —                           | 160000 / 2025-11-13 |
| WF 7029W | VW T4              | 2026-06-27   | —              | —             | 2027-03-29 | całosezonowe ale do wymiany | —                   |
| WD776AL  | Przyczepa Knaus    | bezterminowo | —              | 920065608303  | 2027-05-19 | —                           | —                   |

VINs: `YV1LFK2VCM1746096`, `VSSZZZKMZNR052045`, `WVGZZZ1TZHW024197`, `WF0YXXTTGYHA26283`,
`WF0RXXWPGRKU09131`, `WF0SXXWPGSFK06970`, `KL1JF3589DK022474`, `WV1ZZZ70Z3X109767`, (przyczepa: none).
`WD3786V` carries the Uwagi „może tarcze i klocki będą do wymiany, poduszka silnika do wymiany, nowe
opony". `WD776AL` gets `exemptions: ['TECHNICAL']` and no VIN.

#### 2. Run

**Intent**: Local dry run → local real run → **a human** runs it against prod.

**Contract**: the agent runs it against the local docker DB only. Prod is a human step, after
`pnpm db:migrate:prod`. The script is deleted once prod is populated.

### Success Criteria:

#### Automated Verification:

- Dry run against the local DB lists 9 vehicles and 20 events with no writes
- After the real local run, `pnpm exec vitest run src/__tests__/lib/fleet/` still passes

#### Manual Verification:

- `/flota` lists all nine cars with the przegląd and OC deadlines matching the table above
- The przyczepa reads „bezterminowo"; the VW T4's przegląd reads PO TERMINIE
- `WF7972X` shows 17 500 km since its oil change (177 500 − 160 000), i.e. the odometer alarm fires
- Prod shows the same nine cars after the human run

---

## Testing Strategy

### Unit Tests

- `exemptions.test.ts` — parsing drops junk/unknown types, keeps domain order, `null` → `[]`
- `missing-data.test.ts` — an exempt (vehicle, type) never surfaces as missing
- `costs.test.ts` — `sumCosts` skips `null`; `summariseCosts` counts an unknown-cost row but does not
  add it to the total
- `deadlines.test.ts` / `rows.test.ts` — an ODOMETER event feeds `latestOdometerReading` and
  `kmSinceOilChange`, produces no deadline, and `exempt` rides through `toRow`
- `inspection-cost-required.test.ts` — rewritten: empty cost persists `null`, typed `0` persists `0`

### Integration Tests

None new. The DB-backed action specs already cover the vehicle/inspection write paths; Phase 3
extends two of them rather than adding a suite.

### Manual Testing Steps

Collected into `context/foundation/manual-checks.md` at the final phase, from the per-phase
Manual Verification bullets above.

## Migration Notes

Additive migration → **prod first, then push** (AGENTS.md). `pnpm db:migrate:prod` is a human step.
Existing rows: `cost` keeps its values (only the constraint drops), `exemptions` / `tyres` / `note` /
`insurer` / `policyNumber` are `NULL` and every reader already treats a missing value as empty.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit suite passes: `pnpm test`
- Build succeeds: `pnpm build`

## References

- Change identity + sheet data quality: `context/changes/2026-08-25-fleet-sheet-parity/change.md`
- Migration precedent: `src/migrations/20260819_1_add_service_type_and_vehicle_flags.ts`
- Flag-parsing precedent for `exemptions`: `src/lib/fleet/flags.ts`
- Cost-required rationale being partly reversed: EX-729, `src/collections/vehicle-inspections.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schema and migration

#### Automated

- [x] 1.1 `pnpm generate:types` emits the new fields with `cost: number | null` — c487c4dc
- [x] 1.2 Migration applies against the local docker DB — c487c4dc

### Phase 2: Domain layer

#### Automated

- [x] 2.1 `pnpm exec vitest run src/__tests__/lib/fleet/` passes with the new exemptions spec — de620d85

### Phase 3: Forms and actions

#### Automated

- [x] 3.1 `vehicle-update.test.ts` + the rewritten `inspection-cost-required.test.ts` pass — 9288577b

### Phase 4: UI surfaces

#### Automated

- [x] 4.1 `pnpm exec vitest run src/__tests__/lib/fleet/` still passes — 9c5ce99f

### Phase 5: Import the nine cars

#### Automated

- [x] 5.1 Dry run lists 9 vehicles and 20 events with no writes — 713fd350 (real count 25; the plan's 20 was an arithmetic slip, see change.md)
- [x] 5.2 Fleet specs still pass after the real local run — 713fd350
