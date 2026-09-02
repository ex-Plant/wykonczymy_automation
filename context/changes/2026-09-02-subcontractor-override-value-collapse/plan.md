# EX-766 — Collapse the subcontractor override pair into `overrideValue: number | null`

## Overview

The per-item subcontractor price override is stored as a **pair**: a `*_override_type` column that
only ever says `'amount'` or nothing, beside a `*_override_value` that is `NOT NULL DEFAULT 0`. Two
columns per tool plane, four in total. This plan collapses each pair into one nullable number —
`NULL` = auto (price follows the investment's coefficient), a number = a fixed kwota, `0` = an
explicit free-of-charge kwota.

The union has had one member since 2026-09-01, when the „własny mnożnik" mode was cut. What remains
is a discriminator that discriminates nothing, plus a value column whose default silently means the
same bytes as „auto".

## Current State Analysis

**Schema.** `kosztorys_items` carries `w_tools_override_type` (varchar), `w_tools_override_value`
(numeric NOT NULL DEFAULT 0) and the `own_tools_*` twin. `SubcontractorOverrideTypeT` is `'amount'`
alone; `subcontractorOverrideType` (`calc.ts:94`) folds anything else — including a pre-cut `'coeff'`
— back to null.

**Production data** (`dumps/dump-latest.sql`, 2026-09-02): 3671 rows across 11 investments.

| plane       | `type='amount'` | `type` NULL | value where type NULL |
| ----------- | --------------- | ----------- | --------------------- |
| `w_tools`   | 2612            | 1059        | always exactly `0`    |
| `own_tools` | 2626            | 1045        | always exactly `0`    |

Zero `'coeff'` rows survive. 238 `amount|0` pairs per plane — the designed explicit-zero, produced by
the sheet import when a rate is blank (`derive-override.ts:11-32`). That state is why the collapse must
keep `0 ≠ NULL`.

**The pair has a state no single write can produce.** `itemPatchSchema` is `.partial()`
(`actions/kosztorys.ts:53-69`), `grid-change-plan.ts:41-48` flattens a row diff to one entry per
field, and `use-kosztorys-editor.ts:677,1090` fires one action per entry inside a `Promise.all`. A
mode change therefore persists as **two independent, unordered, concurrent single-key writes**;
between them the row is `{type: null, value: 500}`, and a lost second write makes that permanent.
`/admin` reaches it directly. Benign today only because every read branches on the type.

**Nothing reads `value === 0` as "no override"** — verified exhaustively. `subcontractorPrice`
(`calc.ts:116-121`) and its SQL twin (`kosztorys-subcontractor-due.ts:39-49`) both gate on the type;
`row-conditions.ts:365,375` reads the _computed_ price.

**The base branch is not `staging`.** This work builds on `snapshot-retention-thinning`
(`context/archive/2026-09-02-snapshot-retention-thinning/`), already complete in the tree, which
changed two things that matter here. First, kosztorys snapshot retention went from 7 days to a year,
so "an old stored payload restores correctly" became load-bearing for the first time. Second, it
introduced `StoredSnapshotPayloadT` / `itemWithColumnDefaults` (`snapshot-format.ts`) — a typed
tolerance that fills a missing numeric key with `0`, covering both override value columns. That file
is a new Phase 2 touchpoint the original file list did not have.

The two changes interlock rather than conflict: the retention branch's own rule is that the tolerant
set holds "exactly the columns that are NOT NULL with a DEFAULT", and this change removes two columns
from that class. Deleting the auto snapshots (D3) also discharges the year-retention exposure in full
— the only surviving snapshots are the 11 `manual` rows with `{"items": []}`, so no payload written in
the old shape has to survive a year of restores.

**The neighbour table already has the target shape.** `impliedCatalogueRate`
(`work-catalogue/catalogue-rate.ts:12`) returns `number | null` with `null` = auto, and
`20260901_1_work_catalogue_auto_rates` migrated `work_catalogue_items` to it. This plan does not
introduce a representation; it brings `kosztorys_items` into line with its neighbour.

**The golden master is stale in a way that matters here.** `financial-golden-master.json` (2026-08-28)
carries `kosztorysItemCount: 1000` and exactly one `/k:` investment — `'7'`, the synthetic perf seed.
It was captured while prod held zero kosztorys rows, so today the eleven real kosztorys investments
all fail `inputsUnchanged`, land in `dataMoved`, and have their money compared against nothing. The
skipped set is exactly the set whose money this change can move.

## Desired End State

`kosztorys_items` carries two columns where it carried four. `wToolsOverrideValue` /
`ownToolsOverrideValue` are `number | null`; `NULL` means auto, a number means a kwota, `0` means an
explicit 0 zł kwota. `SubcontractorOverrideTypeT`, `subcontractorOverrideType`, `overrideTypeFor` and
the whole `subcontractor-price-edit.ts` pair abstraction are gone. The „Źródło ceny wykonawcy" column
still offers auto / kwota stała, but selecting a source is now **one** write to **one** field.

Verified by: every money figure in the golden master unchanged for all 12 compared investments; the
red test from Phase 1 green; `insert-schema-drift` and `kosztorys-tree-sql-drift` green against a
migrated `db-test`.

### Key Discoveries:

- `subcontractor-price-edit.ts:47` `clear` returns `{type: null, value: 0}` as one object, but it never
  reaches the DB as one — see Current State. The migration backfill must be
  `CASE WHEN type = 'amount' THEN value ELSE NULL END`, never bare `value`.
- `collections/kosztorys-items.ts:47,49` — `defaultValue: 0` must go **with** the type field. Payload's
  `getFallbackValue` treats a stored `NULL` as present and backfills the default, turning „auto" into
  „explicit 0 zł" on the first partial `/admin` update.
- `actions/kosztorys.ts` — `z.coerce.number()` yields `0` for `null`. `nullable()` must **wrap** the
  coercion, not follow it.
- `kosztorys-subcontractor-due.ts:40-46` — `coalesce(ki.w_tools_override_value, 0)` becomes actively
  wrong once NULL carries meaning. It must be deleted, not kept "for safety".
- `insert-rows.ts:32-35,123` — `ITEM_INSERT_COLUMNS` is hand-written and its positional VALUES tuple
  must shrink 4→2 in lockstep (`lessons.md:529`).
- `derive-override.ts:11-32` is the canonical prose for why `0 ≠ null` („a blank rate freezes an
  explicit flat 0"). It must survive, reworded to the single-field shape.
- The golden-master hash can be rewritten to emit the **legacy bytes as literals**, so the collapse
  moves no fingerprint and needs no regeneration of its own (see Phase 3).

## What We're NOT Doing

- **Not deleting the „Źródło ceny wykonawcy" column.** Settled 2026-09-01
  (`context/archive/2026-09-01-kosztorys-dwie-opcje-zrodla-ceny-wykonawcy/change.md:38`) and reaffirmed
  2026-09-02: deletion makes the return to auto undiscoverable. „Auto" is the absence of a value, not a
  visible state. The client price view, where „Źródło" is deliberately absent, is an exception for one
  surface, not a precedent. Rationale now in `context/reference/kosztorys-editor-domain-notes.md`.
- **Not rewriting the stored payloads.** Both blobs are deleted instead (Phase 2). No
  `SNAPSHOT_SCHEMA_VERSION` bump. A read-time normalizer already exists (`itemWithColumnDefaults`) —
  the work is **removing** two of its entries, not adding one; see Phase 2 step 11.
- **Not deleting the 11 empty `manual` snapshots** — `{"items": []}`, zero override entries, immune to
  this change, and the ones with genuine restore intent.
- **Not renaming anything.** `wToolsOverrideValue` / `ownToolsOverrideValue` already satisfy the
  glossary. The plane prefix is a dimension discriminator, not a source suffix; the
  `FromKosztorys`/`FromTransactions` axis belongs to the transfers recon seam and is not imported here.
- **Not splitting into two migrations across two deploys.** See Implementation Approach.
- **Not touching the Sheets integration.** `src/lib/google/**` has zero `override` hits; the type never
  leaves the app.

## Implementation Approach

**One migration, applied AFTER the deploy is live.** The two-migration split (`lessons.md:1482`) exists
to keep an old deploy away from a migrated DB, because the unauthenticated `/k/[token]` share route
names these columns and would throw Postgres 42703. Running the single migration after the deploy
achieves the same: the old code never meets the migrated schema, and the new code against an
unmigrated schema **reads** correctly — the value columns still exist and it simply stops selecting the
type columns.

The only window cost is `23502` on a "clear to auto" write: loud, authenticated, editor-only, and by
the owner's ruling (nobody is entering data during the window) free. This also means no migration file
is withheld from the tree, so `insert-schema-drift` needs no special handling.

**Accepted residual risk:** a Vercel rollback _after_ the migration puts old code against a migrated DB
and reintroduces 42703 on the investor share link.

**Order within the change:** regenerate the golden master first, on its own commit, so the baseline
being diffed is honest. Then one red test. Then the collapse, which cannot be subdivided — a type
change ripples through domain, data, and UI simultaneously and nothing typechecks in between.

## Critical Implementation Details

**Ordering — the migration is written and applied in different phases.** The file lands in Phase 2 so
`db-test` carries the new shape and the drift specs stay meaningful; it is applied to preview, and later
to production by a human, in Phase 4. Do not run it against `DB_POSTGRES_URL_PROD` at any point.

**The golden-master hash rewrite must land in the same commit as the migration** and the suite must run
against a `db-test` that has the migration applied. Before it, an auto row's value is `0` (not NULL) and
the new expression would emit `'amount:0'` for it.

---

## Phase 0: Honest golden-master baseline

### Overview

Regenerate the financial fixture on a freshly imported test DB, on its own commit, so the eleven
kosztorys investments re-enter the compared set before anything is refactored. Without this the change
ships with ~46k zł of robocizna unguarded across nine investments (see `research.md` § D4).

### Changes Required:

#### 1. Fixture regeneration

**File**: `src/__tests__/fixtures/financial-golden-master.json`

**Intent**: Recapture the money snapshot against the current prod dump so the fixture's per-entity
input hashes match reality, restoring comparison for the investments that carry a kosztorys.

**Contract**: `fingerprint.kosztorysItemCount` rises from 1000 to the dump's total plus the perf seed's
1000; `inputHashes.investments` gains a `/k:` segment for investments 9, 14, 19, 21, 45, 54, 61, 90,
106, 137, 138. No source file changes. Sequence: `pnpm db:import:test` → `pnpm seed:kosztorys:test` →
`pnpm seed:deposits:test` → `pnpm test:golden:update`.

**This commit contains the fixture and nothing else.** Regeneration freezes today's numbers as truth,
so its diff must be attributable on its own (`lessons.md:233`).

### Success Criteria:

#### Automated Verification:

- `pnpm test:parity` passes on a freshly imported + seeded `db-test`
- The regenerated fixture reports 12 comparable kosztorys investments, not 1 — assert by inspecting
  `inputHashes.investments` for `/k:` segments

#### Manual Verification:

- Spot-check two investments' figures in the regenerated fixture against the app's investment page —
  regeneration blesses today's numbers as correct, so a figure that is already wrong would be frozen in

---

## Phase 1: The red test — `NULL` is not `0`

### Overview

One behavioural proof, written before the refactor, that the two states stay distinguishable. This is
the single highest-value spec in the change: it is what would catch the `coalesce(…, 0)` trap.

### Changes Required:

#### 1. Row-condition spec

**File**: `src/__tests__/lib/kosztorys/row-conditions.test.ts`

**Intent**: Assert that the „brak ceny wykonawcy" condition fires for an item whose override value is
an explicit `0` and does **not** fire for one whose override value is `null` (auto, priced from the
coefficient). Extend the existing block at `:171-193` rather than starting a new file.

**Contract**: Fixtures built with `overrideValue: 0` vs `overrideValue: null` on a single field per
plane. Written in the target shape, so it does not compile until Phase 2 — that non-compilation IS the
red state; do not soften it by writing against the pair.

### Success Criteria:

#### Automated Verification:

- The new spec fails (does not compile) before Phase 2 — record the failure, do not commit a green
  placeholder

#### Manual Verification:

- None — this phase is a test only

---

## Phase 2: The collapse

### Overview

The atomic change: migration, types, pricing, SQL, inserts, Payload collection, action schema, grid,
and the two shared test fixture helpers. It cannot be subdivided — the type change crosses every layer
at once and the tree does not typecheck in between.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/20260902_0_collapse_kosztorys_tool_overrides.ts`

**Intent**: Relax both value columns, discard the value on every row that is not a kwota, delete the
two stored-payload tables' affected rows, then drop the two type columns.

**Contract**: In order, one `db.execute`:

1. `ALTER TABLE kosztorys_items` — `DROP NOT NULL` + `DROP DEFAULT` on `w_tools_override_value` and
   `own_tools_override_value`.
2. `UPDATE … SET <plane>_override_value = NULL WHERE <plane>_override_type IS DISTINCT FROM 'amount'`
   for both planes. **Never** carry the value column across unconditionally — a legacy `'coeff'` row's
   value slot holds a ratio, and an orphaned `{null, 500}` row would resurrect as a real kwota.
3. `DELETE FROM kosztorys_presets;` and `DELETE FROM kosztorys_snapshots WHERE kind = 'auto';`
4. `ALTER TABLE kosztorys_items DROP COLUMN` ×2 on the type columns.

`down` restores the shape, not the discarded numbers: value `0` where NULL, re-add the type columns as
nullable varchar, `SET DEFAULT 0` + `SET NOT NULL` on the value columns. State the lossiness in the
comment — the repo requires it (`20260824_1`, `20260825_0` are the precedents). The deleted blobs are
not restorable; say so.

House style: hand-written, opening
`// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).`, then the deploy order
**with its justification**. Naming `YYYYMMDD_<n>_snake_case.ts`, bare per-day counter.
`kosztorys_items` has no Payload versioning twin, so there is no `_v` table to adjust.

#### 2. Types and pricing

**Files**: `src/lib/kosztorys/types.ts`, `src/lib/kosztorys/calc.ts`

**Intent**: Delete `SubcontractorOverrideTypeT`, `subcontractorOverrideType` and `overrideTypeFor`.
`subcontractorPrice` branches on the value being non-null instead of on the type.

**Contract**: `ViewPricingT` loses `wToolsOverrideType` / `ownToolsOverrideType`; the two value fields
become `number | null`. `subcontractorPrice(row, view)` returns the value when non-null, else
`clientPrice × effectiveCoeff`. Do **not** keep `subcontractorOverrideType` alive as
`v => v === 'amount'` over a number column — that is the tautology `lessons.md:350` warns about.

#### 3. Delete the pair abstraction

**File**: `src/lib/kosztorys/subcontractor-price-edit.ts` (deleted)

**Intent**: `OverrideSnapshotT`, `overrideSnapshot`, `withOverride`, `subcontractorPolicy` and
`modeChange` exist only to keep two fields consistent. With one field there is nothing to keep
consistent. Call sites set the value directly; „auto" is `null`.

**Contract**: Every importer updated. The delete is gated on `pnpm typecheck`, not on grep.

#### 4. SQL data access

**File**: `src/lib/db/kosztorys-subcontractor-due.ts`

**Intent**: Drop the type branch and, with it, the `coalesce(…, 0)`.

**Contract**: The CASE reads `WHEN ki.<plane>_override_value IS NOT NULL THEN ki.<plane>_override_value
ELSE ki.client_price * <coeff> END`. **The `coalesce` must be deleted, not kept** — with NULL carrying
meaning it turns every auto row into 0 zł. This is the exact defect Phase 1's spec guards.

#### 5. Tree SELECT and raw inserts

**Files**: `src/lib/db/kosztorys-tree.ts`, `src/lib/db/work-catalogue.ts`, `src/lib/kosztorys/insert-rows.ts`

**Intent**: Stop selecting the type columns; shrink the insert column list and its positional tuple.
`work-catalogue.ts:111-129` is a **second** SELECT of the same four columns with its own mapper —
easy to miss because it lives under the katalog, not the kosztorys tree. Both must move together.

**Contract**: `ITEM_INSERT_COLUMNS` (`:32-35`) drops the two type entries and the VALUES tuple at `:125`
shrinks 4→2 **in the same edit** — the array is hand-written and positional (`lessons.md:529`). The
value is passed through as `null`, not `?? 0`. `kosztorys-tree-sql-drift` and `insert-schema-drift`
prove both halves.

#### 6. Payload collection

**File**: `src/collections/kosztorys-items.ts`

**Intent**: Remove both type fields and, critically, the `defaultValue: 0` on both value fields.

**Contract**: Fields become `{ name: 'wToolsOverrideValue', type: 'number' }` — no `defaultValue`,
no `required`. Leaving the default turns „auto" into „explicit 0 zł" on the first partial `/admin`
update. Update the collection's leading comment: it currently documents the pair and the `'coeff'`
fold, both of which are gone.

#### 7. Action schema

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: The patch schema accepts a nullable number for each plane and drops the type keys.

**Contract**: `nullable()` must **wrap** `z.coerce.number()`, not follow it — coercion turns `null` into
`0`, which is precisely the ambiguity being removed.

#### 8. Grid, columns and row plumbing

**Files**: `src/components/kosztorys/editor/grid/cells/subcontractor-columns.tsx`,
`src/lib/kosztorys/constants.ts`, `src/lib/kosztorys/v2-rows.ts`, `src/lib/kosztorys/row-ops.ts`,
`src/lib/kosztorys/row-conditions.ts`, `src/lib/kosztorys/sort-value.ts`

**Intent**: „Źródło ceny wykonawcy" **stays** as an auto / kwota stała picker, but now writes a single
field: choosing „auto" clears the value, choosing „kwota stała" seeds it from the price on screen. The
value cell writes the same field directly.

**Contract**: `OVERRIDE_FIELDS` (`constants.ts:5-11`) and `ITEM_FIELDS` (`v2-rows.ts:13-16`) lose the
type entries. Because a source change is now one field, `diffRow` emits a one-key patch and
`undo-coalesce.ts:29` produces one undo entry per gesture instead of two — both are consequences, not
work items. Sorting rank in `sort-value.ts:80` reads the single field.

#### 9. Catalogue round-trip

**Files**: `src/lib/kosztorys/work-catalogue/append-catalogue-items.ts`,
`src/lib/kosztorys/work-catalogue/catalogue-rate.ts`

**Intent**: `append-catalogue-items.ts:34-37` encodes a nullable number _into_ the pair and
`catalogue-rate.ts:13` decodes it back. The catalogue already stores the target shape, so the whole
round-trip is deleted and the value passes through.

**Contract**: `impliedCatalogueRate` keeps its `number | null` signature unchanged; only its body
simplifies. `append-catalogue-items.ts:74` filters planes by `overrideTypeFor(...) !== null`; it
becomes a non-null check on the value.

#### 10. Sheet import

**Files**: `src/lib/kosztorys/sheet-import/derive-override.ts`,
`src/lib/kosztorys/sheet-import/build-import-plan.ts`, `src/lib/kosztorys/sheet-import/parse-labor-tab.ts`

**Intent**: The import returns a nullable number instead of a pair. A blank rate still yields an
explicit `0`, never `null`.

**Contract**: Three comments say „the four override fields" (`footer-totals.ts:46`,
`build-sheet-comparison.ts:100,187`) — they become two. `derive-override.ts` returns `number | null`; `if (rate <= 0) return 0` replaces
`return { type: 'amount', value: 0 }`. **The prose at `:11-32` explaining why `0 ≠ null` is the reason
this whole change is delicate — reword it to the single-field shape, do not delete it.**

#### 11. Stored-payload tolerance

**File**: `src/lib/kosztorys/snapshot-format.ts`

**Intent**: The payload reader currently fills a missing override key with `0`
(`itemWithColumnDefaults`, `:116-117`). Once `NULL` means auto, that fallback silently converts every
restored „auto" pozycja into „jawne 0 zł" — the same defect as Payload's `defaultValue: 0`, in a
third place.

**Contract**: Delete both `?? 0` lines **and** remove both fields from the `TolerantT` optional set
(`:83-84`). The rule that set encodes — stated in its own comment and in `lessons.md:780` — is
"exactly the columns that are NOT NULL with a DEFAULT". This change takes two out of that class, so
the set shrinks; leaving them in with a `?? null` would keep claiming a tolerance the schema no
longer needs. A stored payload with no key then binds `undefined` → `NULL` → auto, which is the
correct reading of a payload written before the column existed. Update the block comment at `:91-92`
("Every numeric column below is NOT NULL DEFAULT 0") — it becomes false for two of them.

**This file is not in the change's original file list** — it arrived with
`snapshot-retention-thinning`, which is the base this work builds on. See Current State Analysis.

#### 12. Shared test fixture helpers

**Files**: `src/__tests__/helpers/kosztorys-tree.ts`, `src/__tests__/helpers/kosztorys-db-tree.ts`

**Intent**: Both builders construct the pair (`:37-40` and `:92-95`). Change them first — roughly 16
further specs then need only a mechanical rewrite (Phase 3).

**Contract**: One nullable value field per plane; helper defaults to `null` (auto).

### Success Criteria:

#### Automated Verification:

- Migration applies to `db-test`: `pnpm db:migrate:test`
- Phase 1's red spec is now green: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions.test.ts`
- Insert column list matches the live schema: `pnpm exec vitest run src/__tests__/lib/kosztorys/insert-schema-drift.test.ts`
- Tree SELECT matches the live schema: the `kosztorys-tree-sql-drift` spec passes
- `pnpm typecheck` reports no reference to `SubcontractorOverrideTypeT`, `overrideTypeFor` or
  `subcontractor-price-edit`
- A stored payload round-trips auto as auto, not as 0 zł:
  `pnpm exec vitest run src/__tests__/lib/kosztorys/serialize-restore-roundtrip.test.ts`

#### Manual Verification:

- In the editor, typing a kwota into „Cena j.m." wykonawcy sets „Źródło" to „kwota stała" in one write;
  Delete on the cell returns it to „auto"
- Choosing „auto" in the „Źródło" picker clears the price cell; choosing „kwota stała" seeds it from the
  price on screen
- A pozycja imported from the owner's sheet with a blank stawka still shows „kwota stała" and 0 zł — not
  „auto"
- One undo (Ctrl+Z) after a source change reverts the whole gesture, not half of it
- `/admin` → a kosztorys item: saving an unrelated field does not turn an „auto" pozycja into 0 zł

---

## Phase 3: Test sweep

### Overview

Mechanical fixture rewrites, one deliberate deletion, and the golden-master hash rewrite that keeps
every fingerprint byte-identical across the collapse.

### Changes Required:

#### 1. Golden-master hash

**File**: `src/__tests__/financial-golden-master-db.test.ts`

**Intent**: Rewrite the `overrides` hash expression so it produces the **same string for the same
money** before and after the migration — otherwise every fingerprint moves and all twelve kosztorys
investments fall out of comparison exactly when they are needed most.

**Contract**: Reproduce the legacy bytes as literals. Per plane:
`case when ki.<plane>_override_value is not null then 'amount:' || ki.<plane>_override_value::text else ':0' end`,
joined by `|| ':' ||` as today. The expression must not name a type column. Keep the existing
`ORDER BY ki.section_id, ki.display_order, ki.id` and its comment verbatim.

Proof this is byte-identical: an `'amount'` row is never rewritten by the migration, so its `numeric`
scale is unchanged and `'amount' || ':' || v::text` equals `'amount:' || v::text`; a NULL-type row
emitted `'' || ':' || '0'` = `':0'` and now emits the literal `':0'`. The only divergent state is a
legacy `'coeff'` row, and zero exist in prod or in either seed.

#### 2. Delete the legacy `'coeff'` spec

**File**: `src/__tests__/lib/kosztorys/kosztorys-calc.test.ts` (`:388-420`)

**Intent**: The block exercises the `'coeff'` fold, which no longer exists. Delete it with a one-line
rationale in the commit message; do not port it to a migration test.

**Contract**: Zero `'coeff'` rows exist in production or in any seed, so a migration test would assert
against data that has no instances. Keeping `subcontractorOverrideType` alive to keep the spec green
would be the tautology `lessons.md:350` names.

#### 3. Fixture-shape rewrites

**Files**: ~16 specs under `src/__tests__/**` that build override fixtures inline

**Intent**: Mechanical: pair → single nullable field. Two assertions need judgement, not mechanics.

**Contract**: `subcontractor-price-edit.test.ts:107,157` assert `clear` → `{type: null, value: 0}`; the
file is deleted with its subject, and any surviving „back to auto" assertion becomes
`overrideValue: null` — **asserting `0` there would silently reintroduce the ambiguity this change
removes**. Conversely `sheet-import/build-import-plan.test.ts:182,206-209` must become `0` and **must
not** become `null`. `row-conditions.test.ts:288-313` goes partly tautological (two of its three
subjects collapse into one) — trim it to what it still proves rather than leaving it green and empty.

### Success Criteria:

#### Automated Verification:

- `pnpm test:parity` passes with **no** fixture regeneration — the money figures for all twelve
  comparable investments are unchanged
- `pnpm test:integration` passes
- No spec references `SubcontractorOverrideTypeT` or the type fields

#### Manual Verification:

- None — this phase is tests only

---

## Phase 4: Preview rehearsal, then production

### Overview

Apply the migration to the preview database first, verify against a real deploy, and only then hand
production to a human.

### Changes Required:

#### 1. Preview

**Intent**: Rehearse the migration where a mistake is recoverable.

**Contract**: `pnpm db:migrate:preview` against `DB_POSTGRES_URL_PREVIEW`, on the staging branch, after
the staging deploy is live. Verify the row counts: 1059 / 1045 rows NULLed per plane, 2612 / 2626
kwota rows untouched, both type columns gone, `kosztorys_presets` empty, `kosztorys_snapshots` down to
the 11 `manual` rows.

#### 2. Production

**Intent**: Same migration, applied by a human, after the production deploy is live.

**Contract**: `pnpm db:migrate:prod` — **run by a human, never the agent** (AGENTS.md). Order is
deploy-first, migrate-second: the new code against an unmigrated schema reads correctly, and the only
window cost is a loud `23502` on a "clear to auto" write. The owner has confirmed nobody is entering
data during the window. Never run any SQL against `DB_POSTGRES_URL_PROD` outside this script.

### Success Criteria:

#### Automated Verification:

- `pnpm db:migrate:preview` exits 0 and a second run reports nothing pending

#### Manual Verification:

- On staging, the investor share link `/k/<token>` renders a kosztorys with correct wykonawca prices
- On staging, an „auto" pozycja still follows the investment's mnożnik after the migration; an explicit
  0 zł pozycja still shows 0 zł
- After the production migration, spot-check „należne wykonawcy" on investment 14 (the largest auto
  exposure, ~10 739 zł) against its value before the deploy
