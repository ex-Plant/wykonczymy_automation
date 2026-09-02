# Snapshot retention thinning — Implementation Plan

## Overview

Auto kosztorys snapshots are deleted after 7 days and capped at the newest 50 per investment. Replace
both bounds with **age-based thinning**: full density for 30 days, one per day to 120 days, one per
week to 365 days. Harden the restore path so a year-old payload actually restores, and say out loud
in the restore dialog what a restore does and does not bring back.

## Current State Analysis

- `src/lib/db/snapshots.ts:17-20` — `AUTO_KEEP = 50`, `AUTO_MAX_AGE_DAYS = 7`, `MANUAL_MAX_AGE_DAYS = 365`.
- Two independent bounds: `pruneAutoCount` (`:55`) inline on every auto insert
  (`src/lib/kosztorys/capture-auto-snapshot.ts:16`), and `gcSnapshots` (`:108`) in the daily cron
  (`src/app/(payload)/api/cron/cleanup/route.ts:19`, `vercel.json` `0 3 * * *`).
- The numbers were never derived. The S-06 plan brief lists them under _"Open questions / tuning"_:
  _"10-min throttle / 7-day auto retention are starting points — tune if the table grows."_
- Measured storage: a ~380-item kosztorys is ~23 KB stored (jsonb after TOAST), a 1000-item one
  ~31 KB. Today's entire ceiling is ~1,2 MB per investment. Storage does not defend the retention.
- 365 days is not a new regime — `MANUAL_MAX_AGE_DAYS` has been 365 since 2026-07-10. What has never
  happened is anyone restoring a payload that old.
- The restore path binds every `NOT NULL DEFAULT` column raw, with no `??`
  (`src/lib/kosztorys/insert-rows.ts:96,123`, `src/lib/kosztorys/insert-kosztorys-tree.ts:93,117`).
  A key missing from an old payload binds `NULL`, and an explicit NULL does not take the column
  DEFAULT → `23502`.
- **The payload is read at one boundary, but bound in a shared primitive.** `insertItems` /
  `insertSections` are also called by `append-preset-sections.ts:38,48` and
  `work-catalogue/append-catalogue-items.ts:81`, which build their rows in code — the latter
  documents at `:46` that it hands out DISTINCT `next + i` display_orders because the id remap
  depends on it. `kosztorys_sections.display_order` is not even read from the payload at those binds:
  `insertSections` takes it as a parameter, and the payload read is
  `insert-kosztorys-tree.ts:66` (`section.displayOrder`).
- `SNAPSHOT_SCHEMA_VERSION` is still `1` after five column drops in eight weeks. The version gate has
  never fired and is not what protects old rows.
- The repo buckets dates in **JS**, never in SQL (`src/lib/fleet/days.ts:1-29`, `Intl` + Warsaw).
  There is no `date_trunc` or `AT TIME ZONE` anywhere in `src/` or the migrations.

## Desired End State

An auto snapshot survives its first 30 days untouched; between 30 and 120 days one representative per
calendar day (Warsaw) remains; past 120 days one per calendar week; past 365 days none. Manual
snapshots are untouched at 365 days. A payload missing a numeric field restores on the column default
instead of throwing 23502. The restore confirmation states that the work scope comes back but the
discount, settlement mode and materials rate stay current.

Verify: with backdated fixtures across all three bands, one `gcSnapshots()` run leaves exactly one auto
row per day-bucket in 30–120d and per week-bucket in 120–365d, leaves every manual row under 365d, and a
second run immediately after deletes nothing.

### Key Discoveries

- The sweep must stay **stateless and idempotent** — the surviving row count per bucket _is_ the
  state, which is what makes a missed cron run harmless.
- `date_trunc('week', …)` in Postgres starts on Monday, which matches Poland. Verified against the
  local DB: `date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw')` → `2026-08-31 00:00:00` (a Monday).
