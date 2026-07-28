---
date: 2026-07-28T16:43:28Z
researcher: K A
git_commit: 4d074f353f988b739621676b8c76933b5bb702aa
branch: staging
repository: wykonczymy
topic: 'EX-575 — drop the dead costVariant / defaultCostVariant columns'
tags: [research, codebase, kosztorys, schema, migration, tool-plane]
status: complete
last_updated: 2026-07-28
last_updated_by: K A
---

# Research: EX-575 — drop the dead `costVariant` / `defaultCostVariant` columns

**Date**: 2026-07-28T16:43:28Z
**Researcher**: K A
**Git Commit**: `4d074f353f988b739621676b8c76933b5bb702aa`
**Branch**: `staging`
**Repository**: wykonczymy

## Research Question

EX-575 claims `kosztorys_items.cost_variant` and `kosztorys_sections.default_cost_variant` are written,
read back, and plumbed onto every row object while nothing downstream branches on either. Verify or
refute that, then map every carrier, consumer, and persistence surface, and establish the blast radius
of deleting them.

## Summary

**The claim holds, and the columns are dead code rather than an unbuilt feature.** Four independent
lines of evidence:

1. **No genuine read exists.** Every one of ~60 non-generated references is a carrier — DDL, SQL,
   row mapper, type declaration, zod schema, object-literal write, or test/seed fixture. Nothing
   branches on, renders, compares, or calculates from either value. Settlement keys off
   `stage.plane` (`settlement.ts:32,44,154-169`); pricing keys off the active `view`
   (`calc.ts:58-74`), and `calc.ts` never sees a section or a `costVariant` at all.
2. **The one real consumer died 39 minutes after the columns were born.** `effectiveCostVariant`
   (`item.costVariant ?? section.defaultCostVariant`) landed in `76587b21` and was deleted in
   `6bd7c745` the same evening — a dead-code sweep of `calc.ts` that never looked at the schema.
   Since 2026-07-08 23:28 the columns have been pure plumbing.
3. **The owner explicitly rejected the per-item model.** `kosztorys-editor-domain-notes.md:392-395`
   (2026-07-21): „Ta sama praca: »etapy 1–2 robił ktoś z narzędziami, etapy 3–4 bez«. Czyli **grain
   wyboru wariantu to etap, nie praca**." Resolved at `:468`: „**ROZSTRZYGNIĘTE: per etap**". A
   per-item column cannot represent the case the owner brought.
4. **The concept shipped on the other carrier.** EX-565 (`65db3ba9`) put `plane` on
   `kosztorys_stages` with a header picker, icons, an unconfirmed-plane warning and the settlement
   math. Neither that slice nor the 2026-07-25 hardening migrated a value out of `cost_variant`,
   read it as a default, or listed it as future work.

**Nothing in the persistence layer breaks.** Every stored-payload consumer names its columns
explicitly or casts-and-picks; there is no spread-into-INSERT, no `jsonb_populate_record`, no zod
`.parse()` on a stored payload. Old snapshots and presets carrying the stale keys restore exactly as
they do today.

**The single open decision — `SNAPSHOT_SCHEMA_VERSION` — is settled by precedent, not judgement.**
`20260724_1_drop_kosztorys_section_coeff.ts` dropped `w_tools_coeff` / `own_tools_coeff` from the same
table, the same class of change, and the version was **not** bumped. Follow that. Bumping would hard-
reject every stored snapshot _and_ the entire global preset library, asymmetrically: the list queries
(`snapshots.ts:85`, `presets.ts:133,105`) don't assert, so the versions list and the „dodaj sekcję
z szablonu" picker would keep showing entries that throw a Polish error the moment you use them.

**The real risk is documentation, not data.** `context/reference/kosztorys-editor-domain-notes.md:414`
names `default_cost_variant` as level 1 of a cascade the doc labels **OTWARTE**. A future agent reading
it without git history would conclude the columns are a foundation for planned work.

## Detailed Findings

### A. Carrier / consumer inventory

Verdict: **zero genuine reads.** `e2e/` has zero hits. `src/payload-types.ts` hits are generated
(gitignored).

**Persistence**

