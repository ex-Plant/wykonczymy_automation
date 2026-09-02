---
date: 2026-09-02T09:16:28Z
researcher: Claude Opus 5
git_commit: 45f7c9ffc38a63632bed18ebe35f0213bc81833e
branch: staging
repository: wykonczymy
topic: 'Snapshot retention: thinning by age instead of deleting, and what makes a year-old snapshot un-restorable'
tags: [research, kosztorys, snapshots, retention, cron, gc, schema-version]
status: complete
last_updated: 2026-09-02
last_updated_by: Claude Opus 5
---

# Research: Snapshot retention thinning (30d full / 1-per-day to 120d / 1-per-week to 365d)

## Research Question

Can auto snapshots be kept for 365 days by thinning instead of deleting, and is that year-long
history real — i.e. would a year-old payload actually restore?

## Summary

Three answers, in order of how much they should shape the plan.

1. **The retention numbers were never derived — they were placeholders.** The S-06 plan brief says so
   in as many words: _"10-min throttle / 7-day auto retention are starting points — tune if the table
   grows."_ There is no storage measurement, no Neon-limit argument, and no owner decision anywhere in
   `context/` defending 7 days. Changing them contradicts nothing.
2. **365-day retention is not a new regime — it already exists.** `MANUAL_MAX_AGE_DAYS = 365` shipped
   with S-06. Manual snapshots have been allowed to live a year since 2026-07-10; what has never
   happened is anyone _restoring_ one that old. This change extends an existing horizon to a second
   `kind`, it does not invent one.
3. **The schema-version gate is not what protects a year-old snapshot, and it never fired.**
   `SNAPSHOT_SCHEMA_VERSION` is still `1` after five column drops in eight weeks. The real
   un-restorability hazard is different and is documented below: a **future NOT NULL column added to a
   tree table**, which the version rule does not classify as "non-additive" and which the insert path
   would bind as `NULL` on every older payload.

The thinning itself is a rewrite of `gcSnapshots` plus the deletion of `pruneAutoCount`/`AUTO_KEEP`.
No migration, no schema change, no UI change required.

## Detailed Findings

### The mechanism today

- `src/lib/db/snapshots.ts:17-20` — `AUTO_KEEP = 50`, `AUTO_MAX_AGE_DAYS = 7`, `MANUAL_MAX_AGE_DAYS = 365`.
  All module-private, no env/config.
- Two independent bounds: `pruneAutoCount` (`:55`) runs inline on **every** auto insert
  (`src/lib/kosztorys/capture-auto-snapshot.ts:16`); `gcSnapshots` (`:108`) is the global age sweep in
  the daily cron (`src/app/(payload)/api/cron/cleanup/route.ts:19`, `vercel.json` `0 3 * * *`).
- Auto snapshots come from two places: the 10-minute editor interval gated on the undo-stack revision
  (`src/components/kosztorys/editor/hooks/use-auto-snapshot.ts:9,33-40`) and **forced** captures before
  destructive actions in `src/lib/actions/kosztorys.ts:260,289,367,534,712` and before a restore
  (`src/lib/actions/kosztorys-snapshots.ts:82`).
- Indexes already fit a bucketing sweep: `kosztorys_snapshots_investment_kind_taken_at_idx`
  (`src/migrations/20260710_1_add_kosztorys_snapshots.ts:26-28`).

### Measured storage (the premise of the change)

Local DB (restored prod dump + seeds), `pg_column_size(payload)` = real stored bytes after TOAST:

| kosztorys              | JSON text | stored     |
| ---------------------- | --------- | ---------- |
| ~380 items (realistic) | ~140 KB   | **~23 KB** |
| 1000 items (perf seed) | ~416 KB   | **~31 KB** |

jsonb compresses ~6× because the tree is repeated keys. Today's entire ceiling (50 × 23 KB) is
**~1,2 MB per investment**; 50 investments at the cap is ~57 MB. Storage does not defend the current
retention.

### Why 50 / 7 / 365 exist

`context/archive/2026-07-10-kosztorys-snapshots/change.md` is the canonical record:

> **Retention:** `manual` aged out after ~1 year · `auto` newest **50** per investment (inline count
> cap) **and** GC-dropped when older than **7 days**.

The rationale table in the plan brief (git-only now, `git show 965ee304:context/changes/kosztorys-snapshots/plan-brief.md`)
gives "bounded active + durable 'noticed later' window" and — decisively — lists the numbers under
_"Open questions / tuning"_. `context/foundation/roadmap.md:352` had guessed N ≈ 20 before plan time
settled on 50. The design-time cost worry on record was **CPU** (serialising a 1000-row tree inline on
every cascade delete), never bytes.

### What can kill a year-old restore — ranked

Capture is `src/lib/kosztorys/serialize-kosztorys.ts:9-30`; write-back is
`src/lib/kosztorys/restore-kosztorys.ts:14-58` (wipe sections+stages, `insertKosztorysTree`, then
`payload.update` for the three settings).