- Only seven `NOT NULL` columns carry a DEFAULT and can be fixed at the bind: `kosztorys_items`
  `display_order`, `planned_qty`, `discount_value`, `client_price`, `w_tools_override_value`,
  `own_tools_override_value` (all `0`), `kosztorys_sections.display_order` (`0`) and
  `stage_progress.qty_done` (`0`). **`kosztorys_sections.name` and `kosztorys_stages.ordinal` are
  `NOT NULL` with no DEFAULT** — no bind-level fallback is meaningful for them, so they are out of
  scope and documented as such.
- **The seven are not homogeneous — two of them are join keys.** `remapNewIds` maps RETURNING back
  into input order on `display_order` (sections) and `(section_id, display_order)` (items),
  `insert-rows.ts:43,68-77`. Defaulting a missing `display_order` to a constant `0` ties that key for
  the whole batch: the remap degrades to positional, fires the `TODO(EX-449) SENTRY-REQUIRED`
  console.error on every such restore, and the tree comes back flattened to one position. The five
  value columns take `?? 0`; the two `display_order`s take the row's **index**, which preserves both
  the ordering and the key's distinctness.
- The change is **not retroactive**: no auto snapshot older than 7 days exists today, so the year of
  history starts accumulating from the deploy, not from the merge.
- **Everything currently in `kosztorys_snapshots` and in the preset library is test data — the owner
  has ruled it expendable (2026-09-02).** So no step of this change owes the existing rows anything:
  no backfill, no pre-flight dump, no "did the first sweep delete something" incident, and a wipe of
  either table is an acceptable recovery move on any environment. This does **not** soften Phase 2 or
  Phase 3 — both are forward-looking. Today's rows are disposable precisely because nobody has yet
  stored a payload they would miss; the whole point of the change is that from the deploy on, they
  will. Read the tests' emphasis on „nie skasuj cudzej historii" as protecting **future** rows.
- **The timezone is the loud risk, the partition key is the quiet one.** Getting `AT TIME ZONE`
  backwards (it means the opposite on a plain `timestamp`; `taken_at` is `timestamptz`, so the
  direction here is right) moves the day boundary a couple of hours and costs at most one extra
  surviving snapshot per bucket — cosmetic. Dropping `investment_id` from the `PARTITION BY`, or
  truncating to the wrong unit, deletes every investment's history but one, silently and irreversibly,
  because thinning is monotone. The tests are weighted accordingly.
- `rn = 1` always survives, so the sweep **cannot empty a bucket that had rows**. It can keep the wrong
  representative; it can never keep none.
- A destructive replace's undo is a **`manual`** snapshot on purpose
  (`replace-tree-with-snapshot.ts:83-126`, `lessons.md` ~261) — manual retention must not shrink.

## What We're NOT Doing

- **No pagination or virtualization of the versions drawer.** Removing the count cap removes the only
  bound on rows inside the 30-day window (a heavily edited investment can produce ~36 auto rows/day),
  and `kosztorys-versions-drawer.tsx:79` renders every row unvirtualized. The owner has ruled the list
  is not a concern; recorded so a future reader knows it was a decision, not an oversight.
- **No `schema_version` filter in `listSnapshots`.** The bump rule (Phase 3) makes "every stored row is
  readable" an invariant of the table instead, so a filter would guard a state that must not exist.
- **No backfill or migration.** Nothing to migrate; the sweep applies to whatever is in the table.
- **No change to the 10-minute capture interval or the undo-revision gate** (S-07, EX-701 — closed
  with rationale).
- **No change to presets**, beyond naming them in the bump rule.
- **No `?? ` fallback for `name` / `ordinal`** — see Key Discoveries.

## Implementation Approach

`gcSnapshots` becomes the single retention authority and grows from one DELETE to three, each
independently obvious: the age ceiling (auto and manual past 365 days), the daily band, the weekly
band. The count cap and its inline caller disappear. Thinning is expressed as
`row_number() OVER (PARTITION BY investment_id, <bucket> ORDER BY taken_at DESC, id DESC)` with
`rn > 1` deleted — newest per bucket survives.

Three statements rather than one CASE-keyed statement: the bands then map 1:1 onto the test cases and
onto the three rows of the retention table, and each query reads as a sentence. The cost is two extra
index scans on a table measured in thousands of rows.