| file:line                                                      | kind                                                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/migrations/20260708_2_add_kosztorys_sections_items.ts:15` | DDL — `"default_cost_variant" varchar NOT NULL DEFAULT 'w_tools'` |
| `src/migrations/20260708_2_add_kosztorys_sections_items.ts:40` | DDL — `"cost_variant" varchar` (nullable, no default)             |
| `src/lib/db/kosztorys-tree.ts:64,75`                           | SQL select (sections, items)                                      |
| `src/lib/kosztorys/insert-rows.ts:24,28,47,53`                 | SQL insert (VALUES tuple + column list)                           |

No later migration touches either column — the 2026-07-08 creation is the only DDL. Neither carries
an index, constraint, FK, CHECK, or pg enum (both plain `varchar`), and `kosztorys_items` has no
Payload versioning, so there is no `_kosztorys_items_v` twin (`20260716_0:8`).

**Mappers, types, schemas, writes**

| file:line                                                                 | kind                                                                                          |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/lib/db/kosztorys-tree.ts:132,149`                                    | row mappers (`:132` defends with `?? 'w_tools'` against a NULL the NOT NULL makes impossible) |
| `src/lib/kosztorys/types.ts:33,50,71,187`                                 | type decls — section field, item field, `ItemPatchT` pick, `KosztorysV2RowBaseT` row key      |
| `src/lib/kosztorys/row-ops.ts:30,55,62`                                   | `BlankRowInputT` decl + two literal writes                                                    |
| `src/lib/kosztorys/v2-rows.ts:17,44`                                      | `ITEM_FIELDS` entry (drives `diffRow`) + per-row denormalization                              |
| `src/lib/kosztorys/constants.ts:44-45`                                    | `NEW_SECTION_DEFAULTS.defaultCostVariant = 'w_tools'`                                         |
| `src/lib/kosztorys/create-section.ts:32`, `append-preset-sections.ts:56`  | object-literal writes                                                                         |
| `src/lib/actions/kosztorys.ts:49,58`                                      | zod branches in `itemPatchSchema` / `sectionPatchSchema`                                      |
| `src/collections/kosztorys-items.ts:46`, `kosztorys-sections.ts:37-43`    | Payload fields                                                                                |
| `src/components/kosztorys/editor/use-kosztorys-editor.ts:556-557,592,727` | feeds `buildBlankRow`                                                                         |

**Why no read is reachable** — the chain that closes it:

- No grid column binds `costVariant`. `assembleV2Columns`
  (`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:267-525`) builds every column; the
  only `keyCol(...)` bindings are `clientPrice`, `description`, `plannedQty`, `stage_<id>`, `note`
  (`:274,297,328,369,475`). `costVariant` appears nowhere in that 631-line file.
- Therefore `ITEM_FIELDS`'s `'costVariant'` entry is unreachable. `diffRow` (`v2-rows.ts:59-81`)
  compares `prev[f] !== next[f]` on values that only ever arrive through a column's
  setter / `pasteValue` / `deleteValue`. With no column bound, paste and bulk-fill included, the
  comparison can never be true. Row-mutating helpers (`patchRows`, undo/redo at
  `use-kosztorys-editor.ts:485,490`, `revertOne` at `row-ops.ts:18`) spread `{...r, …}`, carrying the
  field unchanged.
- Both `updateItemFieldAction` call sites (`use-kosztorys-editor.ts:503,1182`) are downstream of
  `diffRow`, so the zod branch at `actions/kosztorys.ts:49` is unreachable.
- `updateSectionFieldAction` has one call site (`use-kosztorys-editor.ts:920`) keyed through
  `SECTION_ROW_FIELDS = { sectionName: 'name', sectionColor: 'color' }` (`:917`).
  `defaultCostVariant` is deliberately absent, and the comment at `:895-897` says so out loud.
  `actions/kosztorys.ts:58` is likewise unreachable.

**The one caveat EX-575 does not mention:** both fields are **admin-visible and editable** in the
Payload panel — no `admin.hidden`, no `admin.readOnly`, and both are `type: 'text'` rather than
`select`, so the panel renders free-text inputs with no option list. An owner can type anything into
„Domyślny wariant kosztu"; it validates, persists, and does nothing. That makes the columns worse
than dead — they are actively misleading.

**`ToolPlaneT` carriers** (`types.ts:90-96` documents three; the comment is now half-fiction):

