---
date: 2026-08-17T12:29:07+02:00
researcher: Claude (Opus 5)
git_commit: 84036a7d14d840e7937e32854bf9426a3e8aa7d1
branch: client-preview-settings
repository: wykonczymy
topic: 'Drop the per-etap „% wykonania" columns and their wiring'
tags: [research, codebase, kosztorys, editor, columns, progress-display]
status: complete
last_updated: 2026-08-17
last_updated_by: Claude (Opus 5)
---

# Research: Drop the per-etap „% wykonania" columns and their wiring

**Date**: 2026-08-17T12:29:07+02:00
**Researcher**: Claude (Opus 5)
**Git Commit**: `84036a7d14d840e7937e32854bf9426a3e8aa7d1`
**Branch**: `client-preview-settings`
**Repository**: wykonczymy

## Research Question

Remove the per-etap „% wykonania" columns (`Etap N %`) from the kosztorys editor and all their
wiring. Owner framing: *fewer columns, less logic, less bloated views.* What exactly has to change,
what breaks, and what decisions does the removal force?

## Summary

The deletion is **cheap and self-contained**: 31 references across 9 source files + 4 spec files.
No DB migration, no Sheets contract, no E2E, no data backfill.

Four findings drive the plan:

1. **No schema plane is involved.** `stageValuePercent` is a *computed grid column* — no row in
   `kosztorys_items`, no SELECT, no mapper, no INSERT tuple. Every prior kosztorys column removal
   (`measuredQty`, `costVariant`, section coeffs) needed a migration because those were **stored**;
   this one is not. Precedent's deploy-order trap (a DROP is code-first, not migrate-first) does not
   apply either.
2. **Every persisted store self-heals.** Four stores can hold the string — localStorage hidden
   columns / widths / order, and the DB `kosztorys_client_view.hiddenColumns`. All are sparse maps
   read only through keys the assembly produced, and the DB one is filtered through
   `PREVIEW_VISIBLE_COLUMNS` **on read and on write** (`client-view-settings.ts:16-27`). A stale key
   is inert and drops itself on the next write. No cleanup, no migration.
3. **The `values | percent` progress-display axis dies with it.** Its whole domain is three toggle
   keys; remove the percent one and the remaining two are both `'values'`, so the four-state union
   collapses to two equivalence classes. Picking „Procent" would then hide the per-etap kwota block
   and put **nothing** in its place while the toolbar shows „Procent" ticked — degenerate and
   actively misleading. Its one surviving capability (show/hide per-etap kwoty) is already reachable
   two other ways: the column picker's own ticks and `layer: 'work'`. **Recommendation: delete the
   axis in the same change** — this is the "less logic" half of the ask.
4. **The row-level `donePercent` is genuinely independent** and is a separate call. It shares only
   the private `doneFraction()` bottom; it is untagged on the progress-display axis. Dropping it too
   is a ~dozen extra lines in files this change already opens — but it costs one real capability
   (see Open Questions).

**Ordering constraint (the one real trap):** delete the map, the predicate, and the call-site
conjunct **in one move**. `progressDisplayAllows` fails open (`progress-display.ts:15`), so removing
only the map entries leaves an unconditionally-`true` conjunct sitting in the per-column hot filter.

## Detailed Findings

### 1. The deletion surface (production)

