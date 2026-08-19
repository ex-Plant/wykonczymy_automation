# Manual vehicle flags + a standalone SERVICE inspection type — Implementation Plan

## Overview

Two related additions to the fleet module:

1. **Manual "needs doing" flags per vehicle.** Today every alarm is derived — the oil from km/date, the
   rest from a `nextDueAt` somebody typed. The owner needs to say by hand "this car needs its oil
   changed" / "this car needs new tyres", independently of what the history implies. Flags cover all
   inspection types, clear themselves when the work is recorded, and can also be unticked.
2. **A sixth inspection type `SERVICE`** — „Serwis", the ad-hoc repair. The owner's distinction:
   `TECHNICAL` is the yearly mandatory przegląd okresowy, `WARRANTY` is a service performed while the
   warranty still runs, `SERVICE` is a plain visit to the mechanic with no schedule behind it.

## Current State Analysis

- `INSPECTION_TYPES` (`src/lib/fleet/inspection-types.ts`) is the module's spine. **Six** call sites
  treat it as "all types, each of which has a deadline":
  - `src/components/tables/fleet.tsx:31` — one deadline column per type.
  - `src/lib/fleet/missing-data.ts:24` — the Monday "never recorded" digest section.
  - `src/lib/fleet/reminder-sweep.ts:80` — the per-type sweep loop.
  - `src/lib/fleet/deadlines.ts` (`byInspectionType`), `src/lib/fleet/costs.ts:38`,
    `src/components/fleet/inspection-history.tsx:112` — these three genuinely want _all_ types.
    Adding `SERVICE` naively gives a permanently empty seventh column and a weekly „brak serwisu" mail
    for every car, forever.
- A vehicle stores **no** derived state by design (`src/migrations/20260818_1_add_fleet.ts:3-6`):
  the current deadline is always the newest event of that type, so "already done" is free. The flag
  design below follows that rule rather than breaking it.
- `vehicles` has no editable UI beyond creation — `updateVehicleAction`
  (`src/lib/actions/fleet.ts:26`) exists but has no caller, and `AddVehicleDialog` is the only form.
  So the flag editor is a new control, not an extension of an existing one.
- `type: 'json'` → `jsonb` is established in this repo (`leads.ts`, `sheets.ts`,
  `kosztorys-client-view.ts`; migrations `20260814_0`, `20260815_0`). There is **no** Payload
  `array`/hasMany-select precedent in a hand-written migration — one more reason to store flags as a
  single `jsonb` column instead of a child table.
- The whole fleet is loaded in two reads (`src/lib/fleet/dataset.ts`), so nothing needs to query
  flags — reading them as an opaque blob costs nothing.

## Desired End State

- The vehicle page has a „Do wymiany" control listing all six inspection types; ticking one marks the
  car and the mark shows up as a red badge on the fleet listing in a new sortable „Do wymiany" column
  and on the vehicle page itself.
- A tick clears itself once an inspection of that type is recorded **with a `performedAt` on or after
  the day it was ticked** — so backfilling old history never silences a fresh mark. It can also be
  unticked by hand.
- „Serwis" is selectable in the inspection form, lands in the history and the Koszty tab, is
  flaggable — and appears in **no** deadline column and in **no** digest section.
- No email, no unread badge, no change to the reminder cron's behaviour for the existing five types.

### Key Discoveries

- `classifyDeadline` returns `null` for a missing `nextDueAt` (`src/lib/fleet/thresholds.ts:26`), so a
  `SERVICE` row can never fire the sweep even if the loop reached it — but the loop is narrowed
  anyway, so the exclusion is stated once rather than relied on as an accident.
- `INSPECTION_INTERVAL_MONTHS.TYRES` is already `null` with a comment explaining that `null` is a
  documented member of the type (`inspection-types.ts:22-31`) — `SERVICE: null` slots straight in.
- `resetNotificationBookkeeping` (`src/collections/vehicle-inspections.ts:20`) runs on update only;
  flags are on `vehicles`, so nothing there is touched.