| carrier                                | file:line      | live?                                                                                |
| -------------------------------------- | -------------- | ------------------------------------------------------------------------------------ |
| `KosztorysStageT.plane`                | `types.ts:102` | **LIVE** — sole settlement input, UI-editable, patched via `StagePatchT`             |
| `KosztorysItemT.costVariant`           | `types.ts:50`  | dead                                                                                 |
| `KosztorysSectionT.defaultCostVariant` | `types.ts:33`  | dead — plus `sectionDefaultCostVariant` on every row of a potentially 1000+ row grid |

### B. Persistence and back-compat

**Storage shape** (from migrations; no DB touched): both are `payload jsonb NOT NULL` +
`schema_version integer NOT NULL`, neither a Payload collection — raw SQL only.

- `src/migrations/20260710_1_add_kosztorys_snapshots.ts:11-27` — `kosztorys_snapshots`,
  investment-scoped, `ON DELETE CASCADE`.
- `src/migrations/20260711_0_add_kosztorys_presets.ts:12-20` — `kosztorys_presets`, **global** (no
  `investment_id`), `UNIQUE(name)`.

**Read paths are tolerant, explicitly:**

| site                                        | mechanism                                                               | verdict                         |
| ------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------- |
| `insert-rows.ts:24,47`                      | hand-written VALUES tuple against a hand-written column list (`:28,53`) | field + column removed together |
| `insert-kosztorys-tree.ts:24-37`            | passes whole objects to the primitives above, no spread into SQL        | safe                            |
| `presets.ts:89`, `snapshots.ts:82`          | bare `as SnapshotPayloadT` cast — no zod, no runtime validation         | extra key silently ignored      |
| `presets.ts:106-123` (`listPresetSections`) | SQL reads only `sectionId`/`id`/`name`/`displayOrder` from the jsonb    | untouched                       |

One spread, benign: `append-preset-sections.ts:59` does `{ ...it, id, sectionId }` and returns preset
items to the client. A stale `costVariant` key rides into `treeToRows` (`v2-rows.ts:39`) but cannot
cause a phantom autosave — `diffRow` iterates only `ITEM_FIELDS` plus `STAGE_QTY_PREFIX` keys
(`v2-rows.ts:66-67`). Line `:56` is an explicit read and must be deleted with the field.

Serializers pick/spread symmetrically and shrink cleanly: `serialize-kosztorys.ts:11-12`,
`serialize-preset.ts:14-21`.

**`SNAPSHOT_SCHEMA_VERSION` — the only decision.** `snapshot-format.ts:8-11` says _"Bump only on a
non-additive payload change (a renamed/dropped field)"_, so the letter says bump. But `:13-16` gives
the rationale: reject because _"the tolerant mapper would seed wrong/missing columns"_. That failure
mode does not exist here — the mapper stops reading the field and the column stops existing, so an
old payload seeds exactly the rows it would today. **By its own rationale, do not bump**, and
`20260724_1_drop_kosztorys_section_coeff.ts` is the precedent (same class of change, no bump —
`snapshot-format.ts:16` still reads "Never bumped yet").

Consequence of bumping to `2`: `assertReadableSchemaVersion` (`snapshot-format.ts:17-23`) throws on
every stored row — every snapshot (`snapshots.ts:81`) and every preset (`presets.ts:88`) — while the
three list queries don't assert, so both pickers keep offering entries that error on use.

**Presets are the one thing worth flagging.** `kosztorys_presets` is global, has no investment FK, no
retention/GC, and is a hand-curated szablon library — not "a kosztorys" in the sense the
throwaway-data carve-out covers. This does not argue against the drop (which is invisible to them);
it argues against the version bump, which would brick the library.

Snapshots are inside the carve-out: auto/manual history capped at 7 days (auto) / 365 (manual),
`AUTO_KEEP = 50` (`snapshots.ts:17-20`).

