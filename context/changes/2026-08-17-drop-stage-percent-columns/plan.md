# Drop the per-etap „% wykonania" columns and their reading axis — Implementation Plan

## Overview

Delete the per-etap „% wykonania" column group (`Etap 1 %` … `Etap N %`) from the kosztorys v2
editor, and with it the now-degenerate `values | percent` progress-display reading axis. Owner
motivation: fewer columns, less logic, less bloated views.

## Current State Analysis

The grid composes four independent reading axes by plain AND in `keep()`
(`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:649-654`): the hidden-columns picker
× the money axis (netto/brutto) × the progress-display axis (values/percent) × the layer axis
(praca/postęp), with `previewVisible` short-circuiting all four (`:645-647`).

- The percent group is a **computed** column set — no `kosztorys_items` column, no SELECT, no mapper,
  no INSERT tuple. Every prior kosztorys column removal (`measuredQty`, `costVariant`, section
  coeffs) needed a migration because those were stored; this one does not.
- The **entire domain of `COLUMN_PROGRESS_DISPLAY`** is three toggle keys
  (`src/lib/kosztorys/column-config.ts:114-118`): `stageValueNet` and `stageValueGross` tagged
  `'values'`, `stageValuePercent` tagged `'percent'`. Removing the percent key leaves two keys with
  one tag — the four-state union collapses to "show the stage kwota block" vs "hide it", and picking
  „Procent" in the toolbar would blank that block while showing „Procent" as ticked.
- The axis's one surviving capability is already reachable twice over: the column picker's own
  „Etapy — kwota netto" / „…brutto" ticks, and `layer: 'work'`.
