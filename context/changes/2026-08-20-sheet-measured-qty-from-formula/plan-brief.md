# „Pomiar z natury" z formuły — Plan Brief

> Full plan: `context/changes/2026-08-20-sheet-measured-qty-from-formula/plan.md`
> Research: `context/changes/2026-08-20-sheet-measured-qty-from-formula/research.md`

## What & Why

The import throws away the sheet's „Pomiar z natury" whenever the cell holds a formula. On the live
sheets that is almost every row — the owner writes the pomiar as a reference to Przedmiar, not as a
typed number — so the reconciliation that is supposed to catch „the sheet says this work is done,
the etapy say nothing" is blind on ~750 prace across ~20 investments. Narrow the rule to the one
shape it was actually argued for: a formula that computes the pomiar FROM the etapy.

## Starting Point

`readMeasuredQty` returns `null` on any `=`. The formula grid it reads is already fetched and
aligned; the stage columns it needs are already resolved. The blind spot was found two days after
the rule shipped, written down in `formula-anomalies.md` as „strukturalnie ślepa", traced to a
16 677 zł dogfooding gap — and accepted rather than fixed.

## Desired End State

A pomiar computed from the etapy still counts as no claim. Everything else — typed, `=N72`, `=2,5+3`
— becomes the reference figure, so „Problemy" and the „Rozjazd" column show the prace nobody has
transcribed into etapy yet.

## Key Decisions Made

| Decision                        | Choice                                                            | Why                                                                                                           | Source           |
| ------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------- |
| What counts as "no measurement" | A formula referencing a stage-quantity column, any shape, any row | The tautology is the only thing ever argued for; `=N72` against Σ etapów is a real comparison                 | Research         |
| Predicate strength              | "mentions a stage column anywhere", not own-row                   | An existing fixture writes one row's formula into every row; an own-row rule breaks it                        | Research         |
| Predicate home                  | Lift the existing matcher out of the rates resolver               | Two near-copies of one regex contract is the thing to avoid                                                   | Plan             |
| Whole-column ranges (`D:M`)     | Must match                                                        | The lifted matcher requires a digit after the letter, so the exact shape the comment names would slip through | Research         |
| Backfill                        | None — per investment, through the existing compare window        | Nothing changes without the owner seeing the report first                                                     | Owner            |
| Row conditions                  | One, as today                                                     | 480 wholly-untranscribed rows stay under the same list                                                        | Owner            |
| Pomiar = 0 vs non-zero etapy    | Still a rozjazd                                                   | A real contradiction, 3 rows base-wide                                                                        | Owner            |
| Old specs                       | Rewritten red-first, not supplemented                             | A test guarding the old definition goes tautological                                                          | `lessons.md:350` |

## Scope

**In scope:** the predicate module, the narrowed read rule, three specs, the stale comments, and the
written record of the reversal.

**Out of scope:** any backfill; `measureDiscrepancy`, the column, the sort, the client view;
`formula-health.ts`; the dead `referenceQty`; the 23 sheets that fail to resolve (owner handles
those in the sheet and with the column picker).

## Architecture / Approach

One predicate — "does this formula reach into the etapy columns" — built from the resolved stage run
rather than a literal range, extracted from where it already lives in the rates resolver and applied
at the one place the parser reads the Pomiar cell. Nothing downstream changes: the stored figure has
exactly one logic reader, and it feeds no money.

## Phases at a Glance

| Phase           | What it delivers                                           | Key risk                                             |
| --------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| 1. Predicate    | Shared stage-reference matcher, whole-column form included | A too-loose regex silently refuses a real pomiar     |
| 2. Rule + specs | The narrowed read, three specs rewritten red-first         | The DB-backed spec leaves state two later tests read |
| 3. Record       | Comments and docs stop stating the old rule as fact        | —                                                    |

**Prerequisites:** none — local dev DB and a linked sheet for the manual pass.
**Estimated effort:** one session.

## Open Risks & Assumptions

- A formula mixing both planes (`=N5-D5`) would be refused. Not observed in the scan; accepted.
- `conditionCounts` walks every row per condition on every edit and stops short-circuiting on the
  newly-valued rows — worst case ~150 of ~450 rows. Measured only if editing feels heavier.
- Seven sheets hit the Google daily read quota mid-scan, so the ~750 figure is a floor, not a total.

## Success Criteria (Summary)

- „Porównaj z arkuszem…" surfaces prace the sheet claims as done while their etapy are empty.
- An investment whose sheet is the blank offer still reports nothing.
- The investor preview is unchanged — no „Rozjazd", no problems menu.
