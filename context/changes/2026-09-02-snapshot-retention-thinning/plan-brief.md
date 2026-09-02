# Snapshot retention thinning — Plan Brief

> Full plan: `context/changes/2026-09-02-snapshot-retention-thinning/plan.md`
> Research: `context/changes/2026-09-02-snapshot-retention-thinning/research.md`

## What & Why

Auto kosztorys snapshots die after 7 days and are capped at 50 per investment, so the practical
undo horizon is a few hours of heavy editing. Those numbers were placeholders — the S-06 plan brief
filed them under _"starting points — tune if the table grows"_ — and measurement kills the only
argument for keeping them: a snapshot is **~23 KB** stored, so today's entire ceiling is ~1,2 MB per
investment. Replace deletion with **thinning** and reach a year of history.

## Starting Point

Two independent bounds: an inline count cap on every auto insert (`pruneAutoCount`) and a daily
age GC in the cleanup cron (`gcSnapshots`). Manual snapshots already live 365 days — that horizon is
not new, it has just never been exercised, because nobody has restored a payload that old.

## Desired End State

An auto snapshot survives 30 days untouched, then one per calendar day to 120 days, then one per
calendar week to 365 — the same ceiling manual snapshots already have. A payload missing a field
restores on column defaults instead of erroring. The restore dialog states that the work scope comes
back while the discount, settlement mode and materials rate stay current.

## Key Decisions Made

| Decision                | Choice                                                                     | Why                                                                                                                            | Source     |
| ----------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Retention shape         | 30d full / 1 per day to 120d / 1 per week to 365d                          | Storage is not the constraint; only the list's legibility was, and the owner ruled that out                                    | Discussion |
| Count cap               | `AUTO_KEEP` and `pruneAutoCount` removed                                   | 30 days of full density replaces it; two bounds for one policy is one too many                                                 | Discussion |
| Bucket representative   | Newest of the day/week                                                     | The state you left the work in, not the one you started from                                                                   | Discussion |
| Bucket timezone         | `Europe/Warsaw`, in SQL                                                    | Editing after midnight would otherwise land in the previous UTC bucket; the sweep must decide without shipping rows to the app | Plan       |
| Sweep shape             | Three separate DELETEs, stateless                                          | Bands map 1:1 onto the tests; surviving rows per bucket _are_ the state, so a missed cron run is harmless                      | Plan       |
| Old-payload defaults    | fallbacks at the payload boundary (`insertKosztorysTree`), not at the bind | An explicit NULL does not take a column DEFAULT — this is the one real threat to a year of history                             | Plan       |
| Unreadable rows         | Bump rule, not a read-time filter                                          | A snapshot that cannot be restored has zero value — it should not exist rather than be filtered out of a list                  | Discussion |
| Restore-dialog sentence | Only the snapshot restore path                                             | The import path deliberately takes settings from the sheet, so the same sentence would be false there                          | Plan       |

## Scope

**In scope:** three-band thinning in `gcSnapshots`; removal of the count cap; `?? 0` on the seven
`NOT NULL DEFAULT` binds plus a guard on `settings`; the schema-version bump rule; one sentence in the
restore confirmation; a DB spec covering all three bands and idempotence.

**Out of scope:** drawer pagination/virtualization (owner ruled the list is not a concern); a
`schema_version` filter in `listSnapshots` (the bump rule makes it unnecessary); any backfill; the
capture interval and the undo-revision gate; presets, beyond naming them in the rule; `name` /
`ordinal`, which are NOT NULL without a DEFAULT and have no meaningful fallback.

## Architecture / Approach

`gcSnapshots` becomes the single retention authority and grows from one DELETE to three: the 365-day
ceiling for both kinds, then `row_number() OVER (PARTITION BY investment_id, date_trunc('day'|'week',
taken_at AT TIME ZONE 'Europe/Warsaw') ORDER BY taken_at DESC)` with everything but `rn = 1` deleted in
each band. The inline cap disappears from the capture path. This is the first date bucketing done in
SQL in this repo — everywhere else it is JS `Intl` (`src/lib/fleet/days.ts`) — and the query carries a
comment saying why.

## Phases at a Glance

| Phase                             | What it delivers                                          | Key risk                                                                                                                                                                                                          |
| --------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Thin instead of delete         | The three-band sweep; cap removed; full DB spec           | A dropped `investment_id` in the `PARTITION BY` wipes every investment's history but one, silently and irreversibly — hence a two-investment test case, an idempotence case, and a per-band count in the cron log |
| 2. Make an old payload restorable | `?? 0` binds, `settings` guard, regression spec           | Low; the literals duplicate the migration DEFAULTs and could drift                                                                                                                                                |
| 3. Say what the guarantees are    | Bump rule in code + `lessons.md`; restore-dialog sentence | Prose only                                                                                                                                                                                                        |

**Prerequisites:** local `db-test`/dev Postgres for the DB-backed specs. No migration, no prod gate.
**Estimated effort:** one session.

## Open Risks & Assumptions

- **Not retroactive.** No auto snapshot older than 7 days exists today, so the year of history starts
  accumulating at deploy, not at merge. A month from now you have a month. This doubles as the first
  safety check: a correct first sweep after deploy deletes nothing, so the cron's per-band counts must
  all read zero. **Today's snapshots and presets are test data the owner has ruled expendable**, so
  that check is a signal, not a save — no backfill and no pre-sweep dump is owed to the existing rows.
- Removing the count cap removes the only bound on row _count_ inside the 30-day window (~36/day on a
  heavily edited investment), and the versions drawer renders every row unvirtualized. Accepted.
- A year-old restore lands the old tree under today's settlement config and reprices. Correct by
  design; Phase 3 names it rather than changing it.
- The `?? 0` literals mirror the schema DEFAULTs by hand — a future change to a DEFAULT must touch both.

## Success Criteria (Summary)

- A snapshot from eleven months ago is present in the drawer and restores without an error.
- Yesterday's work is recoverable at 10-minute granularity; last quarter's at daily; last year's at
  weekly.
- Nobody has to think about the retention: no cap to hit, no cliff at day 7.