| File | What goes |
| --- | --- |
| `src/lib/kosztorys/stage-keys.ts` | `STAGE_VALUE_PERCENT_COLUMN_GROUP` (`:14`), `stageValuePercentKey` (`:37-39`); the "Three groups" comment (`:9-10`) becomes two |
| `src/lib/kosztorys/column-config.ts` | import `:7`; label `:42`; the `PRZEDMIAR_ANCHORED_COLUMNS` exemption paragraph `:79-80`; `COLUMN_PROGRESS_DISPLAY` + comment `:110-118`; `COLUMN_LAYER` `:128`; `CLIENT_VIEW_GROUPS` `:203` |
| `src/lib/kosztorys/header-tips.ts` | import `:4`; the tip entry + its 3-line comment (`~:43-47`); the "three stage-VALUE axes" wording (`:38-40`) |
| `src/lib/kosztorys/progress-display.ts` | whole file (if the axis goes) |
| `src/lib/kosztorys/layer.ts` | `:5-6` comment naming `progressDisplayAllows` in the visibility formula |
| `src/lib/kosztorys/calc.ts` | `stageDoneFraction` (`:168-170`) — dead on arrival, single consumer |
| `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx` | imports `:25,:42,:47,:63`; the `stageValuePercentCols` block (`~:488-503`); the spread `:587`; the `toggleKey` branch `:605-607` + its "three prefixes" comment `:597-599`; `const display` `:634`; the `progressDisplayAllows(...)` conjunct `:652` |
| `src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts` | import `:5`; `progressDisplay?` opt `:38-40`; comment `:93` |
| `src/components/kosztorys/editor/hooks/use-progress-display.ts` | whole file (if the axis goes) |
| `src/components/kosztorys/editor/use-kosztorys-editor.ts` | imports `:22,:76`; hook call `:245`; `columnOpts.progressDisplay` `:422`; the `stageValuePercentKey(id)` arg in `dropWidth` `:986`; returned `progressDisplay/setProgressDisplay` `:1441-1442` |
| `src/components/kosztorys/editor/toolbar/kosztorys-view-axis-options.tsx` | `ProgressDisplayT` import `:9`; `PROGRESS_DISPLAYS` `:53-60`; `PROGRESS_PAIR_CONFIG` `:62-67`; the then-unused `Banknote`/`Percent` lucide imports |
| `src/components/kosztorys/editor/toolbar/kosztorys-view-menu.tsx` | imports `:32-33`; destructure `:93-94`; the „Etapy" `AxisSection` + separator `:143-150`; comments `:49,:85-86` |
| `src/components/kosztorys/editor/hooks/use-column-widths.ts` | `:23-24` comment ("ilość + kwota netto + brutto + %") — wording only |

**Must NOT be deleted:** `formatPercent` / `formatPercentPrecise` (`format.ts`) — `donePercent`
still renders through them. `rowDoneFraction` and the private `doneFraction` — same reason.
`axis-checkboxes.ts` and `usePersistedEnum` keep other consumers (money axis, layer, price view).

### 2. Where the percent is computed

`src/lib/kosztorys/calc.ts:168-170` — `stageDoneFraction(row, qtyDoneInStage)` is a **pure alias**
of the private `doneFraction()` (przedmiar denominator), differing from `rowDoneFraction` (`:173`)
only in the numerator's name.

- Sole production caller: `kosztorys-v2-columns.tsx:497`.
- Everything else is `src/__tests__/lib/kosztorys/kosztorys-calc.test.ts:126-176`.
- No per-stage percent totals exist — `column-totals.ts:76-78` writes only net/gross into the footer.
- `sort-value.ts` has no case for any `stageValue*` id (they fall to `default`), so nothing to remove.

### 3. Persistence — four stores, all inert

| Store | Where | Key space | Stale-key behaviour |
| --- | --- | --- | --- |
| Hidden columns | localStorage `table-columns:kosztorys` (`use-hidden-columns.ts:16`) | group key | `isHidden(id)` only ever called with assembled ids → never queried. Inert. |
| Column widths | localStorage `kosztorys-v2-col-widths` (`use-column-widths.ts:8`) | `stageValuePercent_<id>` | Read by column id at render. Inert; orphan entries simply stop being read (and stop being cleaned by `dropWidth`). |
| Column order | localStorage `kosztorys-v2-col-order` (`column-order.ts:7,13`) | group key | `effectiveRank`/`rankForMove` read only listed keys — no NaN, no skew. Inert. |
| **Client preview (DB)** | `kosztorys_client_view.hiddenColumns` + the firm-wide global | group key — **real rows may hold it today** | `sanitizeClientViewSettings` filters against `PREVIEW_VISIBLE_COLUMNS` on read *and* write → silently dropped, no spurious write (`sameClientViewSettings` compares sanitized). Already covered by `kosztorys-client-view.test.ts:60`. |

Presets and snapshots store **row data**, never column ids — zero hits for `stageValue`/`STAGE_VALUE`.
Per `lessons.md:743-760`, no `SNAPSHOT_SCHEMA_VERSION` bump: nothing about an old payload would
restore into wrong rows.

### 4. No reach into Google Sheets, e2e, or migrations

`grep` over `src/lib/google/**` for `stageValue|STAGE_VALUE|STAGES_COLUMN_GROUP` → **zero**. The axis
is render-time only; it never enters a Sheets read/write path nor `sheet-import/`. So the frozen
sheet-column-layout lesson (`lessons.md:12-17`) does **not** bite here. `e2e/**` → zero references.
Migrations/fixtures/JSON snapshots → zero.

