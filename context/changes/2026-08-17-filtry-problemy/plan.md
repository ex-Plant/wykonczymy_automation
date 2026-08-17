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

## Phase 4: A problem reveals the column it is about

### Overview

A problem filter that narrows to „pozycje bez ceny j.m." while the „Cena j.m." column is unticked in
the column picker shows you the right rows with the wrong thing missing. Each problem gains the set of
columns it is about, engaging it forces them present regardless of the stored tick, and disengaging
hands them back. Plus the two price rows say which **view** they belong to, since the price they judge
only renders there.

### Changes Required

#### 1. Each condition names the columns it is about

**File**: `src/lib/kosztorys/row-conditions.ts`

**Intent**: The link problem → column belongs on the condition, next to its predicate and its label —
not in a second lookup table in the grid, which is exactly how the label/header drift that
`column-config.ts` exists to prevent gets reintroduced.

**Contract**: `RowConditionT` gains `revealsColumns?: readonly string[]` and, on the two price rows,
`plane: ToolPlaneT`. Assignments:

- `no-client-price` → `['price']`
- `overpriced-w-tools` / `overpriced-own-tools` → `['price', 'priceMode', 'priceCoeff']` — the price is
  the symptom, „Źródło ceny wykonawcy" and „Mnożnik" are what compute it, so revealing the first
  without the other two shows a number nobody can act on (owner, explicit).

New export `columnsRevealedBy(engagedIds: Iterable<string>): ReadonlySet<string>` — the union over
engaged conditions, unknown ids ignored, empty set when nothing is engaged.

**Note**: „Cena j.m." and „cena wykonawcy" are one picker entry (`price`), relabelled per view, so all
three price problems point at the same target. `priceMode` / `priceCoeff` are only assembled in a
subcontractor view, so naming them from the client view is a harmless no-op — no view check needed.

#### 2. The grid honours the reveal

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts` — add
`revealedColumnIds?: ReadonlySet<string>`, transient like `engagedStageConditionIds`.

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Contract**: one clause in `keep()` (`:603`), beside the existing `UNPICKABLE_COLUMNS` escape:
`(UNPICKABLE_COLUMNS.has(key) || opts.revealedColumnIds?.has(key) || !opts.isHidden?.(key))`. It
overrides **the picker tick only** — never `axisAllows` / `layerAllows` / the przedmiar and preview
gates, which answer different questions. (`price` is in `AXIS_EXEMPT_COLUMNS` anyway, so the axis
question never arises for the main target.)

The picker list is untouched: a revealed column keeps listing its **stored** tick, so unticking it
while the problem is engaged is a no-op that takes effect on disengage. Deliberate — showing it ticked
would be a lie about what is stored, and disabling it would need a third state nobody asked for.

„Pozostało do rozliczenia" stays as it is: it is gated at **assembly**, not at the picker, because the
column reads „—" down almost every row while its filter is off. That is a stronger rule than this one,
not the same one.

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts` — derive `revealedColumnIds` from
the engaged set (empty under `preview`) and pass it into `columnOpts`.

#### 3. The price rows name their view

**File**: `src/lib/kosztorys/row-conditions.ts` — label becomes
`z nieprawidłową ceną wykonawcy w widoku ${PLANE_LABELS[plane].toLowerCase()}`. The old „— z
narzędziami" read as a kind of price rather than as a place to look.

**File**: `src/components/kosztorys/editor/toolbar/menus/filters-menu-model.ts` — `ProblemToggleT`
carries `plane?: ToolPlaneT`. The **id**, not a rendered icon: the module stays React-free.

**File**: `src/components/filters/filter-multi-select.tsx` — toggle items accept `icon?: ReactNode`,
rendered after the checkmark.

**File**: `src/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu.tsx` — maps
`toggle.plane` through `planeIcon`, the same glyph the view switcher and the etap header use, so the
row and the view it points at cannot drift apart.

**Accepted consequence**: engaged from the „Inwestor" view, a price problem narrows to the offending
pozycje but the revealed „Cena j.m." holds the client price — not the stawka that is wrong. The
alternative was switching the view out from under the click, which is a gesture nobody asked for. The
label is what closes the gap.

### Success Criteria

#### Automated Verification

- Extended spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions.test.ts`
  — `columnsRevealedBy` is empty with nothing engaged, unions two engaged problems, ignores an unknown
  id, and returns all three price columns for a plane condition.
- Extended spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/stage-column-filter.test.ts`
  — a revealed column survives a stored hide tick, is gone again once the problem is disengaged, and a
  reveal never overrides the axis/layer/preview gates.