- The owner re-saves the „kosztorys wzór" szablon **after** the deploy, so the new one is serialized in
  the collapsed shape

---

## Testing Strategy

### Unit Tests:

- The `NULL` vs `0` distinction at the row-condition level (Phase 1) — the single behavioural proof
- Sheet import: a blank stawka yields an explicit `0`, never `null`
- Pricing: a non-null value wins; a null value falls back to `clientPrice × coeff`

### Integration Tests:

- `insert-schema-drift` and `kosztorys-tree-sql-drift` against a migrated `db-test` — both go red in any
  window where code and schema disagree, which is the point
- `pnpm test:parity` — the golden master with a stable hash proves no money moved

### Manual Testing Steps:

Collected into `context/foundation/manual-checks.md` at the final phase.

## Performance Considerations

Two fewer columns in the tree SELECT and two fewer fields per row over the wire. A kosztorys can reach
1000+ rows, so this is a small real win, not a regression risk. No new query shapes.

## Migration Notes

**Data discarded, deliberately:**

- The value on every non-kwota row (1059 w_tools + 1045 own_tools) — all are exactly `0`, so nothing of
  substance is lost; the discard is the guard against a `'coeff'` ratio or an orphaned `{null, 500}`
  being read as a kwota.
- `kosztorys_presets` — 1 row, `kosztorys wzrór test`, 373 items. Owner-approved; will be re-saved after
  the deploy. No inbound FK.