### 5. Client-facing consequence (name it, don't slip it in)

`stageValuePercent` sits in `CLIENT_VIEW_GROUPS` „Etapy i postęp" (`column-config.ts:203`), so it is
in `PREVIEW_VISIBLE_COLUMNS`. Removing it:

- shrinks the client-preview allowlist by one — **every client preview loses that column**;
- removes one checkbox from the client-view settings dialog (`client-view-settings-form.tsx:62,72`
  maps groups → `COLUMN_LABELS`, so the tick disappears with no further edit);
- shifts the baseline in `preview-columns.test.ts`.

Intentional per the owner goal, but it is a disclosure-surface change, not pure cleanup.

### 6. Test surface

Nothing here is DB-backed (no `skipIf(!ENV_READY)` marker), so **`pnpm test:integration` is
unaffected**; the two `pnpm test:parity` specs have zero references — **parity unaffected**. No E2E.

**Dies with the feature**
- `src/__tests__/lib/kosztorys/kosztorys-progress-display.test.ts:10-55` — the five
  `progressDisplayAllows` tests + the `COLUMN_PROGRESS_DISPLAY` label guard.
  ⚠️ **Do not delete the file blindly**: `:57-81` (`formatPercent`/`formatPercentPrecise`) is
  unrelated and survives, as does the `donePercent` money-axis-neutrality assertion `:53`. Rehome
  both — the neutrality line fits `kosztorys-money-axis.test.ts`, the formatter block a `format.test.ts`.
- `src/__tests__/components/kosztorys/editor/grid/kosztorys-layer.test.ts:93-111` — the whole
  `it('„praca" chowa kolumny „% etapu" też w trybie procentowym')` exists only to assert the
  layer × progress-display composition over the percent column. Delete the `it`, trim comments
  `:23-25`. Everything else in the file survives.

**Edit, keep**
- `src/__tests__/lib/kosztorys/kosztorys-calc.test.ts:126-176` — six `it`s each asserting *both*
  fractions. Strip the `stageDoneFraction(…)` lines (`:131,:136,:143,:154,:163,:174`), rename the
  describe to `rowDoneFraction`. The `rowDoneFraction` assertions are surviving invariants.
- `src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts` — drop the three
  `{ progressDisplay: … }` entries `:51-53` and the `toContain('stageValuePercent_7')` line `:84`.
  Both `it`s survive (`:44` is the EX-591 invariant).

**Verified unaffected** — `v2-columns-readonly.test.ts` (its `donePercent` refs are the row-level
column; `change.md` listed it speculatively), `v2-columns-order.test.ts`, `kosztorys-money-axis.test.ts`
(`:79` is a `startsWith('stageValue')` prefix match, still green), `divergence-column.test.ts`,
`stage-plane-lock.test.ts`, `kosztorys-axis-checkboxes.test.ts` (its `describe.each` covers MONEY +
LAYER only — `PROGRESS_PAIR_CONFIG` was never in it), `client-view-groups.test.ts` (`:15` compares
two things that shrink together), `client-view-settings.test.ts`, `kosztorys-client-view.test.ts`.

`header-tips.ts` has **no test at all** — pure source deletion.

`context/foundation/test-plan.md` names **no risk** covering column visibility or reading axes, so
nothing to anchor a replacement test on and nothing to retire. These specs are self-authored
coverage with no plan entry.

## Code References

