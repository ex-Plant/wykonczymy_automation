# „Problemy" group in the Filtry menu — implementation plan

## Overview

Move the two toolbar diagnostics into the „Filtry" dropdown under a new „Problemy" heading, add four
more problem rows (two subcontractor-price planes, two stage-level defects), and warn on the „Filtry"
trigger whenever any problem exists in the data. Two of the six rows act on **stages, not rows** — a
subject the condition registry has never had — so the change grows a second, stage-shaped registry
and a transient stage-column narrowing in the grid.

## Current State Analysis

- `src/lib/kosztorys/row-conditions.ts` is the only condition registry and every predicate takes a
  **row**: `matches: (row: KosztorysV2RowT, ctx: RowConditionCtxT) => boolean`. Three kinds —
  `'filter'` (picker row, ticked by default, unticking hides its matches, they stack AND),
  `'diagnostic'` (toolbar button, off by default, engaged keeps ONLY its matches, multiple ones
  union OR), `'client'` (hidden via stored client-view settings).
- The two diagnostics render as toolbar buttons in
  `src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx:31,63-83`; each vanishes at
  count 0 (`if (count === 0) return null`) rather than disabling.
- `src/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu.tsx` takes **no props** —
  everything comes from `useKosztorysEditorContext`. Its `triggerCount` (`:91`) is
  `toggles.filter((t) => !t.active).length + collapsedSectionIds.size`, deliberately excluding
  diagnostics.
- `conditionCounts` (`src/components/kosztorys/editor/use-kosztorys-editor.ts:329-340`) is memoized on
  `[preview, rows, stages]`, already covers **every** `ROW_CONDITIONS` entry regardless of kind, runs
  over the full `rows` dataset (not `viewRows`), and returns 0 for everything under `preview`.
- `resetFilters` (`hooks/use-kosztorys-view-state.ts:55-58`) already clears diagnostics along with
  filters and collapsed sections.
- `src/components/filters/filter-multi-select.tsx` supports exactly **one** toggle group (`toggles` +
  `togglesHeading`). Its advanced surface (`toggles`, `optionToggles`, `triggerCount`, `resetAction`,
  the three headings, `bulkToggleLabel`) has a **single consumer** — the kosztorys menu. The other two
  call sites (`transfers/transfer-filters.tsx`, `cash-registers/cash-registers-table.tsx`) use only
  the base props, so changing the toggle-group shape is effectively single-consumer.
- `src/lib/kosztorys/subcontractor-price-guard.ts` — `checkSubcontractorPrice(row, plane)` returns a
  message string (else `null`) when the price is negative, or exceeds `MAX_CLIENT_SHARE = 0.8` of the
  pre-rabat client price. It is **per plane**, and it is the rule that already reddens the cell.
- `KosztorysStageT` (`src/lib/kosztorys/types.ts:100-106`) carries `plane: ToolPlaneT | null` and
  `workerId: number | null`. A plane-less stage renders red and locked
  (`grid/kosztorys-v2-columns.tsx:107-115,429-451`); a worker-less stage is visually indistinguishable
  from a correct one. Choosing a worker is **disabled while the plane is unset**
  (`grid/stage-header.tsx:166-169`).
- **No per-stage column visibility exists.** `src/lib/kosztorys/stage-keys.ts:6-13` explains why: a
  row per stage is noise, and a stage id in the _persisted_ visibility map is a ghost waiting to
  happen (Postgres reissues a deleted stage's id). That reasoning binds stored state only.
- Precedent for transient column presence: the „Pozostało do rozliczenia" column exists **only while
  its diagnostic is engaged** (`divergenceFilterEngaged`, `column-config.ts:141` `UNPICKABLE_COLUMNS`).
- Nothing in the app counts stages missing a plane or a worker. The only existing signals are one
  boolean badge (`subcontractor-due.ts:9` `hasUnconfirmedPlane`), the red column, and a residual
  „Bez przypisanego pracownika" money row in the summary.

## Desired End State

The toolbar has no diagnostic buttons. „Filtry" opens onto three groups: **Prace** (existing
complementary filters, tick = visible), **Problemy** (six imperative rows, tick = keep only), and the
section machinery below. Each „Problemy" row appears only when its count is above zero; the whole
group disappears when the kosztorys is clean. Whenever any problem exists — engaged or not — the
„Filtry" trigger carries a warning triangle instead of its usual filter icon. The trigger's count now
includes engaged problems.