- `kosztorys_snapshots WHERE kind = 'auto'` — 5 rows (inv. 90 ×3, 137, 138), machine-written periodic
  captures spanning 2026-08-27…30. Owner-approved.

**Data kept:** the 11 empty `manual` snapshots. `{"items": []}`, zero override entries, immune to this
change, and the only snapshots anyone created on purpose.

**`down` is lossy and says so.** It restores the shape and, for every row that exists today, the exact
prior value (all discarded values were `0`). It cannot restore the deleted blobs.

## Whole-tree Gate

Run **once**, after Phase 3 — not per phase.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`
- Integration suite passes: `pnpm test:integration`
- Build succeeds: `pnpm build`

## References

- Research (two passes + owner decisions): `context/changes/2026-09-02-subcontractor-override-value-collapse/research.md`
- Prior decision keeping the „Źródło" column: `context/archive/2026-09-01-kosztorys-dwie-opcje-zrodla-ceny-wykonawcy/change.md:38`
- Domain rationale: `context/reference/kosztorys-editor-domain-notes.md` § „Stawka wykonawcy ma dwa źródła"
- Nullable-relax precedent: `src/migrations/20260901_1_work_catalogue_auto_rates.ts:11-12`
- Kosztorys column-drop precedent: `src/migrations/20260818_0_drop_kosztorys_hidden_in_export.ts`
- The target shape, already live in the neighbour table: `src/lib/kosztorys/work-catalogue/catalogue-rate.ts:12`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 0: Honest golden-master baseline

#### Automated

- [x] 0.1 `pnpm test:parity` passes on a freshly imported + seeded `db-test` — b5760821
- [x] 0.2 Regenerated fixture reports 12 comparable kosztorys investments, not 1 — b5760821

### Phase 1: The red test — `NULL` is not `0`

#### Automated

- [x] 1.1 The new row-condition spec fails (does not compile) before Phase 2

### Phase 2: The collapse

#### Automated

- [ ] 2.1 Migration applies to `db-test`: `pnpm db:migrate:test`
- [ ] 2.2 Phase 1's red spec is green
- [ ] 2.3 `insert-schema-drift` passes
- [ ] 2.4 `kosztorys-tree-sql-drift` passes
- [ ] 2.5 `pnpm typecheck` reports no reference to the removed type symbols
- [ ] 2.6 `serialize-restore-roundtrip` proves an auto pozycja restores as auto, not 0 zł

### Phase 3: Test sweep

#### Automated

- [ ] 3.1 `pnpm test:parity` passes with no fixture regeneration
- [ ] 3.2 `pnpm test:integration` passes
- [ ] 3.3 No spec references `SubcontractorOverrideTypeT` or the type fields

### Phase 4: Preview rehearsal, then production

#### Automated

- [ ] 4.1 `pnpm db:migrate:preview` exits 0 and a second run reports nothing pending