## Phase 1: Thin instead of delete

### Overview

Replace the count cap and the 7-day auto ceiling with the three-band sweep in the daily cron.

### Changes Required

#### 1. Retention constants and the sweep

**File**: `src/lib/db/snapshots.ts`

**Intent**: Drop `AUTO_KEEP` and `pruneAutoCount` entirely; replace `AUTO_MAX_AGE_DAYS` with the band
boundaries and rewrite `gcSnapshots` to thin. The module comment at the top still describes "an inline
count cap kept hot on every auto insert" — it must now describe a single daily authority.

**Contract**: `gcSnapshots(db): Promise<{ deleted: number; ceiling: number; daily: number; weekly: number }>`
— `deleted` stays (the cron response keeps working) and gains a per-band breakdown. The breakdown is
the only instrument that makes the first night after deploy readable: today nothing older than 7 days
exists, so a **correct** first run must report `{ ceiling: 0, daily: 0, weekly: 0 }`. A non-zero count
there means the sweep is deleting something it should not, and it says so before there is a year of
history worth losing. New module constants:
`FULL_DENSITY_DAYS = 30`, `DAILY_BAND_DAYS = 120`, `MAX_AGE_DAYS = 365` — the last one applying to
**both** kinds, replacing `MANUAL_MAX_AGE_DAYS`. `pruneAutoCount` is removed from the module's exports.

Three statements, summing their `RETURNING id` counts:

1. Age ceiling — any row of either kind older than `MAX_AGE_DAYS`.
2. Daily band — `kind = 'auto'`, `taken_at` between `FULL_DENSITY_DAYS` and `DAILY_BAND_DAYS` ago,
   bucket = `date_trunc('day', taken_at AT TIME ZONE 'Europe/Warsaw')`.
3. Weekly band — `kind = 'auto'`, older than `DAILY_BAND_DAYS` (the ceiling already removed anything
   past 365), bucket = `date_trunc('week', …)`.

The `AT TIME ZONE` cast is the first date bucketing done in SQL in this repo — every other one is JS
(`src/lib/fleet/days.ts`). It belongs in SQL here because the sweep must decide what to delete without
shipping rows to the app; the query needs a comment saying exactly that, so the next reader doesn't
"fix" it into the JS convention.

#### 2. Inline cap caller

**File**: `src/lib/kosztorys/capture-auto-snapshot.ts`

**Intent**: Remove the `pruneAutoCount` call and its import; the function becomes insert-only. Its
comment names "the count cap + daily GC" as the bound — now only the daily GC bounds the table.

**Contract**: `captureAutoSnapshot(db, investmentId, takenBy): Promise<void>` unchanged.

#### 3. Retention spec

**File**: `src/__tests__/lib/db/snapshots.test.ts`

**Intent**: The `pruneAutoCount (DB)` describe block (`:27`) goes away with the function. The
`gcSnapshots age caps (DB)` block (`:93`) is rewritten to cover the three bands and idempotence.

**Contract**: Fixtures insert auto rows then backdate them with an `UPDATE … SET taken_at`, since
`taken_at` defaults to `now()`. **The backdating must be anchored, not `now()`-relative.** The
existing helper (`:113-124`) offsets from `now()`, so every fixture sits at whatever wall-clock time
the suite runs: "same day, three hours apart" crosses midnight whenever the run starts before 03:00
Warsaw, and a sub-week offset lands in one or two weeks depending on the weekday. Anchor instead on
`date_trunc('day', now() AT TIME ZONE 'Europe/Warsaw')` shifted back N days plus an explicit hour —
the same instrument the sweep uses, so the spec asserts the bucketing and not the clock. Keep every
fixture age clear of the band edges (30 / 120 / 365): the backdating UPDATE and the sweep's `now()`
are different transactions, so a row placed exactly on an edge races. Cases: (a) rows inside 30 days all survive; (b) several rows on one
calendar day in the 30–120d band collapse to the newest of that day, and two different days keep one
each; (c) rows across two calendar weeks past 120 days collapse to one per week; (d) manual rows under
365 days survive every band; (e) both kinds past 365 days are removed; (f) a second `gcSnapshots()`
call immediately after the first deletes zero; **(g) two investments with rows in the same calendar day
each keep their own representative** — the regression guard for a dropped `investment_id` in the
`PARTITION BY`, which is the one mistake that silently wipes every investment's history but one and is
invisible to a single-investment fixture. Follows the existing `describe.skipIf(!ENV_READY)` shape
so `pnpm test:integration` picks it up.