Engaging a stage problem narrows the grid to the offending stage columns; engaging a row problem keeps
only the offending rows, unioning with any other engaged row problem exactly as today.

Verify: open a kosztorys with an unpriced pozycja, an overpriced subcontractor row, and a plane-less
stage → the trigger shows a triangle; the menu lists exactly the non-zero rows; ticking „Pokaż etapy
bez wybranego sposobu rozliczenia" leaves only that stage's columns standing.

### Key Discoveries

- The ghost-id ban is about **persistence**, not visibility — a transient filter never enters
  `use-hidden-columns.ts`'s stored map, so narrowing stage columns is legal.
  (`src/lib/kosztorys/stage-keys.ts:6-13`)
- `conditionCounts` already computes counts for diagnostics, so conditional row visibility and the
  trigger triangle need no new pass over the dataset.
  (`src/components/kosztorys/editor/use-kosztorys-editor.ts:329-340`)
- `FilterMultiSelect`'s toggle surface has one consumer, so it can be generalized to groups without a
  compatibility shim.
- A plane-less stage is by construction also worker-less. Counting them independently (owner's call)
  means such a stage appears in both rows.

## What We're NOT Doing

- No per-stage entry in the column picker, and no stage id in the persisted visibility map. The
  narrowing is transient state only.
- No second toggle for „Pozostało do rozliczenia" — it keeps arriving with its own filter and stays
  out of the picker.
- No change to how the existing „Prace" filters read or combine.
- No new amber/second-tier warning on the subcontractor price. The 80% ceiling is the only rule; the
  softer „above the global multiplier" tier was deliberately deleted (owner, 2026-07-28).
- No backfill or migration — nothing here is persisted.
- No change to transfers' or cash registers' filter menus beyond the mechanical prop rename.

## Implementation Approach

Three phases, bottom-up: the pure predicate layer first (testable with no renderer), then the grid's
stage narrowing, then the menu and the toolbar removal. Each phase leaves the app working — after
phase 1 the new row conditions are already counted and offered; after phase 2 the stage conditions
act; phase 3 is presentation.

Two registries rather than one: rows and stages are different subjects, and forcing a stage predicate
through a row-shaped signature would mean every stage condition ignoring its `row` argument. The stage
registry stays deliberately small — an id, a label, and a predicate over one stage.

## Critical Implementation Details

**Which stages the counts run over.** Stage counts use `stagesForView(stages, view)`, not the raw
list — a subcontractor view already drops plane-less stages entirely
(`src/lib/kosztorys/settlement-view.ts:15-30`), so counting them there would offer a filter that can
only ever empty the stage block. Row counts keep running over the full dataset, unchanged. This is
deliberately **asymmetric with the price conditions**, which are counted on both planes regardless of
the active view: a price exists on both planes for every row, whereas a stage belongs to one.

**Preview must stay inert.** `conditionCounts` already zeroes under `preview`; the engaged stage-
condition set passed to the column builder must likewise be empty there, so a client share can never
be narrowed by an owner's leftover problem filter.

## Phase 1: Predicate layer — price conditions and the stage registry

### Overview

Add the two subcontractor-price diagnostics to the row registry, and introduce a stage-condition
registry with its two entries. No UI yet; the price rows will already surface in the toolbar
diagnostics that phase 3 removes.

### Changes Required

#### 1. Subcontractor-price diagnostics

**File**: `src/lib/kosztorys/row-conditions.ts`

**Intent**: Two new `'diagnostic'` entries, one per tool plane, matching exactly the rows whose
subcontractor price the existing guard rejects. Reuse the guard rather than restating the 80% rule, so
the filter and the red cell can never disagree.

**Contract**: Two `RowConditionT` entries with ids `overpriced-w-tools` / `overpriced-own-tools`,
`kind: 'diagnostic'`, `tone: 'defect'`, `sectionLabel: null`, and
`matches: (row) => checkSubcontractorPrice(row, <plane>) != null`. Labels are the noun phrases the
menu prefixes — „z nieprawidłową ceną wykonawcy — z narzędziami" / „— bez narzędzi". Not „zawyżoną":
the same guard also rejects a negative price, and a label that names only the ceiling would lie about
the other half. `PLANE_LABELS` from `src/lib/kosztorys/constants.ts` owns the plane wording; do not
retype it.

Note the registry's existing invariant test asserts filters come in complementary pairs — diagnostics
are exempt, so it should keep passing untouched.

#### 2. Stage-condition registry

**File**: `src/lib/kosztorys/stage-conditions.ts` (new)

**Intent**: The stage-shaped twin of the row registry, holding the two defects a stage can carry. Kept
separate because the subject differs; kept minimal because a stage condition has no kinds, no section
lifting, and no complement.

**Contract**: `StageConditionT = { id: string; label: string; matches: (stage: KosztorysStageT) => boolean }`
plus `STAGE_CONDITIONS: StageConditionT[]` with `stage-no-plane` (`stage.plane == null`) and
`stage-no-worker` (`stage.workerId == null`). Labels are noun phrases reading after „Pokaż etapy ":
„bez wybranego sposobu rozliczenia" / „bez przypisanego wykonawcy". Export
`countMatchingStages(stages, conditionId)` and `stagesMatchingEngaged(stages, engagedIds)` — the
latter returns the input untouched when no stage condition is engaged, and otherwise the union of
every engaged condition's matches (same OR semantics as the row diagnostics, for the same reason:
under AND two engaged problems would ask for a stage that is both at once).