- `src/lib/kosztorys/stage-keys.ts:14,37-39` — the group constant and key builder
- `src/lib/kosztorys/column-config.ts:42,79-80,110-118,128,203` — every config map entry
- `src/lib/kosztorys/progress-display.ts:11-18` — the fail-open predicate and its default
- `src/lib/kosztorys/calc.ts:168-184` — `stageDoneFraction` / `rowDoneFraction` / `doneFraction`
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:488-503,587,605-607,643-655` — the
  column block, the spread, the `toggleKey` branch, and the four-gate `keep()` filter
- `src/lib/kosztorys/client-view-settings.ts:16-27` — the sanitize-on-read-and-write that makes the
  DB store self-healing
- `src/hooks/use-persisted-enum.ts:25-34` — validates against `VALID_DISPLAYS`, so a stored
  `'percent'` falls back to the default once the axis is gone

## Architecture Insights

- **Four independent reading axes compose by plain AND** in `keep()` (`kosztorys-v2-columns.tsx:649-654`):
  hidden-picker × money (net/gross) × progress-display (values/percent) × layer (praca/postęp).
  The strictest wins, and `previewVisible` short-circuits all four (`:645-647`). Removing one axis is
  therefore a clean subtraction — no other axis changes meaning.
- **Every axis map fails open** (an untagged key survives every mode). That is what makes a
  half-delete dangerous: drop the entries and keep the predicate, and you ship a permanently-true
  conjunct instead of a removed feature.
- **The "one axis, one degenerate survivor" smell** is the real lesson here: an axis whose domain is
  three keys loses its reason to exist when one of them goes. Check the *domain* of an enum axis
  before deleting a member, not just the member's own call sites.
- The compiler is a weaker completeness proof here than in the `costVariant` precedent — that one
  had `ITEM_FIELDS as const satisfies readonly (keyof ItemPatchT)[]` keeping `tsc` red until every
  carrier was gone. A computed column has no such spine, so gate on `pnpm typecheck` **plus** a grep
  for the literal `stageValuePercent`.

## Historical Context (from prior changes)

- `context/archive/2026-07-25-subcontractor-view-settlement-only/review-gate.md:30` — **the owner
  ruling we are mooting.** Review asked: should the per-etap „% wykonania", being przedmiar-anchored,
  disappear in subcontractor views like every other przedmiar-anchored column? Owner 2026-07-25:
  *keep the columns*, and the tip was rewritten to name the invisible denominator instead. That is a
  **visibility** ruling, not a "this column earns its keep" ruling — deleting the columns doesn't
  contradict it, it moots it. The only artifact that dies with it is that header tip.
- `context/archive/2026-07-28-drop-cost-variant-columns/` (EX-575, commits `68564aa3` → `55592faf`) —
  the six-phase template for a deletion, and the rulings that a non-strict `z.object().partial()`
  action schema plus bare-cast preset/snapshot mappers make stored extra keys inert *as a property of
  how the mapper is written, not a promise*.
- `context/archive/2026-07-24-remove-section-coeff/` (`c9e0f248` → `a4de7cd5`) — a **DROP deploys
  code-first**, inverting the ADD order. Not applicable here (no schema), but the reasoning is why
  we're confirming there is no schema.
- `context/archive/2026-07-16-…` / EX-489 (`c8dea6fa`, `c09fbcf1`) — the `measuredQty` removal, the
  closest *grid-column* precedent: behaviour first, dead model swept in a later phase.
- `context/archive/2026-08-12-ex-672-remove-print-csv-export/` — the trap that an *optional* carrier
  lights nothing up on removal; gate cleanup on `tsc`, not grep (`feedback_deadcode_gate_on_typecheck`).
- `context/reference/kosztorys-editor-domain-notes.md:320` — why the percent exists at all:
  *„% wykonania" = Σ etapów / Przedmiar* (not over the stage sum, or it'd be 100% everywhere).

## Open Questions

1. **Does the `values | percent` progress-display axis go too?** Research says it should — it is
   degenerate and misleading without the percent column, and its surviving capability is duplicated
   twice over. Deciding "keep the axis" means shipping a toolbar option that blanks the stage block.
2. **Does the row-level `donePercent` („% wykonania (względem przedmiaru)") go too?** Independent of
   the per-etap axis, a small increment in the same files. The cost is concrete: `donePercent`'s cell
   is the **only display surface for the overrun signal** — `hasStagesOverPlanned`
   (`settlement-rows.ts:78`) tones the cell red when Σ etapów exceeds the przedmiar
   (`kosztorys-editor-domain-notes.md:328-330`, origin EX-489). Drop the column and that warning has
   nowhere to render. It is also a client-disclosed column (`CLIENT_VIEW_GROUPS`), and with both
   percent columns gone the „Etapy i postęp" group collapses to `stages` + net + gross.
   **Default assumption stands: `donePercent` stays.**
3. If `donePercent` ever does go, `hasStagesOverPlanned` loses its only grid consumer — check the
   plane warning and `subcontractor-due-by-plane` tests before deleting it too.
4. Cosmetic only: orphan `stageValuePercent_<id>` width entries in localStorage will never be cleaned
   again. Harmless; worth one line in the plan if localStorage hygiene matters.