- Payload runs each migration in a transaction. `ALTER TYPE … ADD VALUE` is legal there on PG12+ as
  long as the new value is not _used_ in the same transaction — this migration only adds the value and
  a column, so it is safe.

## What We're NOT Doing

- No email/digest involvement for flags, and no unread-badge contribution (owner, explicit).
- No deadline column, interval, or `nextDueAt` prefill for `SERVICE`.
- No flag history/audit (who ticked it, when it cleared) — the current mark is the whole state.
- No backfill: no existing vehicle gets a flag, no existing inspection is reclassified as `SERVICE`.
- No edit/delete UI for inspections (still absent today; out of scope).
- No change to `OilIntervalBadge` — the automatic km-overrun badge stays next to the registration and
  keeps its own meaning ("the car has driven past its interval"), separate from a manual mark.

## Implementation Approach

**Flags are derived, not stored as booleans.** `vehicles.flags` is a `jsonb` map of
`inspection type → the day it was flagged`; whether a flag is _active_ is computed from that map plus
the vehicle's events, exactly the way deadlines already are. Two consequences worth the extra column:
recording an inspection from the Payload admin clears the flag just as the app does (no hook, no
action side-effect to keep in sync), and a backdated entry cannot silence a mark that came after it.

**`SERVICE` is added to `INSPECTION_TYPES`, and a narrower `SCHEDULED_INSPECTION_TYPES` is
introduced** for the three places that mean "types that carry a deadline". `INSPECTION_TYPES` stays
the list for history, costs, and flags.

## Critical Implementation Details

**Re-ticking an already-cleared flag.** The stored map keeps a type's entry after the flag has been
cleared by an inspection (the entry is simply no longer active). If the toggle action naively "keeps
the existing date", re-ticking such a type would write back a stale date and the flag would read as
cleared the moment it is set — a tick that does nothing. The action therefore resolves the _active_
set first and stamps today's date for every type that is being newly activated, keeping the stored
date only for types that are active already. It also prunes entries that are no longer active.

---

## Phase 1: Domain — the SERVICE type, the scheduled/all split, and the flag rules

### Overview

All the pure logic, with unit tests, before anything touches the DB or the UI.

### Changes Required:

#### 1. The sixth type and the narrower list

**File**: `src/lib/fleet/inspection-types.ts`