#### 4. Stale comments in neighbouring specs

**File**: `src/__tests__/lib/actions/kosztorys-stages.test.ts`, `.../kosztorys-delete-guard.test.ts`,
`.../kosztorys-bulk-discount-snapshot.test.ts`

**Intent**: Each explains that it compares newest-id rather than a fixed count _because_
`pruneAutoCount` pins auto at `AUTO_KEEP`. The assertions stay correct; the stated reason stops being
true. Update the three comments.

**Contract**: No assertion changes.

#### 5. Cron route spec — the authorized path

**File**: `src/__tests__/app/(payload)/api/cron/cleanup/route.test.ts`

**Intent**: All three existing cases are 401 rejects, and the happy path is never reached — so
`gcSnapshots` and `payload` are stubbed and `@/lib/db/get-db` isn't mocked at all. Nothing today
asserts what the route forwards, which is what makes the first-night per-band reading trustworthy.

**Contract**: One added case — an authorized request with `getPayload` and `@/lib/db/get-db` mocked
and `gcSnapshots` stubbed to return a breakdown — asserts the 200 body carries
`{ ok: true, snapshots: { deleted, ceiling, daily, weekly } }`. The route itself needs no change: it
already spreads whatever `gcSnapshots` returns.

### Success Criteria

#### Automated Verification

- Retention spec passes: `pnpm exec vitest run src/__tests__/lib/db/snapshots.test.ts`
- The three neighbouring snapshot specs still pass: `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-stages.test.ts src/__tests__/lib/actions/kosztorys-delete-guard.test.ts src/__tests__/lib/actions/kosztorys-bulk-discount-snapshot.test.ts`
- Cron route spec still passes: `pnpm exec vitest run "src/__tests__/app/(payload)/api/cron/cleanup/route.test.ts"`
- `grep -rn "pruneAutoCount\|AUTO_KEEP" src` returns nothing
- The cron route returns the per-band breakdown (spec asserts the shape it forwards)

#### Manual Verification

- Editing a kosztorys for over 10 minutes still produces auto snapshots in the versions drawer, and
  more than 50 accumulate without any disappearing.
- The first `/api/cron/cleanup` run after deploy logs `{ ceiling: 0, daily: 0, weekly: 0 }` in the
  Vercel function logs — anything else means the sweep is deleting rows it should not.

---

## Phase 2: Make an old payload restorable

### Overview

A snapshot older than the fields it was written with must restore on column defaults rather than
throwing `23502`.

### Changes Required

#### 1. Numeric NOT NULL fields, defaulted at the payload boundary

**File**: `src/lib/kosztorys/insert-kosztorys-tree.ts`

**Intent**: Give every `NOT NULL DEFAULT` field a fallback where the payload is read, so a snapshot
written before the field existed inserts a usable value instead of an explicit NULL. Today a missing
key binds `NULL` and Postgres does not substitute the DEFAULT for an explicit NULL — it raises 23502,
surfaced to the user as the generic "nic nie zostało zapisane" (`replace-tree-with-snapshot.ts:36-37`).