- Extended spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/toolbar/menus/filters-menu-model.test.ts`
  — the price rows carry their plane and the „w widoku …" wording.

#### Manual Verification

- Untick „Cena j.m." in the column picker, engage „Pokaż pozycje bez ceny j.m." — the column comes
  back; disengage — it goes away again, still unticked in the picker.
- In a subcontractor view, a price problem brings back „Cena j.m.", „Źródło ceny wykonawcy" and
  „Mnożnik" together.
- Each price row shows its plane's glyph and reads „w widoku z narzędziami" / „bez narzędzi".
- Engaged from „Inwestor", the price row narrows the rows and reveals „Cena j.m." without switching
  the view.
- Nothing about the reveal survives a reload with the problem off — the picker tick is what persists.

---

## Phase 5: Fixing a problem from inside the filter that found it

### Overview

Phase 4 made a problem reveal the columns needed to fix it, which turned narrowing into a working
mode — and that exposed three defects that only bite once someone actually repairs a row in place.
All three are about the same seam: the grid treats the narrowed set and the cells inside it as
read-only surfaces.

### Changes Required

#### 1. A row must not vanish under the hands fixing it

`src/components/kosztorys/editor/hooks/use-condition-row-latch.ts` (new), consumed by
`use-kosztorys-editor.ts` and threaded through `buildViewRows` → `applyRowConditions`.

A condition stops matching the instant its problem is fixed, so the first digit of a cena drops the
row out of „bez ceny j.m." mid-keystroke — with the „Mnożnik" the same filter had just revealed.
The latch is add-only and keyed on the engaged set: while it holds, a shown pozycja stays shown and
newly broken ones still arrive; changing what is engaged empties it, and so does „Odśwież — ukryj
poprawione" at the top of the „Problemy" menu — the explicit release, added because toggling the
problem off and on to get the same effect is a workaround, not a gesture. It bypasses the conditions
only — the search still applies, because a search is a question being asked right now.

#### 2. „Cena j.m." and „Mnożnik" join the grid's keyboard model

`editable-cell-input.tsx` gains an optional `focus`; the two subcontractor cells pass the grid's flag
through and drop `keepFocus`.

These cells render a permanently live input that ignores the grid's editing flag, so the grid never
places the caret: one click selects, a second is needed to reach the input, and Enter or typing do
nothing. The stock columns implement the flag, which is why the same cena behaves differently in the
Inwestor view. The fix mirrors `textColumn`: inert to the pointer at rest, caret + selection on focus,
blur on the way out (which is what the existing settle path hangs off).

#### 3. „Źródło ceny wykonawcy" opens from the keyboard

`cell-select-menu.tsx` gains optional `open`/`onOpenChange`; `SubcontractorModeCell` drives them from
the grid's flag and reports the close back through `stopEditing`; the column takes `disableKeys`.

A dropdown only a click can open is a cell no keyboard reaches. The local „opened by click" flag is
what keeps the existing single click working, since Radix's own trigger fires where the grid can't
see it.

### Success Criteria

#### Automated Verification

- Extended spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions.test.ts`
  — a latched row survives both a diagnostic that stopped matching it and a filter that would hide it.
- Extended spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-view.test.ts`
  — the latch reaches the conditions and does **not** override the search.

#### Manual Verification

- Engage „Pokaż pozycje bez ceny j.m.", type `22` into one — the row stays, both digits land, and
  „Mnożnik" is still reachable next to it.
- Disengage and re-engage — the fixed pozycja is gone, the remaining ones are not.
- In a subcontractor view, walk to „Cena j.m." with the arrows: Enter opens it, typing replaces the
  value, Escape restores it, one click selects the cell and a second enters it.
- On „Źródło ceny wykonawcy": Enter opens the list, arrows walk it, Enter picks, Escape closes — and
  a single click still opens it as before.

---

## Phase 6: „Problemy" leaves „Filtry" and becomes a single choice

### Overview

Owner ruling after using phases 3–5: the problems belong on their own trigger, and only one at a time.
A filter says what the reader wants to see; a problem says what the kosztorys is waiting on — folding
the second into the first buried a warning one heading down a menu about something else. And once a
problem also narrows the grid and reveals its own columns (phase 4), two engaged at once showed the
union of two unrelated sets with nothing on screen to say which row belonged to which.

### Changes Required

#### 1. An exclusive engage, scoped to a named group

`use-engaged-conditions.ts` gains `toggleExclusive(id, within)`, surfaced through
`use-kosztorys-view-state.ts` and the editor context as `toggleConditionExclusive`.

The group is the caller's to name because one store holds both kinds: „Problemy" is exclusive,
„Prace" stacks, and an exclusivity that swept the whole store would untick those too. Picking the
engaged one again turns it off — there is no „wszystkie problemy" row, because the union is exactly
what makes no sense here.

#### 2. The model splits out of the filters menu

`filters-menu-model.ts` → `problems-menu-model.ts`: it now returns `problemToggles` + `hasProblems`
only, plus `allProblemIds()` — the list an exclusive pick has to clear to stay exclusive, and the one
thing that would silently break exclusivity if a problem went missing from it.

#### 3. Its own trigger

`kosztorys-problems-menu.tsx` (new), rendered before „Filtry" in the toolbar. The button exists only
while something is wrong: a permanent „Problemy (0)" would be chrome to skip past, whereas a button
that appears IS the alarm — hence the triangle and the destructive tone instead of a neutral icon and
a badge. A dot marks that one is engaged, not how many exist.

„Filtry" loses the triangle, the problem group, and the problems from its trigger count.

### Success Criteria

#### Automated Verification

- New spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/toolbar/menus/problems-menu-model.test.ts`
  — including that `allProblemIds()` covers every row the list can ever offer.