1. **A future NOT NULL column on a tree table — the actual hazard.** `insert-rows.ts:96,123` and
   `insert-kosztorys-tree.ts:93,117` name every NOT NULL DEFAULT column explicitly and bind it raw
   with no `??` (`planned_qty`, `discount_value`, `client_price`, the two override values, `name`,
   `display_order`, `ordinal`, `qty_done`). A key missing from an old payload binds `NULL`, and an
   explicit NULL **does not take the column DEFAULT** → `23502`, surfaced as the generic Polish
   "nic nie zostało zapisane" (`replace-tree-with-snapshot.ts:36-37`). Since 2026-07-10 **not one
   NOT NULL column has been added** to the four tree tables — all four additions were nullable. So
   year-old payloads restore today **by discipline, not by design**, and the version gate would not
   catch the violation because "additive NOT NULL" is not "non-additive" under
   `snapshot-format.ts:8-14`.
2. **Enum value removal on `stages.plane`.** A real pg enum (`20260724_2`), inserted raw
   (`insert-kosztorys-tree.ts:93`). Removing a value would throw 22P02 on every payload holding it.
   Dormant — two values, never changed.
3. **Semantic drift, not failure.** `globalDiscount` is deliberately excluded
   (`snapshot-format.ts:32-34`), and so are `settlementMode`, `materialsNetRate` and the linked sheet.
   A year-old tree therefore restores **under today's settlement config and reprices**. Over a 7-day
   window that is invisible; over 365 days it is the thing most likely to surprise the owner.
   `settings` is also dereferenced unguarded (`restore-kosztorys.ts:48-50`) and `vat_rate` is NOT NULL.
4. **Worker attribution loss — already solved.** `stages[].workerId` → `users.id` is the only
   outside-pointing reference. Post-EX-641, `insert-kosztorys-tree.ts:30-45,81-93` filters to live ids
   with `SELECT … FOR SHARE`, nulls the dangling ones and reports `droppedWorkerAssignments`
   (`kosztorys-snapshots.ts:52,86-89`). No throw. Section `color` is a free varchar (degrades to
   `undefined` at render); the work catalogue is not referenced at all.

### The schema-version gate, empirically

Nine migrations touched tree tables since the snapshot table was created. Five were column **drops**
(`measured_qty`, section coeffs, `cost_variant`, `default_cost_variant`, `hidden_in_export`); the rest
were nullable additions. `SNAPSHOT_SCHEMA_VERSION` was bumped **zero** times. Two of those drops
(`measured_qty` in `20260716_0`, the section coeffs in `20260724_1`) touched fields the snapshot
actually carried, so under the letter of the rule they should have bumped — they didn't, and nothing
broke, because a dropped key is simply inert to a mapper that picks the keys it knows.

`context/foundation/lessons.md` (~line 750) records why the team is right to be reluctant: a bump makes
`assertReadableSchemaVersion` throw on **every** stored row _including the curated `kosztorys_presets`
library_, and it fails asymmetrically — the list queries (`snapshots.ts:85`, `presets.ts:134`) don't
assert, so a stale row keeps being offered in the UI and only throws in Polish once clicked. A longer
retention window makes that asymmetry worse in proportion to the number of rows kept, which is an
argument for fixing the list-side gate, not for keeping history short.

### Retention promises that must survive the change

`context/foundation/lessons.md` (~line 261): a destructive replace's undo is a **`manual`** snapshot
taken on the transaction handle before the wipe — _"write it as `kind: 'auto'` and it is ambient
history: capped at the newest 50 and swept after 7 days, so the undo silently expires."_
`replace-tree-with-snapshot.ts:83-126` relies on this. Manual retention must not shrink. Conversely,
once auto reaches 365 days too, that particular trap loses its teeth — worth noting so nobody later
"simplifies" the kind back to auto for the wrong reason.

### Surfaces that assume the count cap

- `src/__tests__/lib/db/snapshots.test.ts:52` — "keeps only the newest 50 auto snapshots and never
  touches manual" (inserts 55 + 3). `:126` — "drops auto >7 days and manual >1 year" (backdates
  1/10/100/400 days). Both `describe.skipIf` on DB env, run by `pnpm test:integration`.
- Three specs work around the cap in comments rather than asserting it — they compare newest-id
  because a fixed count is meaningless while `pruneAutoCount` pins auto at 50:
  `kosztorys-stages.test.ts:129`, `kosztorys-delete-guard.test.ts:137`,
  `kosztorys-bulk-discount-snapshot.test.ts:93`. Removing the cap makes those comments wrong but the
  assertions stay valid.
- `src/__tests__/app/(payload)/api/cron/cleanup/route.test.ts` mocks `gcSnapshots` entirely — only the
  401 gate is covered. No retention assertion at the cron level.
- **No E2E coverage of snapshots at all** (EX-428 sits in the `e2e-backlog`).

### The versions UI (recorded, not a design driver — owner is not worried about the list)

