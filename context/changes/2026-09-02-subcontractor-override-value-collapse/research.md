---
date: 2026-09-02T11:24:25+0200
researcher: Claude Opus 5
git_commit: 45f7c9ffc38a63632bed18ebe35f0213bc81833e
branch: staging
repository: wykonczymy
topic: 'EX-766 — collapsing the subcontractor override pair into `overrideValue: number | null`'
tags: [research, codebase, kosztorys, migration, snapshots, presets, golden-master]
status: complete
last_updated: 2026-09-02
last_updated_by: Claude Opus 5
last_updated_note: 'Second research pass — adversarial verification of pass one, naming/UI surface, and concrete migration/blob/hash drafts'
---

# Research: EX-766 — collapsing the subcontractor override pair into `overrideValue: number | null`

**Date**: 2026-09-02T11:24:25+0200
**Researcher**: Claude Opus 5
**Git Commit**: `45f7c9ffc38a63632bed18ebe35f0213bc81833e`
**Branch**: `staging`
**Repository**: wykonczymy

## Research Question

Collapse the per-item subcontractor price override from a two-field pair
(`SubcontractorOverrideTypeT = 'amount'` + a `numeric NOT NULL DEFAULT 0` value) into a single
`overrideValue: number | null`. What does the change actually touch, what does it cost, and in what
order can it safely ship?

## Summary

**The collapse is information-preserving and worth doing. The refactor is the easy half; the data is
the hard half — and it is harder than the issue assumed.**

Three findings reshape the change:

1. **Production is not empty.** 3671 `kosztorys_items` rows across 11 investments. The AGENTS.md
   carve-out ("kosztorys data is throwaway while production holds no kosztorys rows") had a
   self-destruct condition written into it; that condition has fired, and the bullet was deleted on
   2026-09-02. A real backfill is now owed where the issue assumed none.
2. **The unauthenticated `/k/[token]` share link is on the read path.** So the transitional window of
   a one-file ADD+DROP migration hands an investor a 500, not a degraded admin table. The migration
   must split across two deploys — this is exactly `lessons.md:1482`.
3. **The real risk is the serialized payloads, not the columns.** `kosztorys_presets` and
   `kosztorys_snapshots` carry `wToolsOverrideType` verbatim inside JSON, which no `DROP COLUMN`
   reaches. In every stored blob a `null` type sits beside `"…OverrideValue": 0`. After the collapse
   `0` means "explicit 0 zł", so restoring a legacy blob would **silently price ~138 auto planes at
   zero** instead of letting them follow the global mnożnik.

The columns themselves collapse cleanly on the data that exists: every discriminating read branches
on the **type**, never on `value === 0` — verified exhaustively. So `{amount, 0}` → `0` and
`{null, 0}` → `NULL` is a bijection over production.