#### Manual Verification

- With a clean kosztorys the „Problemy" button is absent; break one pozycja and it appears.
- Picking a second problem drops the first — never both at once — and picking the engaged one clears it.
- „Filtry" no longer shows a triangle, and its count reacts only to „Prace" and zwinięte sekcje.

---

## Phase 7: A picked problem takes the reader to its view

### Overview

The accepted cost of phase 4 — narrowing to a stawka problem from „Inwestor" showed the right pozycje
with the client's price in the column the problem had just revealed — stops being necessary once the
list is single-choice: with one problem engaged there IS a „the" view to switch to.

### Changes Required

#### 1. `conditionPlane(id)` in the registry

The plane already sits on each condition; this only reads it, so no second table can drift from it.

#### 2. A transient view override in `use-kosztorys-view-state.ts`

Engaging a problem sets the override to its plane and nothing is written to the stored view — the same
rule as the revealed columns, so switching the problem off puts the reader back where they were. Four
conditions carry a plane (zbyt wysoka stawka ×2, brak stawki ×2); „bez ceny j.m.", „z pomiarem do
rozpisania" and both etap problems carry none and move nobody (owner: cena j.m. is typed in „Inwestor"
but repaired in the subcontractor views, so no single view is the right one).

An explicit view switch drops the override and leaves the problem engaged — the reader wins over the
problem that moved them, or the toolbar's most visible control would be dead while a filter is on.

### Success Criteria

#### Automated Verification

- Extended spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions.test.ts`
  — each stawka problem reports its plane; the planeless ones and an unknown id report none.

#### Manual Verification

- From „Inwestor", pick „ze zbyt wysoką stawką wykonawcy w widoku bez narzędzi" — the grid switches to
  that view and the revealed cena is the stawka being judged.
- Switch the view by hand: it holds, the problem stays engaged.
- Turn the problem off — the view goes back to the one before the pick, and a reload still opens on the
  stored view, not the one a problem borrowed.

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
- Column reveal: the union over engaged conditions; a reveal beats a stored hide tick but not the
  axis/layer/preview gates; disengaging restores the stored tick.

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

Run once, after the last phase. It ran clean after phase 3; phase 4 re-runs it.

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

- [x] 1.1 New spec passes: stage-conditions.test.ts — 1ddcfb18
- [x] 1.2 Extended registry spec passes: row-conditions.test.ts — 1ddcfb18
- [x] 1.3 Price-guard spec still passes: subcontractor-price-guard.test.ts — 1ddcfb18

### Phase 2: Stage-column narrowing in the grid

#### Automated

- [x] 2.1 New spec passes: stage-column-filter.test.ts — b3e15c3b
- [x] 2.2 Existing column specs still pass — b3e15c3b

### Phase 3: The „Problemy" group, the triangle, and the toolbar removal

#### Automated

- [x] 3.1 New spec passes: filters-menu-model.test.ts — 5ab77de4
- [x] 3.2 Existing kosztorys specs pass — 5ab77de4

### Phase 4: A problem reveals the column it is about

#### Automated

- [x] 4.1 Extended registry spec passes: row-conditions.test.ts (`columnsRevealedBy`) — c09a275d
- [x] 4.2 Extended column spec passes: stage-column-filter.test.ts (reveal beats a stored hide tick) — c09a275d
- [x] 4.3 Extended menu-model spec passes: filters-menu-model.test.ts (plane + „w widoku …") — c09a275d

### Phase 5: Fixing a problem from inside the filter that found it

#### Automated

- [x] 5.1 Extended registry spec passes: row-conditions.test.ts (a latched row survives both kinds) — 650aecd2
- [x] 5.2 Extended view spec passes: row-view.test.ts (latch reaches the conditions, not the search) — 650aecd2

### Phase 6: „Problemy" leaves „Filtry" and becomes a single choice

#### Automated

- [x] 6.1 New spec passes: problems-menu-model.test.ts (replaces filters-menu-model.test.ts) — 20da355d
- [x] 6.2 Typecheck clean across the moved model, the context, and both menus — 20da355d

### Phase 7: A picked problem takes the reader to its view

#### Automated

- [x] 7.1 Extended registry spec passes: row-conditions.test.ts (`conditionPlane`) — 650aecd2

### Whole-tree gate

- [x] typecheck / lint / test / build — lint's 3 errors are pre-existing and outside this change
      (`test.js`, `hooks/use-latest-request.ts`)
- [x] re-run after phase 6 — typecheck / test (2379) / build clean; lint's 3 errors are the same
      pre-existing ones (`test.js`, `hooks/use-latest-request.ts`). The build first failed on a
      5-day-stale `.next-e2e/types` referencing a since-moved route; removed, it regenerates.