Ids share the flat namespace with `ROW_CONDITIONS` — one engaged-ids set drives both registries, so
the ids must not collide. Assert that in the test.

#### 3. Counts and engaged sets at the editor root

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Extend the existing counts map to cover stage conditions, and expose which stage
conditions are engaged so the grid and the menu can both read it.

**Contract**: `conditionCounts` gains one entry per `STAGE_CONDITIONS` id, counted over
`stagesForView(stages, view)` and zeroed under `preview` like the rest. Add
`engagedStageConditionIds` (empty under `preview`) to the hook's return, derived from
`engagedConditionIds` intersected with the stage registry. Memo keys must pick up `view`, which the
current `[preview, rows, stages]` list does not include.

### Success Criteria

#### Automated Verification

- New spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/stage-conditions.test.ts`
- Extended registry spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions.test.ts`
- Price-guard spec still passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/subcontractor-price-guard.test.ts`

#### Manual Verification

- The two new price diagnostics appear as toolbar buttons with plausible counts on a seeded kosztorys,
  and each keeps only rows whose subcontractor cell is red in that plane.

---

## Phase 2: Stage-column narrowing in the grid

### Overview

An engaged stage condition narrows the stage columns the grid assembles, on all three stage axes
(ilość, wartość netto, wartość brutto).

### Changes Required

#### 1. Narrow the stage list at column assembly

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: After the existing view filter picks the stages this plane shows, narrow further to the
stages the engaged problem filters match. One narrowing point, so all three stage axes inherit it and
none can drift.

**Contract**: `const viewStages = stagesForView(stages, view)` (`:318`) becomes the input to
`stagesMatchingEngaged`, and the result feeds the qty, value-net and value-gross column builders
(`:408`, `:454`, `:465`). The engaged id set arrives as a new field on the column-builder options
alongside the existing `divergenceFilterEngaged`. Empty set → identity, so nothing changes when no
stage problem is engaged.

#### 2. Thread the engaged set through

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Pass `engagedStageConditionIds` into the column builder next to `stages` and the stage
handlers, and add it to the columns memo's dependency list.

**Contract**: One added option on the existing `selectV2Columns` opts object (`:353-359`).

### Success Criteria

#### Automated Verification

- New spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/stage-column-filter.test.ts`
  — asserts all stages present when nothing is engaged; only plane-less stages when `stage-no-plane` is
  engaged; the union when both are engaged; all three stage axes narrowed consistently; identity under
  `preview`.