> **Corrected 2026-09-02 (follow-up pass).** An earlier draft of this paragraph claimed
> `{type: null, value: v≠0}` is _unreachable_, because `clear` force-zeroes the value alongside the
> type (`src/lib/kosztorys/subcontractor-price-edit.ts:47`). **That is wrong** — see
> [Follow-up Research](#follow-up-research-2026-09-02) §F1. The state is reachable and durable, and
> the migration must therefore discard the value column rather than carry it.

## Detailed Findings

### 1. Is `0` distinguishable from "auto"? Yes, everywhere

The single decision point, `src/lib/kosztorys/calc.ts:116-121`:

```ts
export function subcontractorPrice(row: ViewPricingT, view: ToolPlaneT): number {
  if (overrideTypeFor(row, view) === 'amount') {
    return view === 'w_tools' ? row.wToolsOverrideValue : row.ownToolsOverrideValue
  }
  return row.clientPrice * effectiveCoeff(row, view)
}
```

and its SQL twin at `src/lib/db/kosztorys-subcontractor-due.ts:39-49`. Both branch on the type alone.
**No code path anywhere treats `value === 0` as "no override".**

The explicit flat zero is a _designed_ state, produced by the sheet import:
`src/lib/kosztorys/sheet-import/derive-override.ts:26` — `if (rate <= 0) return { type: 'amount', value: 0 }`,
with the reasoning spelled out at `:11-14` (a blank rate in the owner's sheet means 0, **not** "inherit
the coefficient"; a `null` there would invent a cost the sheet never has). That comment block is the
canonical statement of why `0 ≠ null` and must survive the refactor verbatim.

The one place `0` is special-cased is a diagnostic, not pricing:
`src/lib/kosztorys/row-conditions.ts:365,375` reads the _computed_ price, so it is unaffected.

### 2. The legacy `'coeff'` trap — the value slot holds a RATIO, not a price

`subcontractorOverrideType` (`calc.ts:94-96`) is a total fold: anything that is not `'amount'` reads
as auto. It exists because a pre-cut row can carry `'coeff'`, and **its value slot then holds a
coefficient like `0.65`, not a złoty amount** (`calc.ts:88-92`).

`overrideValue: number | null` cannot express that state. So the migration must write `NULL` for such
rows and **must not carry the value across** — a `0.65` surviving as a number becomes a 0,65 zł kwota.

Reality check on `dumps/dump-latest.sql` (prod, 2026-09-02): **zero `'coeff'` rows survive**, and zero
rows have a NULL type beside a non-zero value. Observed pairs only: `(NULL,NULL)` 1045,
`(NULL,'amount')` 14, `('amount','amount')` 2612. The legacy state lives **only in snapshot/preset
JSON and in the specs** — but the migration should still be written defensively, because `down` can
never restore what it discards.

### 3. Serialized payloads — the finding that reshapes the change

| table                 | rows                                             | carrying the field                          | values                                                                   |
| --------------------- | ------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------ |
| `kosztorys_presets`   | 1 (`kosztorys wzrór test`, `schema_version = 1`) | 1                                           | 235 × `"amount"`, **138 × `null`, each paired with `…OverrideValue: 0`** |
| `kosztorys_snapshots` | 16                                               | 5 (the other 11 are empty-tree manual rows) | same split                                                               |

The preset is the **hand-curated global szablon** and the seed source for the whole work catalogue —
`lessons.md:750` explicitly states preset data is _not_ covered by the kosztorys throwaway carve-out.
It must not be thrown away.

Serialization is by spread, so the type rides along: `src/lib/kosztorys/serialize-kosztorys.ts:15-21`,
`serialize-preset.ts:14-15` (which deliberately _retains_ prices and overrides while stripping
quantities), `snapshot-format.ts:47`.

**What misreads a legacy blob after the change:**

- `src/lib/kosztorys/insert-rows.ts:123` — the single restore/apply/append INSERT. Today it writes
  `${it.wToolsOverrideType ?? null}, ${it.wToolsOverrideValue}`. After the drop it writes the value
  alone, so every stored `{type: null, value: 0}` becomes a **non-NULL `0`** — auto silently becomes
  0 zł. Reached from `restore-kosztorys.ts:38`, `apply-preset.ts`, `append-preset-sections.ts:46`,
  `seed-from-preset.ts:34`.
- `src/lib/kosztorys/work-catalogue/catalogue-rate.ts:13` — the same 138 planes become `0 zł`
  catalogue rates on a re-seed.

`SNAPSHOT_SCHEMA_VERSION = 1` (`snapshot-format.ts:18`) has never been bumped.
`assertReadableSchemaVersion` (`:24-31`) fires **only on full-payload reads** — `snapshots.ts:81`,
`presets.ts:89` — and **not** on any list path (`snapshots.ts:85`, `presets.ts:106`, `presets.ts:134`).
So a bump keeps every stale entry visible in the picker and fails at click time.

**This is not the "dropped field nobody read" exemption from `lessons.md:750`.** The type _was_ read,
and its absence flips the meaning of the surviving value. The change owes either a version bump (plus
accepting click-time failure on the list paths) or — cheaper and better, given it is 1 preset + 5
snapshots — **a one-shot jsonb rewrite mapping `{type: null, value: 0}` → `{value: null}`**.

### 4. Deploy order — split into two migrations across two deploys

**Read paths and auth posture:**

| Route                                                         | Auth                                                                                                                                           | Reaches                                                  |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **`src/app/(share)/k/[token]/page.tsx:13`**                   | **PUBLIC, cookie-less** (`(share)/layout.tsx:7-9`; `preview-kosztorys.ts:46-47,128` reads with `overrideAccess: true`; no `src/middleware.ts`) | `selectKosztorysTreeData`                                |
| `src/app/(share)/podglad-inwestora/[id]/page.tsx:12`          | authenticated                                                                                                                                  | same                                                     |
| `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:42` | authenticated                                                                                                                                  | same                                                     |
| `src/app/(frontend)/inwestycje/page.tsx:4`                    | authenticated                                                                                                                                  | `kosztorys-subcontractor-due.ts:26`                      |
| `src/app/(frontend)/katalog-prac/page.tsx:12`                 | authenticated                                                                                                                                  | `work-catalogue.ts:105`                                  |
| `/admin` → `kosztorys-items`                                  | Payload admin                                                                                                                                  | SELECT built from `collections/kosztorys-items.ts:46-49` |

The columns are named **explicitly** in three raw SELECTs and in the Payload field list, so an old
deploy against a migrated DB throws Postgres **42703 on the public share link**.

**The verdict, argued from which window is survivable (`lessons.md:1503`), not from the word DROP:**

- **Migration A — additive direction, ships with the code.**
  `ALTER COLUMN *_override_value DROP NOT NULL` (+ `DROP DEFAULT`) on both planes. Precedent:
  `20260901_1_work_catalogue_auto_rates.ts:11-12`, `20260827_0_payment_method_nullable.ts:8-10`.
  Migrate-first window: old code keeps writing non-NULL — nothing observable. Push-first window: new
  code writes NULL and Postgres refuses with a loud, bounded `23502`. Migrate-first is quieter.
  This deploy also carries the whole code collapse and the jsonb rewrite.
- **Migration B — `DROP COLUMN` ×2, authored only AFTER the A deploy is live.** Per `lessons.md:1482`
  rule 2, a migration file that exists rides the next `pnpm db:migrate:prod`, so writing it early
  reinstates the very window the split avoids. Park it in a Linear issue. Dead columns sitting in prod
  for one cycle is the correct price, not a smell.

**Migration house style** (from the newest three files): hand-written, opening
`// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).`, then the deploy
order _with its justification_; `down` a real inverse with `IF EXISTS` guards; naming
`YYYYMMDD_<n>_snake_case.ts` with a bare per-day counter (pad only past `_9_`, `lessons.md:769`).
`kosztorys_items` has **no Payload versioning twin**, so no `_v` table to adjust
(`20260818_0:12-13`). Closest precedent for a kosztorys column drop:
`src/migrations/20260818_0_drop_kosztorys_hidden_in_export.ts`.

**Pre-existing drift found in passing:** `20260901_1_work_catalogue_auto_rates.ts` is committed but
missing from `src/migrations/index.ts`. Harmless for `payload migrate` (the CLI reads the directory
and excludes `index.ts`), but worth fixing.

### 5. Code surface

**Reads** (`overrideTypeFor` / `subcontractorOverrideType` / raw columns): `calc.ts:79-86,94-96,117` ·
`kosztorys-subcontractor-due.ts:40-46` · `kosztorys-tree.ts:74-75,150-153` ·
`work-catalogue.ts:111-112,126-129` · `row-conditions.ts:113,200,209,218,227` · `sort-value.ts:80` ·
`work-catalogue/catalogue-rate.ts:13` · `work-catalogue/append-catalogue-items.ts:74` ·
`subcontractor-price-edit.ts:18` · `subcontractor-columns.tsx:107,148,198` · `constants.ts:5-11`
(`OVERRIDE_FIELDS`) · `v2-rows.ts:13-16` (`ITEM_FIELDS`) · `types.ts:24,50-53,69-72` ·
`work-catalogue/types.ts:56-59` · `sheet-import/parse-labor-tab.ts:23`.

**Writes**: `insert-rows.ts:32-35` (`ITEM_INSERT_COLUMNS` — the hand-written array `lessons.md:529`
warns about) + the positional tuple at `:123`, which must shrink 4→2 in lockstep ·
`actions/kosztorys.ts:44,63-66` · `collections/kosztorys-items.ts:46-49` ·
`subcontractor-price-edit.ts:22-28,46,47,66-67` · `sheet-import/build-import-plan.ts:199-216` ·
`work-catalogue/append-catalogue-items.ts:34-37` · `row-ops.ts:52-55` · `footer-totals.ts:51-54` ·
`build-sheet-comparison.ts:102-105` · `item-to-catalogue.ts:21-24` · `perf-seed-kosztorys.ts:83-86`.

**No Payload hook touches these fields** — `collections/kosztorys-items.ts:26-29` carries only cache
revalidation.

**Nothing carries the type OUT of the app.** `src/lib/google/**` has zero `override` hits; the Sheets
sync writes transfers/expenses tabs only, and the sheet integration reads kosztorys _in_, never out.
`column-config.ts:162` notes the „Źródło ceny wykonawcy" column is never assembled in the client view.

**What gets strictly better:**

- `v2-rows.ts` `diffRow` compares fields independently, so a source switch currently emits a **two-key
  patch** while a value edit emits one. One field means one patch key — a whole class of half-patch
  disappears.
- `undo-coalesce.ts:29` keys on `${id}:${field}`, so one user gesture currently produces two
  separately-coalesced undo entries. Collapsing fixes undo granularity as a side effect.
- `append-catalogue-items.ts:34-37` currently encodes a nullable number _into_ the pair
  (`rate === null ? null : 'amount'` + `?? 0`) and `catalogue-rate.ts:13` decodes it back. The whole
  round-trip vanishes — the catalogue already stores exactly the target shape.

**Three traps in the code half:**

1. `collections/kosztorys-items.ts:47,49` — `defaultValue: 0` must go with the type field. Payload's
   `getFallbackValue` treats a stored `NULL` as _present_ and backfills the default, so leaving it
   turns "auto" into "explicit 0 zł" on the first partial `/admin` update. Same family as
   `lessons.md:1503`.
2. `actions/kosztorys.ts` — `z.coerce.number()` yields `0` for `null`. The `nullable()` must **wrap**
   the coercion, not follow it.
3. `kosztorys-subcontractor-due.ts:40-46` — the existing `coalesce(ki.w_tools_override_value, 0)`
   becomes actively wrong once NULL carries meaning; it must be removed, not kept "for safety".

**One open UI decision:** with a one-member union the „Źródło" picker column
(`subcontractor-columns.tsx:148`, `modeChange`) is already a two-state toggle. After the collapse it
can stay as an auto/kwota toggle or be deleted, since typing a number already sets the source and
clearing the cell already returns to auto. Not a correctness question — an owner-facing one.

### 6. Test surface

**No E2E leg** — the only `e2e/` hit is an unrelated comment. This is a pure Vitest surface.

**Dies with the type column:** `kosztorys-calc.test.ts:388-420` (the whole legacy-`coeff` fold,
including "prices a legacy wiersz at 20 × 0,65 = 13"). Its behaviour must move to a **migration test**
(`'coeff'` rows land as `NULL`) or be deleted with a written rationale. Keeping
`subcontractorOverrideType` alive as `v => v === 'amount'` over a number column is the tautology
`lessons.md:350` warns about.

**Goes tautological:** `row-conditions.test.ts:288-313` — the manual-rate/formula-rate complementarity
iterates three subjects, two of which collapse into one. Stays green, covers less.

**The highest-value spec in the change:** `row-conditions.test.ts:171-193` — `no-w-tools-price` fires
on an explicit 0 but not on inherited auto. It is the direct behavioural proof that `NULL ≠ 0`.
**Write it red first** against `overrideValue: 0` vs `overrideValue: null`.

**Landmine:** `subcontractor-price-edit.test.ts:107,157` assert `clear` → `{type: null, value: 0}`.
The correct post-collapse assertion is `overrideValue: null`; asserting `0` there would silently
re-introduce the ambiguity the refactor removes. Second-best NULL≠0 proof:
`sheet-import/build-import-plan.test.ts:182,206-209`, which must become `0` and **must not** become
`null`.

**Change the two shared fixture helpers first — they ripple:** `helpers/kosztorys-tree.ts:37-40`,
`helpers/kosztorys-db-tree.ts:92-95`. Roughly 16 further specs then need a purely mechanical fixture
rewrite.

**Free guards, do not weaken:** `insert-schema-drift.test.ts:22-27,44-60` asserts set-equality between
`ITEM_INSERT_COLUMNS` and `information_schema.columns`; `kosztorys-tree-sql-drift.test.ts` does the
same for the tree SELECT. Both go red in any window where code and schema disagree, which is the
point.

### 7. The golden master — how to avoid regenerating it at all

`financial-golden-master-db.test.ts:180-198` hashes both override columns into a per-investment
`overrides` md5. A changed hash makes `inputsUnchanged()` (`:459`) false, which pushes the investment
into `dataMoved` and **skips its money comparison** — so a naive rewrite silently un-guards every
kosztorys-carrying investment. The `AXES` guard (`:471-491,502-511`) throws rather than passing
quietly, but the message is "re-seed and regenerate", which is the rubber stamp `lessons.md:233-235`
warns about.

**Best option: write the new hash SQL so it produces the same string for the same money.**
`coalesce(ki.w_tools_override_value::text,'')` yields a different string than `'amount:50:…'`, but
`case when type = 'amount' then value::text else '' end` **normalises both eras** — the hash is
unchanged for every existing row, no regeneration is needed, and every money figure stays guarded
straight through the refactor. This should be in the plan.

If regeneration proves unavoidable: `pnpm test:golden:update` after `pnpm db:import:test`, then diff
`investments`/`registers`/`workers` (plain rounded numbers, not hashes — `round2` at `:278-300`) while
ignoring `inputHashes`, so a moved złoty is directly visible rather than buried.

**Pre-existing staleness to fix before starting, not caused by this change:** the committed fixture
was taken when the dump carried zero kosztorys rows. The current dump gives 11 investments a `/k:`
hash segment they did not have, so they now report as `dataMoved` and their money figures are
**un-compared**. 11 of 115 is under the `total/2` floor (`:434-441`), so nothing fails — the net just
quietly shrank. **Regenerate the fixture on a freshly imported DB before touching EX-766**, or the
baseline being diffed is dishonest.

### 8. `seed:kosztorys:test` — the open question, answered

`package.json` wires it to `src/scripts/perf-seed-kosztorys.ts` (INV=7), **not** `seed-kosztorys.ts`
(which reads a live Google Sheet, defaults to INV 6, and is dev-only). It wipes sections and stages
**scoped to investment 7** (`perf-seed-kosztorys.ts:23-34`); items cascade.

The dump's 3671 rows belong to investments **9, 14, 19, 21, 45, 54, 61, 90, 106, 137, 138** —
**investment 7 is not among them.** The two datasets are disjoint, so the seed destroys nothing.

It is no longer needed for the `DATASET_FLOOR` (`kosztorysItems > 20` now clears on the dump alone),
but it **remains load-bearing for the fixture**: the committed golden master's only `/k:` investment is
`'7'` with `kosztorysItemCount: 1000`. Skip the seed and investment 7 falls out of the compared set and
the kosztorys axis throws. **Keep running it.**

## Code References

- `src/lib/kosztorys/calc.ts:79-96,116-121` — `overrideTypeFor`, the `'coeff'` fold, `subcontractorPrice`
- `src/lib/kosztorys/subcontractor-price-edit.ts:9-68` — the whole pair abstraction
- `src/lib/kosztorys/sheet-import/derive-override.ts:4-32` — why `0 ≠ null`, in prose
- `src/lib/kosztorys/insert-rows.ts:32-35,123` — `ITEM_INSERT_COLUMNS` and its positional tuple
- `src/lib/db/kosztorys-subcontractor-due.ts:39-49` — the SQL twin, with the `coalesce(…, 0)` trap
- `src/collections/kosztorys-items.ts:46-49` — the Payload fields and the `defaultValue: 0` trap
- `src/app/(share)/k/[token]/page.tsx:13` — the public route that sets the deploy order
- `src/__tests__/financial-golden-master-db.test.ts:180-198,459,471-511` — the fingerprint
- `src/__tests__/lib/kosztorys/row-conditions.test.ts:171-193` — the NULL≠0 proof to write red first

## Architecture Insights

- **A one-member union is a boolean in disguise, but the ceremony around it is not always noise** —
  here the type column is what makes a legacy value _unreadable-safely_, which is precisely the
  property being given up. The collapse is right because the legacy state no longer exists in the
  data, not because the union was always pointless.
- **The pair's real cost was never the type — it was the two independent wire fields.** Diff, patch and
  undo all key on field name, so one concept spread across two fields produced two-key patches and
  split undo entries. Collapsing fixes that as a side effect, and that is a better argument for the
  change than tidiness.
- **A column drop does not reach a serialized payload.** Any refactor of a field that appears inside
  `kosztorys_presets` / `kosztorys_snapshots` JSON owes an explicit decision about stored blobs — and
  the preset library is curated global data, not throwaway.

## Historical Context (from prior changes)

- `context/foundation/lessons.md:1482` — an ADD+DROP in one migration has no safe order when a public
  route reads the table; split it, and do not author the DROP early. **Directly governs this change.**
- `lessons.md:1503` — classify by which window is survivable, not by whether the SQL says DROP; and an
  ORM will manufacture the value that fails validation.
- `lessons.md:750` — the preset library is global and curated; do not bump
  `SNAPSHOT_SCHEMA_VERSION` on the letter of the rule, and check which list paths assert it.
- `lessons.md:598` — a golden master over a borrowed dataset needs a dataset fingerprint checked first.
- `lessons.md:529` — a field added to a kosztorys tree entity is not done until the raw INSERT column
  list knows about it; the same holds for a field removed.
- `lessons.md:350` — a test guarding the old definition goes tautological and stays green.
- `src/migrations/20260818_0_drop_kosztorys_hidden_in_export.ts` — closest precedent for the DROP half.
- `src/migrations/20260901_1_work_catalogue_auto_rates.ts:11-12` — precedent for the `DROP NOT NULL` half.

## Open Questions

1. ~~**The „Źródło" picker column** — keep or delete?~~ **NOT OPEN — settled 2026-09-01, one day
   before this research.** `context/archive/2026-09-01-kosztorys-dwie-opcje-zrodla-ceny-wykonawcy/change.md:38`
   considered deletion explicitly and rejected it: it makes the return to auto undiscoverable.
   Re-raised in error by this research and again by the follow-up pass (F7) because neither reached
   the archive. The rationale now lives in `context/reference/kosztorys-editor-domain-notes.md`
   § „Stawka wykonawcy ma dwa źródła" so a third pass cannot re-open it. **The column stays.**
2. **Stored blobs: rewrite or bump?** The recommendation is a one-shot jsonb rewrite (1 preset +
   5 snapshots) rather than a `SNAPSHOT_SCHEMA_VERSION` bump, because a bump fails at click time and
   the list paths do not assert. Needs a decision before the plan.
3. **Fixture regeneration ordering** — the golden master is already stale for reasons unrelated to
   this change. Regenerate before starting, or fold it into the change and accept a noisier diff?

---

## Follow-up Research [2026-09-02]

A second pass, run adversarially against pass one: one agent tasked with **refuting** the five load-bearing
claims above, one mapping the naming/UI surface, one drafting the migration, the blob fold and the
golden-master hash concretely. Verdicts: **1 confirmed, 1 refuted, 2 nuanced, 1 confirmed independently.**
Two of those change the plan.

### F1. REFUTED — `{type: null, value: v≠0}` is reachable, and durable

Pass one argued the illegal state cannot exist because `subcontractorPolicy.clear` returns
`{type: null, value: 0}` as one object (`subcontractor-price-edit.ts:47`). It never reaches the
database as one object:

- `itemPatchSchema` is `.partial()` — `src/lib/actions/kosztorys.ts:53-69`
- `grid-change-plan.ts:41-48` flattens a row diff to **one entry per changed field**
- `use-kosztorys-editor.ts:677,1090` fires `updateItemFieldAction(w.id, { [w.field]: w.value })` for
  each entry inside a `Promise.all`

So a mode change persists as **two independent, concurrent, unordered single-key writes**. Between them
the row genuinely is `{type: null, value: 500}`; if the second write loses (network, closed tab, 401),
that state is **permanent**. `/admin` reaches it directly — two ordinary independent inputs
(`collections/kosztorys-items.ts:46-49`).

**Two consequences.**

1. **The migration must not read the value column unconditionally.** The backfill is
   `CASE WHEN type = 'amount' THEN value ELSE NULL END` — equivalently, `SET value = NULL WHERE type
IS DISTINCT FROM 'amount'`. Reading `value` straight across would resurrect an orphaned kwota as a
   real one.
2. **The collapse gains a better justification than tidiness.** Today the pair has a representable
   state that no single write can produce atomically and no read acknowledges. One nullable column
   makes that state **unspellable**. This is the argument to put in the commit message — not "a union
   with one member is silly".

Benign today (every read branches on the type — F2), which is why nothing has caught it.

### F2. CONFIRMED — nothing reads `value === 0` as "no override"

Re-verified independently. `subcontractorPrice` (`calc.ts:116-121`) and its SQL twin
(`kosztorys-subcontractor-due.ts:39-49`) both gate on the type; `row-conditions.ts:365,375` reads the
_computed_ price. Pass one's §1 stands unchanged.

### F3. NUANCED — the public share route is real, but sits behind `unstable_cache`

`/k/[token]` is confirmed cookie-less and on the read path. But its SELECT runs inside
`unstable_cache` with tag-only invalidation (`preview-kosztorys.ts:94-98,117-136`), so a warm entry
serves through a schema change. Caching **narrows** the 42703 window; it does not close it (a cold
region, a tag revalidation, or a deployment boundary all re-execute the query). Treat it as a reason
the blast radius is smaller than feared, never as a reason to skip the split.

### F4. CONFIRMED (independently, from the dump) — the production distribution

| plane       | `type='amount'` | `type` NULL | value where type NULL  |
| ----------- | --------------- | ----------- | ---------------------- |
| `w_tools`   | 2612            | 1059        | **always exactly `0`** |
| `own_tools` | 2626            | 1045        | **always exactly `0`** |

3671 rows. **Zero `'coeff'` rows. Zero NULL-type-with-nonzero-value rows.** 238 `amount|0` pairs per
plane — the designed explicit-zero state, and the reason the collapse must keep `0 ≠ NULL`.

Stored payloads: 1 preset (373 items → 138 + 138 auto entries), 16 snapshots (1872 items → 694 + 695
auto entries). **17 rows, 1665 pair-entries to fold.** Every auto entry carries `"…OverrideValue": 0`;
no `"coeff"` anywhere.

### F5. NUANCED, then DISSOLVED — the pre-push gate vs. `lessons.md:1482`

`insert-schema-drift.test.ts:60` asserts set-equality **both ways** between `ITEM_INSERT_COLUMNS` and
`information_schema.columns`. It is skipped by the plain pre-push vitest leg but **runs** under
`scripts/test-integration.sh`, which is a pre-push gate. Pass one's plan — code that no longer inserts
the type columns shipped while the DROP migration is deliberately withheld from the tree
(`lessons.md:1482`) — would therefore fail `pnpm test:integration` **for every developer on every
push** for the whole split window.

**The migration draft dissolves this.** Split the change so that **part A relaxes nothing else**:

- **Migration A** (`20260902_0_relax_kosztorys_tool_override_values.ts`) — `DROP NOT NULL` +
  `DROP DEFAULT` on both value columns, then NULL out every row whose type is not `'amount'`.
  **It changes no column set**, so the drift test stays green.
- **Deploy A's code keeps consulting the type column on read** (`type === 'amount' ? Number(value) : null`)
  and keeps inserting both columns. The editor writes NULL for auto; the read still agrees.
- **Migration B** (the `DROP COLUMN`) is authored only once A's deploy is live, and the read mapper
  simplifies to `numOrNull` in the same commit.

That ordering also matches AGENTS.md's **additive** rule — A migrates prod _before_ the code ships,
exactly like `20260901_1` — and the old live code survives the NULLs it meets in between, because every
value read is behind a type branch or goes through `num()` = `Number(v ?? 0)` on the `'amount'` path only.

**One gap this ordering opens, and it is the only silent one in the change:** between migration A and
deploy A, the still-live old code inserts `type=NULL, value=0` for new auto rows (`insert-rows.ts:123` —
restore, apply-preset, sheet import). New code would read those as explicit 0 zł. Keeping the type-aware
read mapper through deploy A closes it; dropping it early is what makes it silent.

### F6. Naming — no rename. Only nullability changes.

`wToolsOverrideValue` / `ownToolsOverrideValue` already satisfy the glossary: English throughout, no
half-translated identifier, one concept one name. The plane prefix is a **dimension discriminator**
(`ToolPlaneT`), not a source suffix — the `FromKosztorys` / `FromTransactions` axis belongs to the
kosztorys↔transfers recon seam and must **not** be imported here. The `local/no-domain-drift` ESLint
rule (`eslint-rules/no-domain-drift.mjs`, `eslint.config.mjs:96-97`, severity `error`) is live and
untouched by this change.

`context/domain/02-glossary.md` has **no row** for this figure — add one as part of the change.

### F7. The „Źródło" picker column — WITHDRAWN (the owner had already decided)

Zero persisted-data consequence: `0` occurrences of `priceMode` in the dump,
`sanitizeClientViewVariant` (`client-view-settings.ts:78-80`) filters it, localStorage stores deviations
only. No paste path, no serialized undo, no E2E coverage. And
`kosztorys-v2-columns.tsx:290-294` **already argues in a comment** that the price cell is fully operable
alone. The only loss is discoverability of "Delete = back to auto". ~6 manual checks need rewording;
`manual-checks.md:2377-2383` is already factually stale independently of this change.

**This finding is withdrawn.** Everything above is an argument about _cost_, and cost was never the
question — the owner settled it on 2026-09-01 on **discoverability**, rejecting deletion in the same
words this pass used to argue for it (`…/kosztorys-dwie-opcje-zrodla-ceny-wykonawcy/change.md:38`).
„Auto" is not a visible state, it is the absence of a value, so an empty cell that silently means
„follows the mnożnik" is unreadable to anyone who does not already know the rule. The client price
view, where „Źródło" is deliberately absent and Delete IS the only route back, is a **deliberate
exception for one surface** (owner, review gate), not a precedent — deleting the column would promote
that exception to the only mechanism everywhere, which reverses the decision rather than extending it.
Recorded in `context/reference/kosztorys-editor-domain-notes.md`. **The column stays; the plan does
not ask.**

### F8. The golden master stays green — but not by the expression pass one proposed

Pass one suggested `case when type = 'amount' then value::text else '' end`. **That moves every hash:**
an auto row emits `':0::0'` under today's expression and `':'` under that one — the exact regeneration
it was meant to avoid. The form that works reproduces the **legacy bytes as literals** and never names a
type column, so it is correct across both deploys:

```sql
case when ki.w_tools_override_value is not null
       then 'amount:' || ki.w_tools_override_value::text
     else ':0' end
  || ':' ||
case when ki.own_tools_override_value is not null
       then 'amount:' || ki.own_tools_override_value::text
     else ':0' end
```

| row state                    | old bytes                        | new bytes                     | same?                                                                                                  |
| ---------------------------- | -------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `'amount'`, `v≠0`            | `'amount' \|\| ':' \|\| v::text` | `'amount:' \|\| v::text`      | ✅ — A never rewrites an `'amount'` row, so the `numeric` scale is byte-identical                      |
| `'amount'`, `0` (238/plane)  | `'amount:0'`                     | `'amount:0'`                  | ✅                                                                                                     |
| NULL type, `0` (1059 / 1045) | `':0'`                           | value → NULL → literal `':0'` | ✅                                                                                                     |
| legacy `'coeff'`             | `'coeff:0.65'`                   | `':0'`                        | ❌ — **but zero such rows exist** (F4), and neither seed can produce one (`perf-seed-kosztorys.ts:83`) |

The `numeric`-rendering trap is real but does not bite, precisely because A performs no arithmetic on
the rows whose value still reaches `::text`. **No `pnpm test:golden:update` needed**, and the kosztorys
axis of the fingerprint stays armed across both deploys. Caveat: the rewrite must land in the same
commit as A, and the suite must run against a `db-test` that has A applied.

### F9. Stored payloads — read-time fold in TypeScript, not a jsonb `UPDATE`

This **reverses pass one's recommendation** (Open Question 2 above). A one-shot jsonb rewrite races the
deploy: `captureAutoSnapshot` writes a full serialized tree with **no throttle and no dedupe**, so every
payload the old code writes between the rewrite and the rollover keeps the legacy shape and is misread
forever. A read-time fold has no window, is the pattern `subcontractorOverrideType` (`calc.ts:94`) already
establishes for exactly this, and needs no `SNAPSHOT_SCHEMA_VERSION` bump — the legacy payload is fully
interpretable, and a bump would reject all 17 stored rows at click time while still listing them.

Two insertion points cover every consumer (nothing else reads either `payload` column):
`getPreset` in `src/lib/db/presets.ts` and `getSnapshot` in `src/lib/db/snapshots.ts`.
`listPresetSections` reads only `payload->'sections'` and needs nothing.

The fold keys on `undefined` — the **absence of the legacy key** — to tell a post-collapse payload from a
pre-collapse one; anything else is the pair, and only `'amount'` survives as a kwota.

### F10. Vestigial `src/migrations/index.ts`

`src/payload.config.ts:64` sets only `migrationDir`; nothing imports `./migrations` and no
`prodMigrations` prop exists. That is why `20260901_1` shipped without an index entry and nothing broke.
Follow that precedent or fix both — cosmetic either way, but don't burn time on it.

## Resolved Open Questions

1. **„Źródło" picker** → evidence favours deletion (F7). Owner-facing; still the owner's call.
2. **Blobs: rewrite or bump?** → **neither.** Read-time fold in TS, version stays `1` (F9).
3. **Fixture regeneration** → **not needed for this change** (F8). The pre-existing staleness is a
   separate matter and should not be folded into this diff.

## Remaining Open Questions

1. Whether Vercel's Data Cache survives a deployment boundary — decides how narrow F3's window really is.
   Unverified; does not change the plan, only the size of the risk.
2. Whether the deploy-A read mapper keeps the type branch (F5's gap closer) or the split window is
   simply kept short enough that no restore/import runs in it. The first is cheap and explicit;
   recommend it.

---

## Owner Decisions [2026-09-02]

Two constraints the research assumed were relaxed by the owner, and they collapse most of the
scaffolding built around them.

**D1. The stored presets and snapshots may be discarded.** They are production rows, but were only
ever added as test data. Verified consequence of losing them: `work_catalogue_items` is a separate,
already-materialized table (`20260901_0`), seeded once from the preset — losing the preset breaks a
future **re-seed**, not the live catalogue.

→ **The read-time TS fold (F9) is dropped.** Its only justification was the race with
`captureAutoSnapshot`, and permanent code in a read path cannot be justified by a one-shot problem on
disposable data. Replaced by a **one-shot jsonb rewrite inside the migration**: 17 rows, 1665
pair-entries, `{type: null, value: 0}` → `{value: null}`. Deleting the rows outright is an acceptable
fallback if the SQL proves awkward. No `SNAPSHOT_SCHEMA_VERSION` bump either way.

**D2. Nobody is writing data during the deploy window.**

→ **The two-migration split is dropped.** It existed solely to keep an old deploy away from a migrated
DB (42703 on the public `/k/[token]`). **One migration, applied after the deploy is live**, achieves
the same: the old code never meets the migrated schema, and the new code against an unmigrated schema
_reads_ correctly — the value columns still exist and it simply stops selecting the type columns. The
only window cost is `23502` on a "clear to auto" write: loud, authenticated, editor-only, and by D2
free.

Three problems dissolve together because they shared one cause: no migration B withheld from the tree,
so `insert-schema-drift.test.ts` stays green with no special handling (F5); no type-aware read mapper
carried through a first deploy, so F5's silent gap never opens.

**The residual risk this accepts:** a **Vercel rollback after the migration** puts old code against a
migrated DB and brings 42703 on the investor share link back. Accepted deliberately.

**D3. Both stored blobs are deleted, not rewritten** (owner, 2026-09-02, after reading the actual rows).

The dump's real shape, which is not what F4/§3 assumed:

| table                               | rows | affected | what they are                                                                                                      |
| ----------------------------------- | ---- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `kosztorys_presets`                 | 1    | 1        | `kosztorys wzrór test`, 373 items, 2026-08-27                                                                      |
| `kosztorys_snapshots` `kind=manual` | 11   | **0**    | „Przed importem z arkusza Google" / „Przed wczytaniem…" — `{"items": [], …}`, 156 bytes, **zero override entries** |
| `kosztorys_snapshots` `kind=auto`   | 5    | 5        | machine-written periodic captures, inv. 90 (×3), 137, 138, all 2026-08-27…30                                       |

**The eleven snapshots with genuine restore intent are empty and therefore immune** — they were taken
_before_ an import, when the kosztorys was empty, and restoring one correctly means "go back to
empty". Only the 5 `auto` rows carry the legacy pair, and they are a rolling 5-day undo history, not
curated artifacts.

The owner: the preset may go, and **will be re-saved after the change** (so the replacement is
serialized by the new code and no legacy blob is ever created again — it must be saved _after_ the
deploy, not before); the 5 auto snapshots have no value. So:

```sql
DELETE FROM kosztorys_presets;
DELETE FROM kosztorys_snapshots WHERE kind = 'auto';
```

The 11 empty `manual` rows are **left alone** — immune to the change, and deleting them would remove a
deliberately-created restore point for no benefit. `kosztorys_presets` has no inbound FK (only
`created_by → users`), so the delete pulls nothing with it.

→ **F9 is void in full.** No jsonb rewrite, no `normalizeStoredPayload`, no read-time fold, no
insertion points in `getPreset` / `getSnapshot`, no `SNAPSHOT_SCHEMA_VERSION` conversation. The change
loses a permanent code path it never needed.

**D4. The golden master is regenerated as a separate commit BEFORE the change** (owner, 2026-09-02),
and the reason is not hygiene.

Verified in the fixture itself, not taken from the earlier pass: `financial-golden-master.json`
(2026-08-28) carries `kosztorysItemCount: 1000` and **exactly one** investment with a `/k:` hash
segment — `'7'`, the synthetic perf seed. It was captured while the prod dump held zero kosztorys
rows.

After a `db:import:test` today, the eleven real kosztorys investments (9, 14, 19, 21, 45, 54, 61, 90,
106, 137, 138) each gain a `/k:` segment the fixture does not know, so `inputsUnchanged` is false for
all of them, they land in `dataMoved`, and **their money is compared against nothing**. Nothing fails:
11 of 115 is far under the `total/2` floor, and the `AXES` kosztorys guard reads
`expected.inputHashes` — the _fixture's_ view — where only investment 7 carries a kosztorys. The guard
is green while watching one synthetic investment.

**The skipped set is exactly the risk set.** EX-766 changes kosztorys pricing, so the only money that
can move belongs to investments with a kosztorys — precisely the eleven that are dark.

Concrete failure this would hide, using trap 3 (`coalesce(ki.w_tools_override_value, 0)` in
`kosztorys-subcontractor-due.ts`): once the type column is gone and NULL carries the meaning, leaving
that coalesce while dropping the branch prices every auto row at **0 zł** instead of
`clientPrice × coeff`. Computed over the dump with each investment's real coefficient (54 is
`0.565217`, the rest `0.65`), w_tools plane:

| inw. | 14        | 19       | 106      | 54       | 137      | 21       | 45       | 138      | 61       | **razem**     |
| ---- | --------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | ------------- |
| zł   | 10 739,30 | 6 932,25 | 6 477,25 | 5 460,00 | 4 712,50 | 4 683,25 | 3 305,90 | 2 340,00 | 1 341,60 | **45 992,05** |

~46k zł of robocizna vanishes, marża inflates by the same, and the suite is green — every one of those
nine investments sits in the skipped set.

**F8's stable-hash rewrite does not substitute for this.** It guarantees the collapse pushes _nobody
new_ out of the compared set; it cannot pull back in those already outside.

**Why a separate commit, before:** regeneration freezes _today's_ numbers as truth, so it must sit on a
state known to be production-accepted, and its 75 KB diff must be attributable on its own rather than
mixed into the refactor (`lessons.md:233`).

**Reframing worth carrying into the plan:** `impliedCatalogueRate`
(`work-catalogue/catalogue-rate.ts:12`) already returns `number | null` with `null` = auto, and
`20260901_1_work_catalogue_auto_rates` already migrated `work_catalogue_items` to that shape. EX-766
does not introduce a new representation — it brings `kosztorys_items` into line with the shape its
neighbour table adopted a month earlier.
