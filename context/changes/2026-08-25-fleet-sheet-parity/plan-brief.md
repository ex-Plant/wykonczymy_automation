# Fleet parity with the owner's vehicle-control sheet — Plan Brief

> Full plan: `context/changes/2026-08-25-fleet-sheet-parity/plan.md`

## What & Why

The owner runs the fleet from a spreadsheet. Five of its columns have no home in the app, so moving
off the sheet today would lose data — insurer, policy number, „bezterminowo", car-level Uwagi, the
current tyre set, and a plain mileage reading. This change adds them, then imports the nine cars.

## Starting Point

`vehicles` + `vehicle-inspections`, with every deadline figure derived rather than stored
(`src/lib/fleet/`). The app is already ahead of the sheet on costs, załączniki, historia,
przypomnienia and warranty/service — the gap is narrow and entirely on the data side.

## Desired End State

A vehicle carries its tyres, a remark, and the scheduled types that do not apply to it. An OC event
carries its insurer and policy number. A mileage reading needs no fake inspection. An unknown cost
reads „—", not `0 zł`. The nine cars are in prod, the przyczepa reads „bezterminowo", and the VW T4
shows its expired przegląd.

## Key Decisions Made

| Decision           | Choice                                 | Why                                                                                           |
| ------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| Insurer            | Free text                              | Five insurers, inconsistently spelled; an enum buys nothing and blocks the sixth              |
| Nr polisy          | **Text**, never number                 | `354E000003305` parses to `Infinity`; `22044 4672279` has a space                             |
| Insurer ↔ policy   | Independently optional                 | The przyczepa has a policy number and no insurer                                              |
| „bezterminowo"     | Per-type exemption flag on the vehicle | Precise, and it silences the weekly „never recorded" digest for that pair                     |
| Opony              | Free text                              | The owner writes prose („do wymiany na cały sezon.") — an enum discards the half that matters |
| Standalone mileage | New `ODOMETER` inspection type         | Keeps ONE mileage source; the existing derivations work untouched                             |
| Unknown cost       | `cost` becomes nullable                | The sheet has no costs; importing `0` would make the listing claim nine cars were free        |
| Import             | One-off script, deleted after          | No recurring sync wanted                                                                      |

## Scope

**In scope:** insurer + policy number on INSURANCE; per-type exemptions; vehicle `tyres` + `note`;
the ODOMETER type; nullable cost end to end; the one-off import of nine cars.

**Out of scope:** insurer/policy columns on the listing; an opony enum; polisa-renewal reminders;
any recurring sheet sync; backfilling costs; a new E2E spec.

## Architecture / Approach

Bottom-up, because every surface reads the same derived row: migration → `lib/fleet` (types,
exemptions, costs, dataset) → forms/actions → UI → import. Exemptions get their own jsonb column
rather than joining `flags`: a flag is a self-clearing mark, an exemption is a permanent property.

## Phases at a Glance

| Phase                 | What it delivers                                         | Key risk                                                                    |
| --------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1. Schema & migration | Columns, `ODOMETER` enum value, `cost` nullable          | Hand-written migration; enum value must not be used in the same transaction |
| 2. Domain layer       | Exemptions, null-safe costs, ODOMETER in the derivations | A missed sum coerces `null` to `0` and the lie returns                      |
| 3. Forms & actions    | Typing all of it in                                      | Conditional fields on two forms; `''` must map to `null`, not `0`           |
| 4. UI surfaces        | „bezterminowo", „—" costs, polisa on the vehicle page    | Presentational only                                                         |
| 5. Import             | Nine cars in prod                                        | `performedAt` for przegląd/OC is unknown and must be assumed                |

**Prerequisites:** local docker DB up; a human applies the migration to prod (`pnpm db:migrate:prod`)
before the import runs.
**Estimated effort:** ~1–2 sessions across 5 phases.

## Open Risks & Assumptions

- **`performedAt` is unknown for przegląd and OC.** The sheet stores only the expiry. „Current" is
  derived from `performedAt`, so the import assumes one year earlier and says so in each row's note.
  If the owner has the real dates, they beat the assumption.
- Making `cost` nullable partly reverses EX-729. The invariant it bought („`0 zł` means free")
  survives only if every sum skips `null` — that is what Phase 2's specs pin.
- The sheet keeps being edited by hand; the import is a snapshot of 2026-08-25, not a sync.

## Success Criteria (Summary)

- Every column of the owner's sheet has a home in the app, prose included
- The przyczepa stops being reported as a blind spot; its przegląd reads „bezterminowo"
- Nine cars visible in prod with the deadlines the sheet shows today