- The row-level `donePercent` („% wykonania (względem przedmiaru)") is **independent** — untagged in
  `COLUMN_PROGRESS_DISPLAY`, tagged only in `COLUMN_LAYER:129`. It stays.

Full inventory, persistence analysis and precedent: `research.md`.

## Desired End State

The Kolumny popover has three sections instead of four (Kwoty / Warstwy / Kolumny — no „Etapy"). The
grid renders `stages` (ilość) + „Etapy — kwota netto" + „Etapy — kwota brutto" per stage and no
percent column. The row-level „% wykonania" column is untouched, red overrun tone included. Client
previews no longer offer or render the per-etap percent. `pnpm typecheck` is green, the suite is
green, and a repo-wide grep for `stageValuePercent` returns nothing outside `context/`.

### Key Discoveries:

- `progressDisplayAllows` **fails open** (`src/lib/kosztorys/progress-display.ts:15` — an untagged key
  returns `true`). Removing only the map entries would leave an unconditionally-true conjunct in the
  per-column hot filter. Map + predicate + call-site conjunct must go together.
- `stageDoneFraction` (`src/lib/kosztorys/calc.ts:168-170`) is a pure alias of the private
  `doneFraction` with exactly one production caller — the percent column
  (`kosztorys-v2-columns.tsx:497`). It dies with the column. `rowDoneFraction` (`:173`) must stay —
  `donePercent` uses it.
- `formatPercent` / `formatPercentPrecise` (`src/lib/kosztorys/format.ts`) must stay — `donePercent`
  and the summary counter render through them.
- All four persisted stores self-heal. The DB one
  (`kosztorys_client_view.hiddenColumns`) is filtered through `PREVIEW_VISIBLE_COLUMNS` on read _and_
  write (`src/lib/kosztorys/client-view-settings.ts:16-27`), so a stored `stageValuePercent` drops
  itself; the three localStorage maps are sparse and read only via keys the assembly produced.
  `usePersistedEnum` validates against `VALID_DISPLAYS`, so a stored `'percent'` falls back to the
  default once the axis is gone. **No migration, no backfill, no cleanup script.**
- Zero reach into `src/lib/google/**`, `e2e/**`, migrations, fixtures or snapshots.
- `src/lib/kosztorys/header-tips.ts` has no test at all — pure source deletion.
- `axis-checkboxes.ts` and `usePersistedEnum` keep other consumers (money axis, layer, price view), so
  removing this axis orphans no shared primitive.

## What We're NOT Doing

- **Not** touching the row-level `donePercent` column, its red overrun tone, or `hasStagesOverPlanned`.
- **Not** touching the summary's „Postęp prac" counter — a different figure (value-weighted, whole
  dataset) that happens to also be a percentage.
- **Not** writing a DB migration, a data backfill, or a localStorage cleanup — nothing stored needs it.
- **Not** bumping `SNAPSHOT_SCHEMA_VERSION` — no stored payload would restore into wrong rows
  (`context/foundation/lessons.md:743-760`).
- **Not** replacing the „Etapy" toolbar section with a substitute toggle — the column picker and
  `layer: 'work'` already cover it.
- **Not** cleaning orphan `stageValuePercent_<id>` entries out of the widths map in localStorage; they
  are inert and never read again.

## Implementation Approach

One coherent production+test phase, then docs. The production deletion and the test edits land
**together** because the specs reference the deleted symbols — splitting them would ship a phase whose
own verification cannot pass. Within the phase, delete the axis's map, predicate and call-site
conjunct as one move, per the fail-open trap above.

Completeness is proven by `pnpm typecheck` **plus** a literal grep — unlike the `costVariant`
precedent, a computed column has no `as const satisfies keyof …` spine to keep the compiler red until
every carrier is gone.

---

## Phase 1: Remove the percent columns and the progress-display axis

### Overview

Delete the column group, the reading axis that existed to toggle it, the dead fraction helper, and
bring the specs along.

### Changes Required:

#### 1. The column group's identity

**File**: `src/lib/kosztorys/stage-keys.ts`

**Intent**: Drop the third stage-value namespace now that nothing renders it.

**Contract**: Remove `STAGE_VALUE_PERCENT_COLUMN_GROUP` and `stageValuePercentKey`. The file's header
comment claims "Three groups, so the qty axis and each value axis hide independently" — it becomes
two.

#### 2. Config maps

**File**: `src/lib/kosztorys/column-config.ts`

**Intent**: Remove every map entry keyed by the percent group, and delete `COLUMN_PROGRESS_DISPLAY`
outright along with the axis it served.

**Contract**: Drop the import; the `COLUMN_LABELS` entry `stageValuePercent`; the whole
`COLUMN_PROGRESS_DISPLAY` map and its comment; the `COLUMN_LAYER` entry; the `CLIENT_VIEW_GROUPS`
„Etapy i postęp" array element. `PREVIEW_VISIBLE_COLUMNS` is that array's flattening, so it shrinks
automatically. Also delete the `PRZEDMIAR_ANCHORED_COLUMNS` doc paragraph explaining why the percent
group is deliberately absent from that set — it documents a column that no longer exists. Keep the
`COLUMN_MONEY_AXIS` comment's point about `donePercent` being untagged; drop only its clause about
`stageValuePercent`.

#### 3. The reading axis

**Files**: `src/lib/kosztorys/progress-display.ts`, `src/components/kosztorys/editor/hooks/use-progress-display.ts`

**Intent**: Delete both files — the axis has no remaining distinction to draw.

**Contract**: `ProgressDisplayT`, `PROGRESS_DISPLAY_DEFAULT`, `progressDisplayAllows` and
`useProgressDisplay` all disappear. The localStorage key
`table-columns:kosztorys-progress-display` is simply never read again.

#### 4. Toolbar

**Files**: `src/components/kosztorys/editor/toolbar/kosztorys-view-axis-options.tsx`,
`src/components/kosztorys/editor/toolbar/kosztorys-view-menu.tsx`

**Intent**: Remove the „Etapy" checkbox pair from the Kolumny popover.

**Contract**: Delete `PROGRESS_DISPLAYS`, `PROGRESS_PAIR_CONFIG`, the `ProgressDisplayT` import and
the now-unused `Banknote` / `Percent` lucide icons from the options module. In the menu, drop the
imports, the `progressDisplay` / `setProgressDisplay` context destructure, and the „Etapy"
`AxisSection` together with the `DropdownMenuSeparator` that precedes it — leaving Kwoty / Warstwy /
Kolumny. The `AxisSection` doc comment and the file-header comment both enumerate "Kwoty / Warstwy /
Etapy"; both become two axes.

#### 5. Grid assembly

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: Remove the percent column block and the axis's gate, in one move.

**Contract**: Delete the `stageValuePercentCols` builder and its spread in `dataColumns`; the
`stageValuePercent` branch of `toggleKey` (its comment asserting three mutually-exclusive prefixes
becomes two); the `const display` read and the `progressDisplayAllows(...)` conjunct inside `keep()`;
and the `stageDoneFraction`, `stageValuePercentKey`, `STAGE_VALUE_PERCENT_COLUMN_GROUP` and
progress-display imports. `formatPercent` stays — `donePercent` still uses it.

#### 6. Column-opts and editor state

**Files**: `src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts`,
`src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Drop the axis from the column-opts contract and from editor state.

**Contract**: Remove the `progressDisplay` field (and its comment) from the opts type plus the
`ProgressDisplayT` import. In the editor hook remove the `useProgressDisplay()` call, the
`columnOpts.progressDisplay` wiring, the `progressDisplay` / `setProgressDisplay` pair on the returned
object, and the `stageValuePercentKey(id)` argument to `dropWidth` in `handleRemoveStage` (the call
stays, one argument shorter). Anything reading these off the editor context is covered by §4.

#### 7. Dead fraction helper

**File**: `src/lib/kosztorys/calc.ts`

**Intent**: Remove the per-stage fraction wrapper, now caller-less.

**Contract**: Delete `stageDoneFraction`. Keep the private `doneFraction` and `rowDoneFraction`. The
comment above the pair mentions the grid pairing the unclamped fraction with a red cell — that is
`donePercent`'s behaviour and stays true; re-read it rather than deleting it wholesale.

#### 8. Header tips and the layer comment

**Files**: `src/lib/kosztorys/header-tips.ts`, `src/lib/kosztorys/layer.ts`

**Intent**: Remove the tooltip written for the deleted column and correct the comment that names the
deleted predicate.

**Contract**: In `header-tips.ts` drop the import, the `STAGE_VALUE_PERCENT_COLUMN_GROUP` entry and
the comment paragraph justifying its przedmiar-base wording; the surrounding comment says "three
stage-VALUE axes" → two. In `layer.ts`, the comment spelling out
`visible = pickerAllows AND axisAllows AND progressDisplayAllows AND layerAllows` loses its third
term. Same for the `KOLUMNY_HINT` text in the options module if it enumerates the axes by name.

#### 9. Specs — delete what dies with the feature

**Files**: `src/__tests__/lib/kosztorys/kosztorys-progress-display.test.ts`,
`src/__tests__/components/kosztorys/editor/grid/kosztorys-layer.test.ts`

**Intent**: Remove the axis's own coverage while rescuing the assertions that outlive it.

**Contract**: In `kosztorys-progress-display.test.ts` the `progressDisplayAllows` describe and the
`COLUMN_PROGRESS_DISPLAY` label guard go. **Two things must be rehomed, not deleted**: the
`formatPercent` / `formatPercentPrecise` describe (unrelated to the axis, still live) moves to a new
`src/__tests__/lib/kosztorys/format.test.ts`; the assertion that `donePercent` is absent from
`COLUMN_MONEY_AXIS` moves to
`src/__tests__/components/kosztorys/editor/grid/kosztorys-money-axis.test.ts`. The now-empty file is
then deleted. In `kosztorys-layer.test.ts` delete the single `it` asserting that „praca" hides the
percent columns in percent mode — it exists only to test the axis composition — and trim the file's
comments that name the percent columns.

#### 10. Specs — edit what survives

**Files**: `src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts`,
`src/__tests__/lib/kosztorys/kosztorys-calc.test.ts`

**Intent**: Keep the surviving invariants, drop the percent-specific lines.

**Contract**: In `preview-columns.test.ts` remove the `progressDisplay` entries from the
narrowed-preferences fixture list and the `toContain('stageValuePercent_7')` assertion; both `it`s
survive (the narrowing one is the EX-591 invariant). In `kosztorys-calc.test.ts`, the
`stageDoneFraction / rowDoneFraction` describe asserts both functions in each `it` — strip the
`stageDoneFraction(...)` lines and rename the describe to `rowDoneFraction`. Every assertion there
(przedmiar denominator, price/rabat neutrality, null-denominator guard, unclamped overshoot) is a
surviving invariant of `donePercent`.

### Success Criteria:

#### Automated Verification:

- The axis's specs are gone and the rescued ones run in their new homes:
  `pnpm exec vitest run src/__tests__/lib/kosztorys/format.test.ts`
- Grid/column specs pass: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/`
- Calc and client-view specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/kosztorys-calc.test.ts src/__tests__/lib/kosztorys/client-view-groups.test.ts src/__tests__/lib/kosztorys/client-view-settings.test.ts`
- No production reference survives: `grep -rn "stageValuePercent\|STAGE_VALUE_PERCENT\|progressDisplay\|ProgressDisplayT" src e2e` returns nothing
- Both deleted modules are gone: `test ! -e src/lib/kosztorys/progress-display.ts && test ! -e src/components/kosztorys/editor/hooks/use-progress-display.ts`

#### Manual Verification:

- The Kolumny popover shows Kwoty / Warstwy / Kolumny and no „Etapy" section; flipping Warstwy and
  Kwoty still behaves as before.
- No „Etap N %" column anywhere in the client view, in „Z narzędziami" or in „Bez narzędzi".
- „Etapy — kwota netto" is still visible by default and „…brutto" still default-hidden; both still
  toggle from the column picker, and „Praca" still hides them.
- The row-level „% wykonania (względem przedmiaru)" column still renders, and still turns red on a row
  where the etapy exceed the Przedmiar.
- Deleting a stage still removes its remaining columns cleanly with no stale width.
- A client preview (`/podglad-klienta/[id]`) renders without the percent column and the client-view
  settings dialog no longer offers „Etapy — % wykonania"; a kosztorys whose saved settings had that
  box ticked still opens without error.
- With a stale `table-columns:kosztorys-progress-display: "percent"` still in localStorage, the editor
  loads normally and shows the stage kwota columns.

**Implementation Note**: When this phase's automated verification passes, commit and continue — do
not pause for per-phase manual confirmation. Manual verification is collected once, at the end of the
change, into `context/foundation/manual-checks.md`.

---

## Phase 2: Documentation

### Overview

Bring the living docs in line so the next reader doesn't look for a column that isn't there.

### Changes Required:

#### 1. Domain notes

**File**: `context/reference/kosztorys-editor-domain-notes.md`

**Intent**: Remove the per-etap percent from the described column set and from the reading-axis
description, keeping the row-level „% wykonania" section intact.

**Contract**: The axis inventory (four axes → three) and any passage describing the per-etap percent
axis. The `„% wykonania" = Σ etapów / Przedmiar` definition stays — it documents the surviving
row-level column.

#### 2. Manual-checks registry

**File**: `context/foundation/manual-checks.md`

**Intent**: Retire any check that exercises the deleted axis; keep the „% wykonania" checks.

**Contract**: Re-read the two „% wykonania" entries — they describe the row-level column and survive.
Add this change's manual bullets per the registry's own format.

### Success Criteria:

#### Automated Verification:

- No doc still names the deleted symbols as live behaviour:
  `grep -rn "stageValuePercent\|progressDisplay" context/foundation context/reference` returns nothing

#### Manual Verification:

- The domain notes' axis list matches what the Kolumny popover actually offers.

---

## Testing Strategy

### Unit Tests:

No new tests are owed. This change removes a feature, so its coverage is removed with it; the work is
in **not losing** the two assertions that outlive the axis (the percent formatters, and `donePercent`'s
money-axis neutrality) — both are rehomed in Phase 1 §9 rather than deleted.

`context/foundation/test-plan.md` names no risk covering column visibility or reading axes, so there is
no plan entry to retire and none to anchor a replacement test on.

### Integration Tests:

None affected — none of the touched specs carry the `skipIf(!ENV_READY)` marker that
`scripts/test-integration.sh` discovers, so `pnpm test:integration` is untouched. The two
`pnpm test:parity` specs reference none of these symbols.

### E2E:

None owed. `e2e/**` has zero references to the percent columns or the axis. No `e2e-backlog` issue is
needed: this change removes UI rather than adding a browser-level risk.

### Manual Testing Steps:

Per the phase blocks above, driven at the review gate.

## Performance Considerations

Strictly positive and small: one fewer column per stage (up to 10 stages) in the assembled column
array, and one fewer predicate in `keep()`, which runs per column per render.

## Migration Notes

None. The column is computed, so no schema, no data, no backfill. Stored state self-heals — see Key
Discoveries. Deploy order carries no constraint: unlike a stored-column DROP (which must ship
code-first, `context/archive/2026-07-24-remove-section-coeff/`), nothing here reads a column that
could disappear underneath it.

## Whole-tree Gate

Run **once**, after the final phase.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`
- Build succeeds: `pnpm build`
- Dead-code sweep finds no orphan left behind by the deletion (`dead-code-scanner`), gated on
  typecheck rather than grep per `context/foundation/lessons.md`

## References

- Research: `context/changes/2026-08-17-drop-stage-percent-columns/research.md`
- The owner ruling this moots (a visibility decision, not a keep-the-column decision):
  `context/archive/2026-07-25-subcontractor-view-settlement-only/review-gate.md:30`
- Deletion-phasing precedent: `context/archive/2026-07-28-drop-cost-variant-columns/`
- Optional-carrier trap (removal lights nothing up; gate on `tsc`):
  `context/archive/2026-08-12-ex-672-remove-print-csv-export/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Remove the percent columns and the progress-display axis

#### Automated

- [x] 1.1 Rescued formatter specs run in their new home (`format.test.ts`) — afeff70c
- [x] 1.2 Grid/column specs pass (`src/__tests__/components/kosztorys/editor/grid/`) — afeff70c
- [x] 1.3 Calc and client-view specs pass — afeff70c
- [x] 1.4 No production reference survives (grep over `src` and `e2e`) — afeff70c
- [x] 1.5 `progress-display.ts` and `use-progress-display.ts` no longer exist — afeff70c

### Phase 2: Documentation

#### Automated

- [x] 2.1 No living doc still names the deleted symbols as behaviour — 98b6c03a