**Seeds and fixtures** — every write is a hard-coded literal, nothing derived:
`perf-seed-kosztorys.ts:53`, `seed-kosztorys.ts:96`, `seed-kosztorys-bands.ts:49`,
`seed-kosztorys-reconciliation.ts:49`, `seed-sync-test-inv14.ts:47`, `seed-sync-test-inv67.ts:113`,
`seed-investment-from-sheet.ts:135,161` (literals) and `:232,260` (explicit reads — these must go or
the seed won't typecheck). `src/scripts/fixtures/kosztorys-bialostocka.json` holds 337 occurrences,
loaded at `seed-investment-from-sheet.ts:300` via `JSON.parse` with no validation — the file needs no
edit (regenerable with `REFETCH=1`, `:290-298`).

**External surfaces — neither field ever leaves the app.** Zero hits across `src/lib/google/**`
(so the frozen sheet column-position contract is untouched), zero in `src/lib/export/**` (CSV/print
export transfers, not kosztorys rows). The public client share (`client-kosztorys.ts:37-68`) ships
the full tree as RSC props with no projection — removing the fields just shrinks the payload; it is
not a versioned contract. No REST/JSON route serializes them. The two action zod schemas are plain
`z.object().partial()` — **non-strict**, so a stale browser tab posting `{ defaultCostVariant: … }`
after the drop has the key stripped and degrades to a `payload.update` no-op
(`actions/kosztorys.ts:128-130`), not a runtime error.

**Tests — 30 hits, all fixture literals, zero value assertions.** `e2e/` has none; the golden-master
and parity specs (`financial-golden-master-db.test.ts`, `investment-render-parity-db.test.ts`,
`lib/google/sheets-golden.test.ts`) have none, so `pnpm test:parity` is untouched. Two roundtrip
specs _look_ like they'd break and don't: `serialize-restore-roundtrip.test.ts:182-222` compares
`canonical(after)` to `canonical(before)` where **both sides** come from the post-change serializer,
so the comparison is symmetric whatever the field set; `serialize-apply-preset.test.ts` uses the same
`canonicalTree` pattern, and its `'own_tools'` literal at `:386` proves a preset overwrite by section
_name_ (`'Nowa treść'`, `:384`), not by the variant. Also delete the explanatory comment at
`kosztorys-tree.db.test.ts:29-30`.

**Runtime-error risk from an old stored payload: none found.** The only way to turn this drop into a
runtime error is to bump the schema version.

### C. Migration mechanics

Template, confirmed identical across the four most recent migrations
(`20260726_4:1-19`, `20260726_3:1-27`, `20260726_2:1-21`, `20260724_1:1-20`): one import from
`@payloadcms/db-vercel-postgres`, a `// Hand-written (migrate:create's snapshot baseline is stale —
see AGENTS.md).` comment plus 2-6 lines of _why_, then `up`/`down` each issuing a single
`await db.execute(sql\`…\`)` with semicolon-separated statements. Idempotency (`IF EXISTS`/`IF NOT EXISTS`) is universal in practice.

Naming: `YYYYMMDD_<seq>_<snake_case>.ts` with a **single-digit unpadded** counter restarting at 0 per
date. Ordering is load-bearing — `node_modules/payload/dist/database/migrations/readMigrationFiles.js`
does `readdirSync().sort()` and filters out `index.ts`, so **filename lexical sort is the run order**
(`payload.config.ts:50` passes only `migrationDir`). Latent hazard: the unpadded counter breaks at 10
(`_10_` sorts before `_2_`); max so far is 4.

Correct filename today: **`src/migrations/20260728_0_drop_kosztorys_cost_variant.ts`**.

`down` is written faithfully by every migration including the drops (`20260724_1:15-19`,
`20260716_0:16-18`) but is **never run** — no `migrate:down` / `refresh` / `reset` script exists and
there are zero invocations repo-wide. It must restore the original DDL exactly; it need not preserve
data.

Copy-ready:

```ts
import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// <WHY: 2-4 lines — the per-item cost-variant tier never had a consumer; the concept
// shipped on kosztorys_stages.plane (EX-565).>
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

`src/migrations/index.ts` — import after line 64, array entry after line 386. (Payload doesn't read
this file, but every migration is listed there; skipping it would be the odd one out.)

Apply story:

| env             | command                                                                                                                                                                              | who                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| local dev 5433  | `pnpm payload migrate` (no `db:migrate` script exists; picks up `DB_POSTGRES_URL`)                                                                                                   | agent                |
| e2e test 5435   | `pnpm db:migrate:test`; also auto-runs at the tail of `db:import:test` and inside `scripts/test-integration.sh:30`, which re-imports whenever the migration-file fingerprint changes | agent                |
| preview/staging | `pnpm db:migrate:preview` — needed after merge or staging throws `column does not exist`                                                                                             | agent, confirm first |
| prod            | `pnpm db:migrate:prod`                                                                                                                                                               | **human only**       |

`pnpm build` is `generate:importmap && generate:types && next build` — no migrate, so a Vercel deploy
can never change schema. `.husky/pre-push:22-29` prompts only on a push to `main` that **adds** a
`src/migrations/*.ts` (`--diff-filter=A`); pushes to `staging` don't trigger it. The rest of pre-push
always fires: typecheck, vitest, `test:integration`, `test:parity`, `db:dump`.

Post-apply: `payload migrate` printing `Done.` is not verification — restart any dev server that
booted before it, or it keeps serving stale `column does not exist` (`lessons.md:180-184`).

### D. History

| when             | commit                | what                                                                                                                                                                                                                                                                             |
| ---------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-08 22:45 | `a2dbebb0`            | Both columns born, with the intent comment „costVariant = null = »dziedzicz z sekcji«".                                                                                                                                                                                          |
| 2026-07-08 22:49 | `76587b21`            | The only consumer written: `effectiveCostVariant(item, section) => item.costVariant ?? section.defaultCostVariant`. Nothing called it — the commit says the stage/cost functions were "ported unused".                                                                           |
| 2026-07-08 23:28 | `6bd7c745`            | The consumer deleted in a `calc.ts` dead-code sweep — _"drop superseded client-price-only cluster (… effectiveCostVariant) — 0 refs"_. Deliberate for the function, oblivious to the schema. **The columns have been inert since this commit.**                                  |
| 2026-07-20       | `fe143fbe`/`88fcf326` | Client-share added a leak-boundary comment treating `costVariant` as a subcontractor-price input — already false. `d270ff22` later deleted that projection.                                                                                                                      |
| 2026-07-24       | `65db3ba9`            | EX-565 lands the real feature on `kosztorys_stages.plane`. `cost_variant` is not consulted, not migrated onto, not deprecated — bypassed.                                                                                                                                        |
| 2026-07-25       | `8ef4a3e5`            | `CostVariantT` + `StagePlaneT` merged into `ToolPlaneT` (EX-548 arc). Commit body: _"Columns and field names are untouched — that is a migration, not a rename."_ **Net effect: two dead fields now share a type name with the one live carrier, so they read as load-bearing.** |
| 2026-07-25       | `00a97318`            | EX-575 filed from the review-gate ledger.                                                                                                                                                                                                                                        |

Was there ever UI? **No.** `git grep costVariant` across every reachable commit, restricted to
`src/components/**`, `src/lib/tables/**`, `src/app/**`, returns one file ever —
`src/components/kosztorys/client/to-grid-rows.ts`, and that was a type-satisfying stand-in whose own
comment said _"Nothing reads them"_. The only human-facing surface has always been the Payload admin
panel's plain text field.

One correction to the EX-575 filing: the columns went inert on **2026-07-08**, not at EX-489. EX-489
explains why they will never come back, not when they died.

## Code References

- `src/lib/kosztorys/types.ts:33,50,71,90-96,187` — the four type carriers and the three-carrier comment
- `src/lib/db/kosztorys-tree.ts:64,75,132,149` — SQL select + row mappers
- `src/lib/kosztorys/insert-rows.ts:24,28,47,53` — the only INSERT paths
- `src/lib/kosztorys/v2-rows.ts:17,44,59-81` — `ITEM_FIELDS`, per-row denormalization, `diffRow`
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:267-525` — every grid column; no binding
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:895-897,917,920` — the comment naming the absent third pathway
- `src/lib/kosztorys/settlement.ts:30-33,44,146-172` — what settlement actually reads
- `src/lib/kosztorys/calc.ts:58-74,96-100,140-151` — what pricing actually reads
- `src/lib/kosztorys/snapshot-format.ts:8-23` — the version rule and its rationale
- `src/migrations/20260724_1_drop_kosztorys_section_coeff.ts` — the precedent drop, no version bump
- `src/migrations/20260708_2_add_kosztorys_sections_items.ts:15,40` — the DDL to reverse

## Architecture Insights

- **A type merge can resurrect dead code's appearance without resurrecting its behavior.** `8ef4a3e5`
  was a correct EX-548 move (one concept, one name) that had an unintended cost: giving three carriers
  one type name erased the visual cue that two of them were vestigial. Generalizable — when unifying a
  type across carriers, check that every carrier is live first, or the unification launders the dead
  ones.
- **A comment can outlive the code it describes and become a spec for work nobody plans to do.**
  `kosztorys-items.ts:9` and `kosztorys-sections.ts:5-6` assert a section→item cascade with zero
  implementing code; the resolver was deleted 39 minutes after it was written. The AGENTS.md doc-
  lifecycle rule applies to code comments too.
- **`ItemPatchT` documents itself as "the subset of fields editable in the grid"** (`types.ts:55`) and
  is wrong about `costVariant`. Because `ITEM_FIELDS` is `satisfies readonly (keyof ItemPatchT)[]`,
  dropping the field from `ItemPatchT` cleans `v2-rows.ts:17` and `actions/kosztorys.ts:49` with
  type-checker backing — the deletion is self-verifying, which is exactly the shape `lessons.md:33-38`
  (gate annotation removal on `tsc`) asks for.
- **Tolerance in a restore path is a property of how the mapper is written, not a promise.** This one
  is tolerant because every consumer names its columns; the same drop against a
  `jsonb_populate_record` or a strict zod parse would be a breaking change. Read the mapper before
  assuming either.

## Historical Context (from prior changes)

- `.review-gate/staging-post-merge-kosztorys-refactors.md` — where EX-575 was filed; its ledger
  already reached this conclusion and deferred the schema change deliberately.
- `context/archive/2026-07-23-etap-tool-plane/` — EX-565, the slice that built the concept on
  `stage.plane`.
- `context/archive/2026-07-24-remove-section-coeff/plan.md:100,106,384` — the precedent drop of two
  sibling columns from the same table, including its local-verify step.
- `context/archive/2026-07-08-kosztorys-sections-items/plan.md:134,143` — the original schema plan
  that introduced the cascade intent.

## Docs that need updating with this change

Per the AGENTS.md doc-lifecycle rule, these become factually wrong on deletion:

- **`context/reference/kosztorys-editor-domain-notes.md` — the highest-value fix.** The section
  „Wariant »z narzędziami / bez narzędzi« — model się rozjeżdża (OTWARTE, duża zmiana)" (`:385-478`)
  is marked OTWARTE but was superseded and shipped by EX-565. `:414` names
  `kosztorys_sections.default_cost_variant` as level 1 of a three-level cascade („już istnieje").
  Also `:183-188` (the per-item cascade in the domain model — already wrong today), `:198-199` and
  `:599` (field inventory + P11 „Domyślny wariant kosztu podwykonawcy", now moot).
- **`context/domain/01-domain-distillation.md:64-65`** — living domain doc, cites the two fields with
  file:line as current truth.
- **Code comments that die with the fields**: `src/collections/kosztorys-sections.ts:5-7`,
  `src/collections/kosztorys-items.ts:9`, `src/lib/kosztorys/types.ts:2,92-93`.

## Open Questions

1. **`SNAPSHOT_SCHEMA_VERSION`** — research recommends **no bump**, on the version rule's own
   rationale plus the `20260724_1` precedent. Wants an explicit owner decision because the letter of
   the comment says otherwise; if we hold at 1, amend that comment to record why a dropped-but-unread
   field is exempt, or the next reader hits the same fork.
2. **Coordination with the in-flight `ex-430-harden-bulk-insert-restore` change** (`status: planned`).
   Its `plan.md:186` specifies a wide-field roundtrip fixture covering _"every discount/cost-variant/
   override combo"_, and `change.md:23` repeats it. That plan is already stale on a second axis — it
   also asks for "a section with both coeffs null and one with both set", and those coeffs were
   dropped by `20260724_1`. Either land EX-575 first and strip both axes from that plan, or accept
   that EX-430 would author a new test asserting a dead column.
3. **Does the Payload admin panel's editability change the disposition?** It shouldn't — the field
   does nothing — but it is worth one sentence to the owner in case someone has been typing into
   „Domyślny wariant kosztu" and believing it. No code reads it, so no behavior was ever affected.