- Existing column specs still pass: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/`

#### Manual Verification

- With a plane-less stage present, engaging its filter leaves exactly that stage's three columns and
  hides the rest; disengaging restores them.
- The narrowed stage columns keep their red treatment and locked qty cell.
- Row totals and the summary are unaffected by the narrowing — it is a reading gesture, not a data
  filter.

---

## Phase 3: The „Problemy" group, the triangle, and the toolbar removal

### Overview

`FilterMultiSelect` grows a second toggle group; the kosztorys menu fills it with the six conditional
rows, warns on its trigger, and counts engaged problems; the toolbar loses its diagnostic buttons.

### Changes Required

#### 1. Toggle groups in the shared filter component

**File**: `src/components/filters/filter-multi-select.tsx`

**Intent**: Replace the single `toggles` + `togglesHeading` pair with a list of headed groups, so the
menu can render „Prace" and „Problemy" as separate blocks. Single consumer, so no compatibility shim.

**Contract**: `toggles?: ToggleT[]` + `togglesHeading?: string` become
`toggleGroups?: { heading?: string; items: ToggleT[] }[]`. Groups render in order, each as its own
`CommandGroup`, separated as the current single group is from the actions block. An empty `items`
array renders nothing (not an empty heading). Also add `iconClassName?: string`, forwarded to
`FilterTriggerButton`, so the caller can colour the trigger icon.

**File**: `src/components/filters/filter-trigger-button.tsx` — accept and apply `iconClassName`.

#### 2. The „Problemy" group

**File**: `src/components/kosztorys/editor/toolbar/menus/filters-menu-model.ts` (new)

**Intent**: The menu's arithmetic as a pure module — which problem rows to show, what each reads, the
trigger count, and whether to warn. Extracted rather than inlined because it is the part worth testing
and the component around it is not; this is the same React-free split the rest of the editor uses.

**Contract**: Given the engaged id set, the counts map, and the collapsed-section count, return
`{ problemToggles, triggerCount, hasProblems }`.

- `problemToggles` — one entry per `ROW_CONDITIONS` diagnostic then per `STAGE_CONDITIONS` entry,
  **filtered to count > 0**, labelled `Pokaż pozycje ${label} (${count})` /
  `Pokaż etapy ${label} (${count})`, with `active: engagedIds.has(id)`. Imperative because the tick
  means the opposite of what it means in „Prace": there a tick keeps a row visible, here it narrows to
  the row's matches.
- `triggerCount` — unticked „Prace" filters + collapsed sections + **engaged problems**. After phase 3
  nothing outside this menu signals that a problem filter is on, so the count has to carry it.
- `hasProblems` — any problem count above zero, engaged or not. It reports the **data**, not the
  gesture: the triangle answers „is something wrong in here", which is true before anyone clicks.
  Every one of the six counts toward it, „z pomiarem do rozpisania na etapy" included (owner).

**File**: `src/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu.tsx`

**Intent**: Feed the model, render both groups, and swap the trigger icon when a problem exists.

**Contract**: `toggleGroups={[{ heading: 'Prace', items: workToggles }, { heading: 'Problemy', items: problemToggles }]}`
— the „Problemy" group is omitted entirely when it has no items. `icon={hasProblems ? TriangleAlert : ListFilter}`
with `iconClassName` set to the destructive colour when warning. `triggerCount` comes from the model.
The reset action is untouched: `resetFilters` already clears diagnostics, and the stage conditions live
in the same engaged set, so they clear with it.

#### 3. Remove the toolbar diagnostics

**File**: `src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx`

**Intent**: Delete the diagnostics block and its now-unused context reads and imports.

**Contract**: Drop the `diagnostics` derivation (`:31`) and the render block (`:63-83`). Keep
`engagedConditionIds` / `toggleCondition` / `conditionCounts` in context — the menu still reads them —
but remove them from the toolbar's own destructure if nothing else there uses them.

### Success Criteria

#### Automated Verification

- New spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/toolbar/menus/filters-menu-model.test.ts`
  — a clean kosztorys yields no problem rows and no warning; a zero-count problem is absent while its
  non-zero neighbour shows; the trigger count sums all three sources; the warning fires on data alone
  with nothing engaged.
