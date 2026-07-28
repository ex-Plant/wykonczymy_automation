# Drop the dead costVariant / defaultCostVariant columns — Implementation Plan

## Overview

`kosztorys_items.cost_variant` and `kosztorys_sections.default_cost_variant` were born on 2026-07-08
to carry a per-pozycja / per-sekcja subcontractor cost variant. Their only consumer —
`effectiveCostVariant(item, section) => item.costVariant ?? section.defaultCostVariant` — was deleted
**39 minutes later** in a `calc.ts` dead-code sweep (`6bd7c745`, "0 refs") that never looked at the
schema. They have been inert ever since: written on every insert, read by nothing.

They can never come back. The owner refuted the per-pozycja grain on 2026-07-21 („grain wyboru wariantu
to **etap**, nie praca") and the concept shipped on `kosztorys_stages.plane` via EX-565 (`65db3ba9`).
A later merge of `CostVariantT` + `StagePlaneT` into one `ToolPlaneT` (`8ef4a3e5`) made things worse —
two dead fields now share a type name with the one live carrier, so they _read_ as load-bearing.

This change deletes both columns and every carrier, and corrects the docs that still present the
abandoned cascade as live, open design.

## Current State Analysis

**Nothing reads either field.** All ~60 non-generated references are carriers: DDL, SQL select,
row mapper, TS type, zod branch, seed literal, test fixture.

- `assembleV2Columns` (`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`, 631 lines)
  binds only `clientPrice`, `description`, `plannedQty`, `stage_<id>`, `note`. **No grid column binds
  `costVariant`** — so `ITEM_FIELDS`'s `'costVariant'` entry (`v2-rows.ts:17`) is unreachable in
  `diffRow`, and both zod branches (`actions/kosztorys.ts:49,58`) are therefore unreachable too.
- `calc.ts` never sees a section or a `costVariant`; `subcontractorPrice` keys off the **global**
  `PriceViewT`, settlement keys off `stage.plane`.
- Both fields are nevertheless **admin-visible and editable** (`type: 'text'`, no `hidden`/`readOnly`,
  no option list) — an owner can type anything into „Domyślny wariant kosztu" and it validates,
  persists, and does nothing.

**Persistence is safe.** No spread-into-INSERT, no `jsonb_populate_record`, no zod `.parse()` on
stored payloads. `presets.ts:89` / `snapshots.ts:82` are bare casts; the action schemas are non-strict
`z.object().partial()`, so a stale browser tab posting the removed key degrades to a `payload.update`
no-op. Nothing reaches Google Sheets, print/CSV export, or any versioned wire contract.

**The compiler is the completeness proof.** `ITEM_FIELDS` is
`as const satisfies readonly (keyof ItemPatchT)[]` — removing the field from `ItemPatchT` makes
`pnpm typecheck` fail until every carrier is gone.

**Docs state falsehoods in three places:**

- `context/reference/kosztorys-editor-domain-notes.md:385-478` — a 94-line section titled
  „…model się rozjeżdża (**OTWARTE**, duża zmiana)" whose level 1 is
  `kosztorys_sections.default_cost_variant` („już istnieje", `:414`), plus three moot
  „do rozstrzygnięcia" bullets and a „stan modelu app" block (`:454-464`) asserting now-false state.
- Same file `:183-188` (per-pozycja cascade in the domain model), `:198-199` (input inventory),
  `:599` (P11).
- `context/domain/01-domain-distillation.md:64-65` — the **living** DDD map cites both fields with
  `file:line` as current verified truth.

**One cross-plan collision.** `context/changes/ex-430-harden-bulk-insert-restore/` (`status: planned`)
specifies a wide-field roundtrip fixture covering „every discount/**cost-variant**/override combo"
(`plan.md:186`, `change.md:23`). That plan is stale on a second axis too: it also wants „a section with
both coeffs null and one with both set", but those coeffs were dropped by `20260724_1`.

## Desired End State

Both columns are gone from the database and from every TS/SQL/zod/fixture carrier. `ToolPlaneT` has
exactly **one** carrier (`kosztorys_stages.plane`) and its doc-comment says so.
`grep -ri cost_variant` returns hits only in `context/archive/**` (historical by design) and in the
birth migration `20260708_2` (immutable history). The docs describe the per-etap plane as what
shipped, not as an open question. EX-430's plan no longer asks for a fixture on a dead column.

### Key Discoveries:

- `SNAPSHOT_SCHEMA_VERSION` **stays at 1**. Precedent: `20260724_1_drop_kosztorys_section_coeff.ts`
  dropped `w_tools_coeff`/`own_tools_coeff` from the same table — the same class of change — without a
  bump. Bumping to 2 would hard-reject every stored snapshot _and_ the entire global preset library,
  and do it **asymmetrically**: the list queries (`snapshots.ts:85`, `presets.ts:105,133`) don't
  assert, so the versions list and the „dodaj sekcję z szablonu" picker would keep offering entries
  that throw a Polish error the moment you click them.
- Neither column carries an index, constraint, or pg enum (both plain `varchar`, `20260708_2`), and
  `kosztorys_items` has no Payload versioning — so there is no `_kosztorys_items_v` twin to drop from.
- No backfill is owed: kosztorys data is throwaway until dogfooding lands on `main` (AGENTS.md).
- Zero e2e hits, zero golden-master/parity hits, zero **value** assertions — every test occurrence is
  a fixture literal satisfying a required field.

## What We're NOT Doing

- **Not touching `kosztorys_stages.plane`** or anything in the live per-etap settlement path.
- **Not bumping `SNAPSHOT_SCHEMA_VERSION`** (see above) and not migrating stored snapshot/preset
  payloads — a stale `costVariant` key in a jsonb blob is inert on restore.
- **Not editing `context/archive/**`\*\* — archived docs are historical records, correct as of their
  date.
- **Not running the prod migration.** `pnpm db:migrate:prod` is human-only, owed at ship time, before
  the code is pushed to `main`.
- **Not reopening the per-etap model.** The doc rewrite records what was decided; it does not
  re-litigate it.

## Implementation Approach

Schema first, then let the type system drive. Phase 1 drops the columns; Phase 2 removes the two
Payload fields and the four TS carriers, at which point `pnpm typecheck` enumerates every remaining
site; Phase 3 clears them. Phase 4 sweeps fixtures and seeds (not compiler-forced everywhere, so it is
its own pass). Phase 5 is a one-comment amendment. Phase 6 is the documentation correction — the half
of this change that has actual judgement in it.

---

## Phase 1: Drop the columns

### Overview

One hand-written migration, applied to local (5433) and test (5435). Prod is deferred to a human.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/20260728_0_drop_kosztorys_cost_variant.ts` (new)

**Intent**: Drop both columns. Hand-written because `migrate:create` emits phantom drift (AGENTS.md).

**Contract**:

```ts
import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// The per-item cost-variant tier never had a consumer: its only reader was deleted 39 minutes
// after the columns were born (6bd7c745). The concept it was meant to carry shipped on
// kosztorys_stages.plane instead (EX-565), at the etap grain the owner confirmed.
// No backfill: kosztorys data is throwaway until dogfooding lands on `main`. Neither column
// carries an index, constraint or pg enum (both plain varchar, 20260708_2), and kosztorys_items
// has no Payload versioning, so there is no `_kosztorys_items_v` twin to drop from.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items" DROP COLUMN IF EXISTS "cost_variant";
    ALTER TABLE "kosztorys_sections" DROP COLUMN IF EXISTS "default_cost_variant";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items" ADD COLUMN IF NOT EXISTS "cost_variant" varchar;
    ALTER TABLE "kosztorys_sections"
      ADD COLUMN IF NOT EXISTS "default_cost_variant" varchar NOT NULL DEFAULT 'w_tools';
  `)
}
```

#### 2. Migration registration

**File**: `src/migrations/index.ts`

**Intent**: Register the new migration. Payload orders by **filename lexical sort**
(`readdirSync().sort()`), so the `20260728_0_` prefix sorts after `20260726_4_` — dependency order and
sort order agree.

**Contract**: Import alongside the existing block, array entry appended last.

#### 3. Apply locally

**Intent**: Local dev DB and the isolated test DB.

**Contract**: `pnpm payload migrate` (5433) and `pnpm db:migrate:test` (5435). **Restart any dev
server booted before the migration** — a migration is only "verified" when the running app reads the
new schema (`lessons.md`).

### Success Criteria:

#### Automated Verification:

- Migration applies clean: `pnpm payload migrate`
- Test DB migrated: `pnpm db:migrate:test`
- Columns absent: `information_schema.columns` has no `cost_variant` / `default_cost_variant`

#### Manual Verification:

- None (Phases 2-4 exercise the app against the new schema).

---

## Phase 2: Payload fields + TS carriers

### Overview

Remove the source-of-truth declarations. After this phase `pnpm typecheck` is a worklist.

### Changes Required:

#### 1. Payload collections

**Files**: `src/collections/kosztorys-items.ts` (`:46` field, `:9` comment),
`src/collections/kosztorys-sections.ts` (`:37-43` field, `:5-7` comment)

**Intent**: Delete the two fields and the comments that only exist to explain them. The
`kosztorys-sections.ts` header comment must lose its `defaultCostVariant` clause without losing
whatever else it says about the section.

**Contract**: No `costVariant` / `defaultCostVariant` field remains; `pnpm generate:types` regenerates
`src/payload-types.ts` (gitignored — never `git add` it).

#### 2. Type carriers

**File**: `src/lib/kosztorys/types.ts`

**Intent**: Remove all four carriers and correct the two comments that assert the dead model.

**Contract**:

- `:33` drop `KosztorysSectionT.defaultCostVariant`
- `:50` drop `KosztorysItemT.costVariant`
- `:71` drop `'costVariant'` from the `ItemPatchT` pick
- `:187` drop `KosztorysV2RowBaseT.sectionDefaultCostVariant`
- `:2` drop the „costVariant = null means 'inherit from the section'" sentence
- `:90-96` rewrite the `ToolPlaneT` doc-comment: **one** carrier (a stage's `plane`), not three. Keep
  the „a plane IS a valid price view and flows straight into `viewPrice()`" fact and the
  `null = undecided` clause — both are still true and load-bearing.

### Success Criteria:

#### Automated Verification:

- `pnpm generate:types` succeeds
- `pnpm typecheck` fails **only** at the expected carrier sites (this is the enumeration, not a pass)

#### Manual Verification:

- None.

---

## Phase 3: Clear the carriers

### Overview

Mechanical removal of every site the compiler names.

### Changes Required:

#### 1. Data-access layer

**File**: `src/lib/db/kosztorys-tree.ts`

**Contract**: drop `default_cost_variant` from the section SELECT (`:64`) and `cost_variant` from the
item SELECT (`:75`); drop the two mapper lines (`:132`, `:149`).

#### 2. Insert primitives

**File**: `src/lib/kosztorys/insert-rows.ts`

**Contract**: drop `${s.defaultCostVariant}` from the section VALUES tuple (`:24`) and
`default_cost_variant` from its column list (`:28`); drop `${it.costVariant ?? null}` (`:47`) and
`cost_variant` (`:53`) from the item pair. **Tuple and column list must stay index-aligned** — the
single highest-risk edit in this change; a mismatch shifts every subsequent value one column left.

#### 3. Row assembly

**File**: `src/lib/kosztorys/v2-rows.ts`

**Contract**: drop `'costVariant'` from `ITEM_FIELDS` (`:17`) and the
`sectionDefaultCostVariant: section.defaultCostVariant` denormalization (`:44`).

#### 4. Row / section construction

**Files**: `src/lib/kosztorys/row-ops.ts` (`:30`, `:55`, `:62`),
`src/lib/kosztorys/constants.ts` (`:44-45`), `src/lib/kosztorys/create-section.ts` (`:32`),
`src/lib/kosztorys/append-preset-sections.ts` (`:56`)

**Contract**: `NEW_SECTION_DEFAULTS` loses its `defaultCostVariant` key and its
`satisfies { name: string; defaultCostVariant: ToolPlaneT }` clause narrows to `{ name: string }`;
`BlankRowInputT` loses `sectionDefaultCostVariant`; the blank row loses `costVariant: null`.

#### 5. Action validation

**File**: `src/lib/actions/kosztorys.ts`

**Contract**: drop the `costVariant: stagePlaneSchema.nullable()` (`:49`) and
`defaultCostVariant: stagePlaneSchema` (`:58`) branches. `stagePlaneSchema` itself **stays** — it is
the live stage-plane validator.

#### 6. Editor hook

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Contract**: drop the five carrier sites (`:556-557`, `:592`, `:727`) and drop the
`defaultCostVariant` clause from the comment at `:895-897` (it explains why two pathways share one
column — the clause naming `defaultCostVariant` dies, the rest of the sentence stays).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- No carrier remains outside archive/history:
  `grep -rn "cost_variant\|costVariant\|defaultCostVariant\|sectionDefaultCostVariant" src/` returns
  only `src/migrations/20260708_2_add_kosztorys_sections_items.ts`

#### Manual Verification:

- None (Phase 4 runs the suites).

---

## Phase 4: Fixtures, seeds, and the JSON fixture

### Overview

Not all of these are compiler-forced (JSON literals aren't type-checked), so this is a deliberate
sweep. Decision: clean **everything**, so a future reader can never resurrect the concept from a
fixture.

### Changes Required:

#### 1. Test fixtures

**Files**: ~30 literals across `src/__tests__/**` — `helpers/kosztorys-tree.ts:40`, and specs under
`lib/kosztorys/`, `lib/actions/`, `lib/db/`.

**Intent**: Remove the fixture keys. Every occurrence is a required-field literal; **no test asserts a
value**, so no assertion changes.

**Contract**: Also drop the explanatory comment at `kosztorys-tree.db.test.ts:29` (it exists only to
explain why `defaultCostVariant` is spelled out in a Payload-created fixture).

#### 2. Seed scripts

**Files**: `src/scripts/seed-kosztorys.ts:96`, `perf-seed-kosztorys.ts:53`,
`seed-kosztorys-bands.ts:49`, `seed-kosztorys-reconciliation.ts:49`, `seed-sync-test-inv14.ts:47`,
`seed-sync-test-inv67.ts:113`, `seed-investment-from-sheet.ts:135,161,232,260`

**Intent**: These write the column at runtime — leaving them would break seeding against the new
schema, not just leave dead text.

**Contract**: `seed-investment-from-sheet.ts` needs care: it carries the field through an
intermediate shape (`:135`/`:161` build it, `:232`/`:260` consume it) — remove both ends.

#### 3. JSON fixture

**File**: `src/scripts/fixtures/kosztorys-bialostocka.json` (337 occurrences)

**Intent**: Strip the stale keys. Large no-op diff, accepted deliberately so `grep` comes back clean.

**Contract**: Mechanical key removal only — no value, ordering, or structural change to any other key.

### Success Criteria:

#### Automated Verification:

- Unit suite green: `pnpm test`
- Integration suite green: `pnpm test:integration`
- Seeds run against the migrated local DB:
  `INV=6 node --env-file=.env --import tsx src/scripts/seed-kosztorys.ts` and
  `INV=7 node --env-file=.env --import tsx src/scripts/perf-seed-kosztorys.ts`
- `grep -rn "cost_variant\|costVariant" src/` returns only `20260708_2`

#### Manual Verification:

- Open the seeded kosztorys editor: grid renders, autosave on a cell persists, add section / add item
  work, „dodaj sekcję z szablonu" lists and applies a preset.

---

## Phase 5: Snapshot format comment

### Overview

No version bump — but the reasoning must be written down, because the next person dropping a column
will read this comment and needs to know a dropped-and-never-read field is exempt.

### Changes Required:

#### 1. Amend the schema-version comment

**File**: `src/lib/kosztorys/snapshot-format.ts` (the `SNAPSHOT_SCHEMA_VERSION` comment block)

**Intent**: Record why dropping two persisted fields does **not** bump the version.

**Contract**: Extend the existing block with the rule: a **dropped** field is non-breaking when nothing
ever read it — the restore mapper simply ignores the stale key, so an old snapshot still restores.
Note the asymmetric cost of bumping (list queries don't assert, so the versions list and the preset
picker would offer entries that throw on use) and cite the `20260724_1` section-coeff precedent.
`SNAPSHOT_SCHEMA_VERSION` stays `1`.

### Success Criteria:

#### Automated Verification:

- Roundtrip specs green: `pnpm exec vitest run src/__tests__/lib/kosztorys/serialize-restore-roundtrip.test.ts`
- Preset specs green: `pnpm exec vitest run src/__tests__/lib/kosztorys/serialize-apply-preset.test.ts`

#### Manual Verification:

- Restore a snapshot captured **before** the migration on a seeded investment — it restores without
  error and the tree is intact (the stale key is ignored).
- Apply a global preset captured before the migration — same.

---

## Phase 6: Documentation

### Overview

The half of this change with real judgement. Three surfaces, three different treatments.

### Changes Required:

#### 1. Rewrite the „OTWARTE" section as resolved

**File**: `context/reference/kosztorys-editor-domain-notes.md:385-478`

**Intent**: The section is the **only** written record of _why_ the per-pozycja grain was wrong. Keep
that; delete everything that presents a dead design as pending work.

**Contract**:

- Retitle: drop „(OTWARTE, duża zmiana)", mark it **ROZSTRZYGNIĘTE — wdrożone (EX-565)**.
- **Keep**: the owner's refutation („OR, nie AND", `:387-390`), the real-case escalation („etapy 1–2
  robił ktoś z narzędziami, etapy 3–4 bez" → grain = etap, `:392-395`), and the „koszt = Σ po etapach"
  formula (`:401`) — that is what shipped.
- **Delete**: the 3-level cascade block (`:408-427`) — level 1 names a column that no longer exists,
  levels 2–3 were never built and are not planned; the „do rozstrzygnięcia" list (`:466-473`); the
  „zasięg zmiany" paragraph (`:475-478`), which sizes work already done.
- **Rewrite** the „stan modelu app" block (`:454-464`) into a short _what shipped_ statement: variant
  lives on the etap (`kosztorys_stages.plane`), settlement keys off it, the global `PriceViewT`
  z/bez survives as the pricing view. Its current bullets assert now-false state (`:458` „ignoruje
  `row.costVariant`", `:463` „`costVariant` siedzi na `kosztorys_items`").
- The „widok mieszany" material (`:429-447`) and the „rozliczenie per pracownik" note (`:449-452`) are
  about the _etap_ plane, not the dead columns — keep, but re-tag anything still open as open **under
  the shipped model**, not under the cascade.
- **Register discipline**: this file speaks to the owner. Sheet/domain vocabulary in the prose;
  code identifiers only where the doc is already citing schema.

#### 2. Fix the remaining domain-notes mentions

**File**: same file, `:183-188`, `:198-199`, `:599`

**Contract**:

- `:183-188` — the „Wariant kosztu **PER POZYCJA** … Kaskada jak VAT" bullet is false today. Rewrite to
  the etap grain and drop the „Default sekcji → P11" pointer.
- `:198-199` — remove `cost_variant` from the item input list and `default cost_variant` from the
  section list.
- `:599` — **P11** („Domyślny wariant kosztu podwykonawcy … default sekcji, od którego dziedziczą
  pozycje") is moot. Mark it resolved-by-EX-565 rather than deleting the numbering, so surrounding
  P-number references don't silently shift.
- `:178` („Plan kosztu podwykonawcy = Σ `pomiar × cena_wariantu_kosztu_pozycji`") — verify while in the
  file; if it reads as per-pozycja variant, correct it to the etap plane.

#### 3. Correct the living DDD map

**File**: `context/domain/01-domain-distillation.md:64-65`

**Intent**: Surgical only. These are the doc's **only** two mentions; the rest was verified on commit
`2562a2e1` and stays untouched.

**Contract**: `:64` Sekcja — drop „carries `defaultCostVariant` +" (the per-section coeff overrides
clause is _also_ stale, killed by `20260724_1`; verify against `kosztorys-sections.ts` and correct if
so). `:65` Pozycja — drop „`costVariant`," from the field list. No KROK 4 drift row: that table tracks
_live_ doc-vs-code drift, and this drift is being fixed, not recorded.

#### 4. Un-stale the EX-430 plan

**Files**: `context/changes/ex-430-harden-bulk-insert-restore/plan.md:186`,
`context/changes/ex-430-harden-bulk-insert-restore/change.md:23`

**Intent**: That plan (`status: planned`) asks for a roundtrip fixture covering „every
discount/cost-variant/override combo". It cannot be written after this change.

**Contract**: Remove the `costVariant` axis from both lines. While there, remove the second stale axis
— „a section with both coeffs null and one with both set" — those coeffs were dropped by
`20260724_1_drop_kosztorys_section_coeff.ts`. Leave a one-line note in that change's `change.md`
recording that EX-575 narrowed the fixture, so the next reader knows the axes were removed
deliberately and not lost.

#### 5. Change bookkeeping

**Contract**: `change.md` → `status: implementing` at start, `done` at the end; EX-575 → Done in
Linear; no roadmap slice is involved (this is an ad-hoc Linear task, not a slice).

### Success Criteria:

#### Automated Verification:

- `grep -rn "cost_variant\|costVariant\|defaultCostVariant" context/` returns hits only under
  `context/archive/**` and this change's own `research.md` / `plan.md` / `change.md`
- `pnpm lint` passes (markdown formatting)

#### Manual Verification:

- Read `kosztorys-editor-domain-notes.md:385-…` end to end: it reads as a **closed** decision with the
  reasoning intact, and no sentence claims a column that does not exist.
- No mixed-register sentence introduced (sheet vocabulary vs code identifiers).

---

## Testing Strategy

No new tests. This is a **deletion of unreachable code** — there is no behavior to guard, and a
regression test for "the column is gone" is a schema assertion, which EX-430's planned schema-drift
guard will cover generically.

The existing suites are the regression net, and they are load-bearing here:

- `serialize-restore-roundtrip.test.ts` / `serialize-apply-preset.test.ts` — the insert-tuple/column
  alignment in Phase 3.2 is the one edit that could corrupt data silently; a column-shifted INSERT
  fails these immediately.
- `kosztorys-tree.db.test.ts` — the SELECT/mapper edits.
- `pnpm typecheck` — the completeness proof for carrier removal.

### Manual Testing Steps:

1. Seed `INV=6`, open the editor: grid renders, cell autosave persists, add/remove section and item.
2. Restore a **pre-migration** snapshot — restores clean, tree intact.
3. Apply a **pre-migration** global preset via „dodaj sekcję z szablonu" — applies clean.
4. Payload admin → a kosztorys section and item: „Domyślny wariant kosztu" is gone, save still works.

## Migration Notes

- **Local** (5433): `pnpm payload migrate` — agent may run. Restart any dev server booted before it.
- **Test** (5435): `pnpm db:migrate:test` — agent may run; also runs via `db:import:test` and
  `scripts/test-integration.sh`.
- **Preview**: `pnpm db:migrate:preview` — agent may run, **confirm first**.
- **Prod**: `pnpm db:migrate:prod` — **human only**, and **before** the code that needs it reaches
  `main`. The `.husky/pre-push` gate prompts only on a push to `main` that adds `src/migrations/*.ts`;
  a push to `staging` does not trigger it, so the reminder must not be relied on.
- No backfill, no compat shim, no two-step migration — kosztorys data is throwaway pre-dogfooding.

## References

- Ticket: **EX-575** (filed at the 2026-07-25 staging post-merge review gate)
- Research: `context/changes/2026-07-28-drop-cost-variant-columns/research.md`
- Change identity: `context/changes/2026-07-28-drop-cost-variant-columns/change.md`
- Precedent migration: `src/migrations/20260724_1_drop_kosztorys_section_coeff.ts`
- The feature that actually shipped: EX-565, commit `65db3ba9` (`kosztorys_stages.plane`)
- The commit that killed the only consumer: `6bd7c745`
- Colliding plan: `context/changes/ex-430-harden-bulk-insert-restore/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Drop the columns

#### Automated

- [x] 1.1 Migration applies clean on local: `pnpm payload migrate` — 68564aa3
- [x] 1.2 Test DB migrated: `pnpm db:migrate:test` — 68564aa3
- [x] 1.3 Both columns absent from `information_schema.columns` — 68564aa3

### Phase 2: Payload fields + TS carriers

#### Automated

- [x] 2.1 `pnpm generate:types` succeeds — 41032f1e
- [x] 2.2 `pnpm typecheck` enumerates the remaining carrier sites — 41032f1e

### Phase 3: Clear the carriers

#### Automated

- [x] 3.1 Type checking passes: `pnpm typecheck` — 881ebc01
- [x] 3.2 Linting passes: `pnpm lint` — 881ebc01
- [x] 3.3 `grep` over `src/` returns only `20260708_2` — 881ebc01

### Phase 4: Fixtures, seeds, and the JSON fixture

#### Automated

- [x] 4.1 Unit suite green: `pnpm test` — 881ebc01
- [x] 4.2 Integration suite green: `pnpm test:integration` — 881ebc01
- [x] 4.3 Both kosztorys seeds run clean against the migrated local DB — 881ebc01

### Phase 5: Snapshot format comment

#### Automated

- [x] 5.1 Roundtrip spec green — cd2326d3
- [x] 5.2 Preset spec green — cd2326d3

### Phase 6: Documentation

#### Automated

- [x] 6.1 `grep` over `context/` returns hits only in `archive/**` and this change's own docs — 837998df
- [x] 6.2 `pnpm lint` passes — 837998df