**Where, and why not at the bind**: `insertItems` / `insertSections` are shared primitives —
`append-preset-sections.ts` and `work-catalogue/append-catalogue-items.ts` also call them with rows
built in code, where a missing value is a bug those callers should surface, not absorb.
`insertKosztorysTree` is the one place a stored payload is read, and its module comment already
declares the tolerance contract ("Tolerant deserialization: missing arrays default to empty; a child
whose parent is absent is skipped"). The fallbacks join that sentence rather than opening a second
home for it. `apply-preset.ts` routes through the same function and inherits the tolerance, which is
correct — a preset is a stored payload too.

**Contract**: Normalize each row as it is mapped, at `:64-66` (sections), `:73-76` (items), `:90-93`
(stages) and `:115-118` (progress):

- **Value columns → `?? 0`**, mirroring the migration DEFAULT: `kosztorys_items.planned_qty`,
  `discount_value`, `client_price`, `w_tools_override_value`, `own_tools_override_value`;
  `stage_progress.qty_done`. Each site carries a short comment saying the literal mirrors the column
  default.
- **`display_order` (items and sections) → `?? index`**, not `?? 0`. It is the natural key
  `remapNewIds` joins RETURNING on; a constant would tie it for the whole batch, drop the remap to
  positional, fire the `TODO(EX-449) SENTRY-REQUIRED` console.error, and restore the tree flattened to
  one position. The index preserves both the order and the key.
- `kosztorys_sections.name` and `kosztorys_stages.ordinal` are NOT NULL **without** a DEFAULT —
  deliberately left alone, with a comment naming why (there is no meaningful fallback for a section
  with no name, and `ordinal` is constraint-backed).

#### 2. Settings dereference

**File**: `src/lib/kosztorys/restore-kosztorys.ts`

**Intent**: `settings` is read unguarded (`:48-50`) and `vat_rate` is NOT NULL, so a payload missing the
whole `settings` key throws a TypeError before SQL is even reached. Fall back to the investment's
current values rather than failing the restore — the tree is what the user asked for.

**Contract**: A missing `settings` (or a missing field within it) leaves the corresponding investment
field untouched instead of writing `undefined`.

#### 3. Restore-durability spec

**File**: `src/__tests__/lib/kosztorys/insert-kosztorys-tree.test.ts` (new — the module has no spec of
its own today; its nearest neighbours are `insert-schema-drift.test.ts`, which guards the column
lists, and `insert-rows.test.ts`, which is pure. This one is DB-backed, so it follows the
`describe.skipIf(!ENV_READY)` shape.)

**Intent**: Guard the fix with a payload that omits the numeric fields — the regression test for a
failure mode that has no user yet but is the whole reason a year of history is trustworthy.

**Contract**: Inserting a tree whose item omits `plannedQty` / `clientPrice` / the override values
succeeds and the persisted row reads `0` for each. A second case omits `displayOrder` on several
sections and items and asserts the persisted rows carry **distinct, input-ordered** `display_order`
values — the guard against the constant-`0` variant that would tie the remap key. Assert the
**persisted state**, not the return value.

### Success Criteria

#### Automated Verification

- Restore-durability spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/insert-kosztorys-tree.test.ts`
- Existing restore/replace specs still pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/replace-tree-lost-write.test.ts`

#### Manual Verification

- Restoring a normal, current snapshot still works end-to-end and the figures are unchanged.

---

## Phase 3: Say what the guarantees are

### Overview

Two pieces of prose, each closing a gap the longer retention opens.

### Changes Required

#### 1. The bump rule

**File**: `src/lib/kosztorys/snapshot-format.ts`, `context/foundation/lessons.md`

**Intent**: Record that bumping `SNAPSHOT_SCHEMA_VERSION` is incomplete without a decision about the
existing rows, and that the resulting invariant is what makes a read-time filter unnecessary. The
same edit corrects the header comment (`:8-10`), which today asserts _"the restore mapper defaults
anything missing, so an old snapshot still restores"_ — the exact premise this change exists to
repair, and one Phase 2 only repairs in part. It must say what is defaulted (the numeric fields, at
the `insertKosztorysTree` boundary) and what is not (`name`, `ordinal` — NOT NULL with no DEFAULT),
or the bump rule sits directly above a line that contradicts it.

**Contract**: The rule has three exits — **don't bump** (additive, or a key the mapper never reads —
five column drops have taken this exit with no failure), **migrate** (presets: a hand-curated library,
deleting it destroys real work), **delete** (snapshots: ambient history, cheap to re-accumulate).
Forbidden: bump and leave. The invariant that follows — _every row in `kosztorys_snapshots` is readable
by the current code_ — is why `listSnapshots` carries no version filter and why
`assertReadableSchemaVersion` in `getSnapshot` is a seatbelt for a state that should not occur. The
`lessons.md` entry extends the existing one on bumping (~line 750) rather than opening a second.