- Existing kosztorys specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/`

#### Manual Verification

- On a clean kosztorys the „Filtry" trigger shows its normal icon and the menu has no „Problemy"
  heading.
- With problems present the trigger carries a red triangle before anything is clicked.
- Each problem row narrows the grid as its wording promises; two engaged row problems union rather
  than intersect.
- The trigger's count rises when a problem is engaged and returns on „Zresetuj filtry", which also
  clears the stage narrowing.
- No diagnostic buttons remain on the toolbar; „Pozostało do rozliczenia" still appears when its row
  is ticked in the menu.
- The client share view (preview) shows no „Problemy" group and no triangle.

---

## Testing Strategy

### Unit Tests

- Stage registry: each predicate's boundary (a stage with a plane and no worker matches only
  `stage-no-worker`; a bare stage matches both — the deliberate double count); id-collision guard
  against `ROW_CONDITIONS`; `stagesMatchingEngaged` identity, single, and union cases.
- Price conditions: a row at exactly the ceiling does not match (the guard's tolerance); one above it
  does; a negative price matches; an unpriced row does **not** match (that is „bez ceny j.m.", a
  different problem).
- Column narrowing: the three stage axes stay in step; preview is identity.
- Menu model: conditional rows, trigger count, warning-on-data-not-gesture.

### Integration Tests

None — nothing here touches the database or a server action.

### Manual Testing Steps

1. Seed a kosztorys (`INV=6 node --env-file=.env --import tsx src/scripts/seed-kosztorys.ts`), clear
   one „Cena j.m.", overprice one subcontractor cell, add a stage and leave its plane unset.
2. Confirm the triangle, the six-row group with correct counts, and each row's narrowing.
3. Switch between „Klient" / „Z narzędziami" / „Bez narzędzi" and confirm the price rows persist while
   the stage rows follow what the view actually shows.
4. Open the client share link and confirm no problem surface leaks.

## Performance Considerations

The stage counts add one pass over the stage list per render of the counts memo — at most a few dozen
items against the existing per-row passes, so immaterial. The narrowing is a filter over the same list
inside a memo that already recomputes on `stages`.

## Migration Notes

None. Every piece of state involved is transient or already persisted under an existing key; a stored
engaged id that no longer resolves is already ignored by both registries.

## Whole-tree Gate

Run once, after phase 3.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full suite passes: `pnpm test`
- Build succeeds: `pnpm build`

## References

- Decisions and their rationale: `context/changes/2026-08-17-filtry-problemy/change.md`
- Transient-column precedent: `src/__tests__/components/kosztorys/editor/grid/divergence-column.test.ts`
- Why stage ids stay out of persisted state: `src/lib/kosztorys/stage-keys.ts:6-13`
- The price rule: `src/lib/kosztorys/subcontractor-price-guard.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Predicate layer — price conditions and the stage registry

#### Automated

- [x] 1.1 New spec passes: stage-conditions.test.ts
- [x] 1.2 Extended registry spec passes: row-conditions.test.ts
- [x] 1.3 Price-guard spec still passes: subcontractor-price-guard.test.ts

### Phase 2: Stage-column narrowing in the grid

#### Automated

- [ ] 2.1 New spec passes: stage-column-filter.test.ts
- [ ] 2.2 Existing column specs still pass

### Phase 3: The „Problemy" group, the triangle, and the toolbar removal

#### Automated

- [ ] 3.1 New spec passes: filters-menu-model.test.ts
- [ ] 3.2 Existing kosztorys specs pass