**Intent**: Add `SERVICE` („Serwis") as an ad-hoc type with no interval, and expose the subset of types
that actually carry a deadline so the table, the sweep and the missing-data report can stop meaning
"all types" when they mean "types with a due date".

**Contract**: `SCHEDULED_INSPECTION_TYPES` (the five existing types, in today's order) becomes the
source `INSPECTION_TYPES` is built from — `INSPECTION_TYPES = [...SCHEDULED_INSPECTION_TYPES,
'SERVICE']` — so the two lists cannot drift. `INSPECTION_TYPE_LABELS.SERVICE = { en: 'Service',
pl: 'Serwis' }`, `INSPECTION_INTERVAL_MONTHS.SERVICE = null` (same documented meaning as `TYRES`).

#### 2. Flag rules

**File**: `src/lib/fleet/flags.ts` (new)

**Intent**: The whole flag semantics as pure functions: parse the untyped `jsonb`, decide which flags
are currently active given the vehicle's events, and compute the next stored map for a toggle.

**Contract**:

```ts
export type VehicleFlagsT = Partial<Record<InspectionTypeT, DayT>>   // type → the day it was flagged

export const parseVehicleFlags = (raw: unknown): VehicleFlagsT      // drops unknown keys / bad days
export const activeFlags = (flags: VehicleFlagsT, events: readonly InspectionEventT[]): InspectionTypeT[]
export const nextFlags = (args: {
  current: VehicleFlagsT
  active: readonly InspectionTypeT[]      // what is active right now
  selected: readonly InspectionTypeT[]    // what the user just ticked
  today: DayT
}): VehicleFlagsT
```

A flag is **active** when its day is set and no event of that type has `performedAt` (as a Warsaw day)
on or after it. `activeFlags` returns them in `INSPECTION_TYPES` order, not object order.
`nextFlags` keeps the stored day for a type that is already active and re-stamps `today` for one
being newly ticked; anything not selected is dropped from the map.

#### 3. Narrow the two "all types" consumers that meant "scheduled"

**File**: `src/lib/fleet/missing-data.ts`, `src/lib/fleet/reminder-sweep.ts`

**Intent**: Keep the weekly "never recorded" report and the sweep loop over the five scheduled types
only. An ad-hoc service can never be "missing", and it has no date to count down to.

**Contract**: both swap `INSPECTION_TYPES` for `SCHEDULED_INSPECTION_TYPES`. No other behaviour change.

#### 4. Tests

**File**: `src/__tests__/lib/fleet/flags.test.ts` (new), plus additions to
`src/__tests__/lib/fleet/missing-data.test.ts`

**Intent**: Pin the flag rules and the SERVICE exclusion.

**Contract**: cases — flag with no matching event stays active; an event on the same day clears it; an
event **before** the flag day does not; an event of a different type does not; `parseVehicleFlags`
survives `null`/garbage/unknown keys; `nextFlags` re-stamps a re-ticked cleared type and prunes
deselected ones; `findMissingInspections` never returns `SERVICE`, for a vehicle with no events at all.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/fleet/flags.test.ts` passes
- `pnpm exec vitest run src/__tests__/lib/fleet/missing-data.test.ts` passes
- `pnpm exec vitest run src/__tests__/lib/fleet` passes (reminder-sweep + thresholds unaffected)

#### Manual Verification:

- none for this phase (pure logic, covered by the specs above)

---

## Phase 2: Schema — the enum value, the flags column, the migration

### Overview

Make the DB accept both additions. Additive only, so per `AGENTS.md` the prod migration is applied by
a human **before** the code ships.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/20260819_0_add_service_type_and_vehicle_flags.ts` (new)

**Intent**: Add `SERVICE` to the inspection-type enum and a `flags` blob to `vehicles`. Hand-written
per `AGENTS.md`; mirror the structure of `20260818_1_add_fleet.ts`.

**Contract**:

```sql
ALTER TYPE "enum_vehicle_inspections_type" ADD VALUE IF NOT EXISTS 'SERVICE';
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "flags" jsonb;
```

`down()` drops the column only — a Postgres enum value cannot be removed, so `down` says so in a
comment rather than pretending. Adding the value and not using it in the same transaction keeps this
legal inside Payload's transactional migration runner.

#### 2. Collection field

**File**: `src/collections/vehicles.ts`

**Intent**: Expose `flags` so Payload reads/writes the column; it is machine-shaped, not something to
hand-edit in the admin panel.

**Contract**: `{ name: 'flags', type: 'json', admin: { hidden: true } }`. The `vehicle-inspections`
`type` select picks `SERVICE` up automatically from `INSPECTION_TYPES`.

### Success Criteria:

#### Automated Verification:

- `pnpm generate:types` succeeds and `src/payload-types.ts` carries `'SERVICE'` in the inspection type
  union and `flags` on `Vehicle`
- migration applies against the local DB: `pnpm payload migrate` (docker Postgres on 5433)

#### Manual Verification:

- „Serwis" is selectable as a Rodzaj in the Payload admin for a vehicle inspection

---

## Phase 3: Read path — carry the active flags onto the row

### Overview

Resolve flags where every other derived figure is resolved, so both the listing and the vehicle page
read the same answer.

### Changes Required:

#### 1. Dataset

**File**: `src/lib/fleet/dataset.ts`, `src/lib/fleet/types.ts`

**Intent**: Load the raw `flags` blob with the vehicle and hand it on as a parsed map.

**Contract**: `VehicleRecordT` gains `flags: VehicleFlagsT`, filled via `parseVehicleFlags(vehicle.flags)`.
`VehicleSummaryT` is left alone — the sweep has no use for flags.

#### 2. Row shape

**File**: `src/lib/queries/fleet.ts`, `src/types/fleet.ts`

**Intent**: Add the resolved list of currently-active flags to the row both surfaces already read.

**Contract**: `FleetRowT` gains `activeFlags: InspectionTypeT[]`, computed in `toRow` via
`activeFlags(vehicle.flags, events)`. `toRow` already receives both inputs, so nothing new is loaded.

#### 3. Test

**File**: `src/__tests__/lib/queries/fleet.test.ts`

**Intent**: Pin that a row's flags reflect the events, not just the stored map.

**Contract**: a vehicle with a flag and a later inspection of that type comes back with an empty
`activeFlags`; one with only an earlier inspection keeps it.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/queries/fleet.test.ts` passes

#### Manual Verification:

- none (covered above; the UI is verified in Phase 5)

---

## Phase 4: Write path — the toggle action

### Overview

One mutation, following the module's existing `protectedAction` shape.

### Changes Required:

#### 1. Action

**File**: `src/lib/actions/fleet.ts`

**Intent**: Persist the ticked set for one vehicle, stamping today for newly-ticked types and pruning
the rest.

**Contract**: `setVehicleFlagsAction(vehicleId: number, types: InspectionTypeT[])`. Validates with a
zod schema (`z.array(z.enum(INSPECTION_TYPES))`), loads the vehicle's inspections to resolve the
currently-active set, computes `nextFlags({ current, active, selected, today: warsawToday() })`, and
`payload.update`s `vehicles`. Revalidates `['vehicles']` like its siblings.

**Note**: the auto-clear needs no write at all — it falls out of `activeFlags` on read, so
`createInspectionAction` is untouched.

#### 2. Test

**File**: `src/__tests__/lib/actions/` — follow whatever the neighbouring fleet action specs do

**Intent**: Guard the re-tick case named in Critical Implementation Details.

**Contract**: ticking a type whose stored flag was already cleared by an inspection persists **today's**
date, not the stale one, and the flag reads active afterwards.

### Success Criteria:

#### Automated Verification:

- the new action spec passes via `pnpm exec vitest run <path>`

#### Manual Verification:

- none (UI wiring is Phase 5)

---

## Phase 5: UI — the „Do wymiany" column, the badge, the editor

### Overview

Everything the owner actually sees.

### Changes Required:

#### 1. Badge

**File**: `src/components/fleet/flag-badge.tsx` (new)

**Intent**: One red badge per flagged type, reading „<Typ> do wymiany" — the same visual weight as the
existing `OilIntervalBadge`, so a manual mark and an automatic overrun read as one family.

**Contract**: takes `type: InspectionTypeT`; reuses `BADGE_BASE` + `bg-destructive/10 text-destructive`
from `OilIntervalBadge`. Label text comes from `INSPECTION_TYPE_LABELS[type].pl` — „Wymiana oleju do
wymiany" is nonsense, so the badge prints a short per-type noun instead: a small
`FLAG_BADGE_LABELS: Record<InspectionTypeT, string>` living next to the component („Olej", „Opony",
„Przegląd", „OC", „Gwarancja", „Serwis") under a shared „do wymiany/do zrobienia" framing.

#### 2. Listing column

**File**: `src/components/tables/fleet.tsx`

**Intent**: A new „Do wymiany" column rendering the badges, sortable by how many flags a car carries,
placed after „Pojazd" and before the deadline columns. The deadline columns come from
`SCHEDULED_INSPECTION_TYPES` so `SERVICE` never gets one.

**Contract**: `col.accessor((row) => row.activeFlags.length, { id: 'flags', header: 'Do wymiany', … })`,
cell renders one `FlagBadge` per entry in `row.activeFlags`; a car with none renders nothing (not a
dash — the column is an alarm surface, and a column of dashes reads as noise).

#### 3. Vehicle page — show and edit

**File**: `src/app/(frontend)/flota/[id]/page.tsx`, `src/components/fleet/vehicle-flags.tsx` (new)

**Intent**: Show the active flags on the vehicle page and let the user tick/untick them there — the
only place flags are editable.

**Contract**: a client component taking `vehicleId` and `active: InspectionTypeT[]`, rendering a
checkbox per `INSPECTION_TYPES` entry (all six, labelled with `INSPECTION_TYPE_LABELS[type].pl`) and
calling `setVehicleFlagsAction` on change, with `router.refresh()` on success per the repo's optimistic
submit convention. Placed in the header block beside the existing `InfoList` / „Od wymiany oleju" row.

#### 4. History and costs pick SERVICE up for free

**File**: none — `inspection-history.tsx` and `costs.ts` already iterate `INSPECTION_TYPES`.

**Intent**: Verify rather than change: „Serwis" must appear as its own history section and its own
cost bucket without an edit.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/fleet src/__tests__/lib/queries/fleet.test.ts` passes

#### Manual Verification:

- On a vehicle page, ticking „Wymiana opon" makes a red „Opony" badge appear there and in the „Do
  wymiany" column on /flota
- Recording a „Wymiana opon" inspection dated today makes that badge disappear from both places
- Recording one dated a year ago leaves the badge in place
- Unticking the box on the vehicle page removes the badge
- Sorting the „Do wymiany" column brings flagged vehicles together
- „Serwis" is selectable in „Dodaj przegląd", does not prefill a next date, and shows no
  „Następna wymiana przy (km)" field
- A recorded „Serwis" shows in the vehicle's Przeglądy history and in the Koszty tab
- /flota has **no** „Serwis" deadline column

---

## Testing Strategy

### Unit Tests

- `flags.ts` — the active/cleared boundary (same day, day before, different type), `parseVehicleFlags`
  against garbage, `nextFlags` re-tick and prune.
- `missing-data.ts` — `SERVICE` never reported missing.

### Integration Tests

- `src/__tests__/lib/queries/fleet.test.ts` — flags resolved against real rows through the loader.
- the new action spec — the re-tick case, asserting the **persisted** map, not the action's result.

### Manual Testing Steps

Collected in Phase 5's Manual Verification; `/10x-implement` writes them into
`context/foundation/manual-checks.md` at the final phase.

## Performance Considerations

None. Flags ride along on the two reads `loadFleetDataset` already does, and `activeFlags` is a scan
over one vehicle's handful of events.

## Migration Notes

Additive migration → per `AGENTS.md`, **a human applies it to prod before the code is pushed**
(`pnpm db:migrate:prod`). Existing vehicles read `flags` as `NULL`, which `parseVehicleFlags` maps to
`{}` — no backfill. The enum value cannot be dropped by `down()`; the column can.

## Whole-tree Gate

Run once, after Phase 5:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## References

- Change identity: `context/changes/2026-08-19-fleet-manual-flags-and-service-type/change.md`
- Fleet module origin: `src/migrations/20260818_1_add_fleet.ts`, `context/changes/2026-08-18-flota-przeglady/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Domain — the SERVICE type, the scheduled/all split, and the flag rules

#### Automated

- [x] 1.1 `flags.test.ts` passes — c584a523
- [x] 1.2 `missing-data.test.ts` passes — c584a523
- [x] 1.3 `src/__tests__/lib/fleet` suite passes — c584a523

### Phase 2: Schema — the enum value, the flags column, the migration

#### Automated

- [x] 2.1 `pnpm generate:types` emits `'SERVICE'` and `flags` — 18cbb8bd
- [x] 2.2 migration applies against the local DB — 18cbb8bd

### Phase 3: Read path — carry the active flags onto the row

#### Automated

- [x] 3.1 `src/__tests__/lib/queries/fleet.test.ts` passes — dc791b3a

### Phase 4: Write path — the toggle action

#### Automated

- [x] 4.1 the `setVehicleFlagsAction` spec passes — ea75fc32

### Phase 5: UI — the „Do wymiany" column, the badge, the editor

#### Automated

- [x] 5.1 `src/__tests__/lib/fleet` + `queries/fleet.test.ts` pass after the UI wiring