#### 2. Restore confirmation

**File**: `src/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.tsx`

**Intent**: The `ConfirmDialog` description (`:125`) currently says only _"Obecny stan zostanie zapisany
jako punkt przywracania."_ A restore brings back the work scope but leaves the global discount,
settlement mode and materials rate at their current values — correct by design
(`snapshot-format.ts:32-34`), and over a 30-day window invisible. Over 365 days it will not be, and
"przywróć wersję" reads like a time machine.

**Contract**: One added sentence in the existing description, in the sheet's register (rozpiska /
rabat / rozliczenie), unconditional — the statement is true for every snapshot, and a
30-day condition would add a fourth threshold to maintain alongside 30/120/365.

#### 3. Retention documentation

**File**: `src/lib/db/snapshots.ts` (module comment)

**Intent**: The comment is the only place the retention policy is stated for a reader. It must carry
the three bands, the Warsaw bucketing, "newest of the bucket wins", and the fact that the sweep is
idempotent so a missed cron run is harmless.

**Contract**: Prose only.

### Success Criteria

#### Automated Verification

- No phase-scoped automated check — this phase is prose and one UI string. The whole-tree gate covers it.

#### Manual Verification

- The restore confirmation shows the new sentence and reads naturally in Polish.

---

## Testing Strategy

### Unit / integration tests

- `snapshots.test.ts` — the three bands, the manual exemption, the 365-day ceiling, and idempotence
  (a second sweep deletes nothing). DB-backed, discovered by `scripts/test-integration.sh`.
- `insert-kosztorys-tree` — a payload missing the numeric fields inserts on column defaults, asserted
  against the persisted row.

### Manual testing steps

1. Edit a kosztorys past the 10-minute interval; confirm auto snapshots appear and accumulate past 50.
2. Open the versions drawer, restore a snapshot, confirm the new sentence appears in the confirmation
   and the restore still works.

## Performance Considerations

The sweep runs once daily over a table measured in thousands of rows and both bands are covered by
`kosztorys_snapshots_investment_kind_taken_at_idx`
(`src/migrations/20260710_1_add_kosztorys_snapshots.ts:26-28`). Removing the inline `pruneAutoCount`
makes every auto capture one DELETE cheaper.

Growth: ~23 KB per snapshot. An actively edited investment is ~36 rows/day inside the 30-day window
(~25 MB worst case, far below realistic usage), decaying to ~23 KB/day and then ~23 KB/week.

## Migration Notes

No schema change, no migration, no prod migration gate. The change is **not retroactive** — nothing
older than 7 days exists in the auto history today, so the year of history starts at deploy.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`
- Integration (DB) suite passes: `pnpm test:integration`

## References

- Research: `context/changes/2026-09-02-snapshot-retention-thinning/research.md`
- Decisions: `context/changes/2026-09-02-snapshot-retention-thinning/change.md`
- Origin of the current numbers: `context/archive/2026-07-10-kosztorys-snapshots/change.md`
- Warsaw day-bucketing precedent: `src/lib/fleet/days.ts:1-29`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Thin instead of delete

#### Automated

- [x] 1.1 Retention spec passes
- [x] 1.2 Three neighbouring snapshot specs still pass
- [x] 1.3 Cron route spec still passes
- [x] 1.4 `grep -rn "pruneAutoCount\|AUTO_KEEP" src` returns nothing
- [x] 1.5 Cron route forwards the per-band breakdown

### Phase 2: Make an old payload restorable

#### Automated

- [x] 2.1 Restore-durability spec passes
- [x] 2.2 Existing restore/replace specs still pass

### Phase 3: Say what the guarantees are

#### Automated

- [x] 3.1 No phase-scoped automated check (prose + one UI string) — covered by the whole-tree gate
