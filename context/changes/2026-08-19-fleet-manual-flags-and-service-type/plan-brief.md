# Manual vehicle flags + SERVICE type — Plan Brief

> Full plan: `context/changes/2026-08-19-fleet-manual-flags-and-service-type/plan.md`

## What & Why

Every fleet alarm today is derived — the oil from kilometres and dates, everything else from a
`nextDueAt` somebody typed (and for tyres, from nothing at all: `TYRES` has no interval, so an
un-typed date means the tyres are watched by no rule). The owner needs to mark by hand that a car
needs its oil or tyres changed. Alongside it, a sixth inspection type: „Serwis", the ad-hoc repair,
distinct from the yearly przegląd okresowy (`TECHNICAL`) and from a warranty-period service
(`WARRANTY`).

## Starting Point

The fleet module stores no derived state on a vehicle — the current deadline for a (vehicle, type)
pair is always the newest event of that type. `INSPECTION_TYPES` is its spine, and six call sites read
it as "all types, each of which has a deadline". `vehicles` has no editable UI beyond creation.

## Desired End State

The vehicle page carries a „Do wymiany" control over all six types; a tick shows as a red per-type
badge in a new sortable „Do wymiany" column on /flota and on the vehicle page. The tick clears itself
once an inspection of that type is recorded on or after the day it was ticked, and can also be
unticked. „Serwis" is bookable, lands in the history and Koszty, and appears in no deadline column and
no email.

## Key Decisions Made

| Decision                  | Choice                                                                                                                 | Why                                                                                                                                   | Source |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Where flags live          | `vehicles.flags` as a `jsonb` map `type → day flagged`                                                                 | Single column, no child table (no array-field precedent in a hand-written migration here); `type: 'json'` is established in this repo | Plan   |
| Auto-clear rule           | Derived on read: cleared by an inspection of that type with `performedAt` ≥ the flag day                               | Works identically when the inspection is entered from the Payload admin, and backfilling old history can't silence a fresh mark       | Owner  |
| Manual untick             | Supported — unticking drops the entry                                                                                  | Owner                                                                                                                                 | Owner  |
| Which types are flaggable | All six                                                                                                                | Costs nothing extra                                                                                                                   | Owner  |
| Badge shape               | One badge per flagged type, inside the new column                                                                      | Owner picked per-type badges and a sortable column; putting the badges _in_ the column avoids saying it twice                         | Owner  |
| `SERVICE` and the digest  | Excluded from the Monday "missing inspections" section and from the sweep loop, via a new `SCHEDULED_INSPECTION_TYPES` | An ad-hoc service can never be "missing"; otherwise every car nags weekly forever                                                     | Owner  |
| Notifications for flags   | None — no email, no unread badge                                                                                       | Owner                                                                                                                                 | Owner  |
| Where flags are edited    | Vehicle detail page only                                                                                               | Owner                                                                                                                                 | Owner  |

## Scope

**In scope:** the `SERVICE` type end to end; the scheduled/all type split; `flags` column + migration;
pure flag rules with tests; `activeFlags` on the fleet row; a toggle action; the „Do wymiany" column,
the badge, and the vehicle-page editor.

**Out of scope:** flag history/audit; any email or unread-badge involvement; a deadline column or
interval for `SERVICE`; backfill of existing rows; inspection edit/delete UI.

## Architecture / Approach

`vehicles.flags` (jsonb) is the only new state, and it is _not_ the answer — `activeFlags(flags,
events)` is, computed in `toRow` next to every other derived figure, so the listing and the vehicle
page cannot disagree. That keeps the module's founding rule intact: recording the work retires the
alarm by itself, with no hook and no write-back. `INSPECTION_TYPES` grows to six;
`SCHEDULED_INSPECTION_TYPES` (the five with deadlines) is what the table columns, the sweep loop and
the missing-data report read.

## Phases at a Glance

| Phase         | What it delivers                                       | Key risk                                                                                        |
| ------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 1. Domain     | `SERVICE`, the scheduled/all split, `flags.ts` + specs | Missing a call site that meant "scheduled" — the plan enumerates all six                        |
| 2. Schema     | enum value + `flags` column, hand-written migration    | `ALTER TYPE ADD VALUE` inside Payload's transaction (safe: the value isn't used in the same tx) |
| 3. Read path  | `activeFlags` on `FleetRowT`                           | none material                                                                                   |
| 4. Write path | `setVehicleFlagsAction`                                | Re-ticking a cleared flag must re-stamp today, not the stale date                               |
| 5. UI         | „Do wymiany" column, badge, vehicle-page editor        | Badge wording per type („Olej", not „Wymiana oleju do wymiany")                                 |

**Prerequisites:** local docker Postgres on 5433 running.
**Estimated effort:** one session.

## Open Risks & Assumptions

- The prod migration is additive, so a human applies it **before** the code ships (`AGENTS.md`).
- Assumes flags never need to drive a notification later; if they do, the stored day is enough to
  build on without a schema change.

## Success Criteria (Summary)

- The owner can mark „opony do wymiany" on a car and sees it on the fleet listing without opening it.
- Recording the work makes the mark disappear on its own; recording old history does not.
- „Serwis" is bookable and costed, and adds no column and no weekly mail.
