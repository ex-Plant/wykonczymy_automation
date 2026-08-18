---
change_id: drop-hidden-in-export
title: Drop the dead hiddenInExport column
status: archived
created: 2026-08-18
updated: 2026-08-18
archived_at: 2026-08-18T09:19:31Z
branch: staging
worktree: null
---

## Notes

No Linear issue — closed inside one session. The delete plan it executes lived in **EX-549**
(Cancelled 2026-08-15, archived 2026-08-17), so the debt had no tracker left; that orphaning is what
surfaced it, while cutting roadmap **S-10 `kosztorys-column-rbac`**.

Deleted `kosztorys_items.hidden_in_export`, its Payload field, `KosztorysItemT.hiddenInExport`, its
`ItemPatchT` / `ITEM_FIELDS` / zod entries, the tree select + mapper, and every literal writer
(4 lib modules, 4 seed scripts, ~24 fixtures). Migration
`src/migrations/20260818_0_drop_kosztorys_hidden_in_export.ts`.

## Verdict: dead schema, not an unbuilt feature

Two independent lines, in case anyone re-proposes a per-row hide flag:

1. **The projection half was retired, not postponed.** `toClientView` / `ClientKosztorysViewT` were
   the flag's only reader; `kosztorys-client-view-reuse` deleted them when the owner reversed the
   leak posture (the client now gets the full tree, kept safe by the pinned client view + read-only
   render, not by projecting the payload). Inert from that commit onward.
2. **The requirement it served shipped as a rule instead.** Hiding rows from the client is EX-695's
   „ukryj puste pozycje" filter (przedmiar = 0 **and** Σ etapów = 0), stored per investment — not
   ticking rows one at a time. EX-549 was cancelled on exactly that ground.

The flag was **editable in the Payload panel the whole time** (a plain required checkbox), so an
owner could tick it and have it silently do nothing — the same trap `costVariant` had (EX-575).

## Two axes that look alike and are not

The S-10 discussion conflated them; they resolved separately and both are now closed:

| Axis   | Hide from               | Outcome                                                                                                               |
| ------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| role   | MANAGER                 | no source — P10 (`domain-notes:861`) asks about **columns** only; the row half was invented while writing the roadmap |
| client | the client's token link | EX-549 → EX-695 rule                                                                                                  |

## Why nothing in the persistence layer broke

`presets.ts:89` and `snapshots.ts:82` are bare `as SnapshotPayloadT` casts — no zod `.parse()`, no
`jsonb_populate_record` — and `insertItems` names every column explicitly rather than spreading the
item, so an old snapshot or preset still carrying `hiddenInExport` is silently ignored on restore.
No `SNAPSHOT_SCHEMA_VERSION` bump. **That tolerance is a property of how the mapper is written, not
a promise**: the same drop against a strict parse would have been breaking.

The compiler was the completeness proof, as with `costVariant` — `ITEM_FIELDS` is
`as const satisfies readonly (keyof ItemPatchT)[]`, so removing the key from `ItemPatchT` failed
`pnpm typecheck` (28 errors, all fixtures) until every carrier was gone.

## Two assertions deleted with intent

`append-preset-sections.test.ts` and `serialize-apply-preset.test.ts` each asserted
`hiddenInExport === false` inside a "job fields are zeroed on a preset" block. Only that line went;
the surrounding `plannedQty` / `discountType` / `discountValue` / `note` assertions carry the
block's intent, so the coverage is unchanged.

## Verification

`pnpm typecheck` clean · `pnpm test` 2445 passed / 130 skipped · `pnpm test:integration` 36 files,
127 passed (the two edited specs are DB-backed and run only here) · migration applied to the local
dev DB and to `db-test`. `pnpm lint`'s 2 errors are pre-existing in untouched files
(`hooks/use-latest-request.ts`, `test.js`).

**Owed at deploy time:** the prod migration, run by a human (`pnpm db:migrate:prod`) — **after the
code ships, not before.** AGENTS.md's "migrate prod before pushing" is the rule for an _additive_
migration, where new code needs a column that isn't there yet. A DROP inverts the dependency: it is
the _old_ code that needs the column. Migrate first and every request between the migration and the
deploy going live hits `selectKosztorysTreeData`'s SELECT still naming `hidden_in_export` → Postgres
42703 → every kosztorys tree read and every `insertItems` throws. The reverse window is harmless,
because the column is `NOT NULL DEFAULT false` and the new INSERT simply omits it.