`src/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.tsx` is a `sm:max-w-md` dialog that
splits rows client-side by `kind` (`:69-70`) and renders **every** row, unvirtualized, with no
pagination and no `max-h` on the list wrapper (`:79`). `use-snapshot-list.ts:22-46` fetches the whole
list in one shot; `listSnapshots` (`snapshots.ts:85`) has no LIMIT, and `listSnapshotsAction`
(`kosztorys-snapshots.ts:99-126`) then resolves author names for the whole set. Removing `AUTO_KEEP`
removes the only bound on rows **inside** the 30-day full-density window: a heavily edited investment
can produce ~36 auto rows/day, i.e. ~1000 rows in the dialog before thinning starts. Manual already
has no count bound whatsoever.

### Timezone precedent

The repo buckets dates **in JS, never in SQL**. `src/lib/fleet/days.ts:1-29` is the established
pattern: `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' })` → `toWarsawDay()` returning
`YYYY-MM-DD`, with both ends parsed as UTC midnight so DST-length days don't skew `daysBetween`.
`src/lib/utils/format-date.ts:6` holds `PL_TIME_ZONE`. There is **no `AT TIME ZONE` and no
`date_trunc` anywhere** in `src/` or the migrations — all existing SQL uses bare `now()` /
`make_interval` in UTC. So a Postgres-side `date_trunc('day', taken_at AT TIME ZONE 'Europe/Warsaw')`
would be the first of its kind in this codebase; it is still the right tool (the sweep must not ship
rows to JS to decide what to delete), but it is a new precedent and should be commented as such.

## Code References

- `src/lib/db/snapshots.ts:17-20,55-64,105-112` — the constants, `pruneAutoCount`, `gcSnapshots`
- `src/lib/kosztorys/capture-auto-snapshot.ts:16` — the inline cap's only caller
- `src/app/(payload)/api/cron/cleanup/route.ts:19` — daily sweep entry point
- `src/lib/kosztorys/restore-kosztorys.ts:14-58` — wipe + reinsert + settings write-back
- `src/lib/kosztorys/insert-rows.ts:96,123` — the raw NOT NULL binds (hazard #1)
- `src/lib/kosztorys/insert-kosztorys-tree.ts:30-45,81-93` — dead-worker filtering (EX-641)
- `src/lib/kosztorys/snapshot-format.ts:8-30` — the version rule and its guard
- `src/lib/fleet/days.ts:1-29` — Warsaw day-bucketing precedent
- `src/migrations/20260710_1_add_kosztorys_snapshots.ts:22-28` — the two indexes

## Architecture Insights

- **Retention is enforced in two unrelated places on purpose**: inline per-insert (hot, per-investment)
  and daily global (covers dormant kosztorysy the inline path never revisits). Thinning belongs
  entirely in the daily sweep — it is inherently a whole-table, age-relative operation, and the inline
  path has nothing left to do once the count cap goes.
- **The sweep must stay stateless and idempotent.** Nothing records "this day was already thinned";
  the surviving row count per bucket _is_ the state. That is what makes a missed cron run harmless.
- **Presets share the format guard but have no retention at all** (`src/lib/db/presets.ts:89`, no
  DELETE anywhere) — relevant only because a version bump would break both at once.

## Historical Context (from prior changes)

- `context/archive/2026-07-10-kosztorys-snapshots/change.md` — S-06, the origin of 50/7/365 (EX-418,
  closed 2026-07-17).
- `context/archive/2026-07-18-kosztorys-undo/` — S-07 (EX-403 + EX-526); the idle-suppression gate
  deferred by S-06 shipped in `6b2a2e1e`. **Done**, not open.
- EX-641 — restore of a snapshot naming a deleted worker; the reason the dead-worker filter exists.
- EX-701 — closed with rationale, not an open defect: the revision gate lags a live edit by the ≤700 ms
  undo-coalescing window, self-healing on the next tick (`lessons.md` ~1188).
- EX-428 — deferred snapshot E2E, still in the `e2e-backlog`.

## Open Questions

1. **Does a NOT NULL tree column need a guard now, or a rule?** The cheapest insurance is `?? <default>`
   on the raw binds in `insert-rows.ts` so a missing key takes the intended default instead of 23502.
   The alternative is a documented rule ("a NOT NULL addition to a tree table bumps the version"),
   which is weaker — the same rule already failed twice for drops.
2. **Should the list-side gate assert the schema version?** Today a stale row is offered in the UI and
   throws only on click. At 365 days that becomes the common case after any future bump. Filtering
   unreadable rows out of `listSnapshots` (or badging them) is a small change with a large effect on
   whether the year of history is _real_.
3. **Does the owner want the reprice-on-restore behaviour surfaced?** A year-old tree restores under
   today's `settlementMode` / `materialsNetRate` / global discount. Correct, but at this age worth a
   sentence in the restore confirmation rather than a silent surprise.
4. **Bucket representative: last of day/week — confirmed.** No open question; recorded here only so the
   plan doesn't re-litigate it.
