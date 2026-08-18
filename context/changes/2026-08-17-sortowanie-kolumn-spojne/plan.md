# Consistent column sorting across the kosztorys grid — implementation plan

## Overview

Every data column in the v2 grid should be sortable from its header. Today sorting is selective —
not by design, but as a side effect of which header helper a column happened to use. Five column
groups are missing it: the stage qty columns, the per-stage value columns (netto/brutto),
„Komentarz", „Źródło ceny wykonawcy" and „Mnożnik". This change gives each of them a sort key and a
header affordance, and removes the now-dead `sortable` escape hatch so the next column can't opt out
by accident.

## Current State Analysis

Sorting is wired through three independent pieces, and only the first one is complete:

- **The engine is generic and needs no change.** `sortRows` (`src/lib/kosztorys/row-view.ts:38`)
  decorates-sorts-undecorates, compares numbers numerically and strings with `pl` collation, and
  sinks `null` keys to the bottom under _both_ directions. `sortRowsWithinSections` (`:66`) delegates
  to the same comparator, so the „zachowując sekcje" scope inherits every rule for free.
- **The key resolver is a static `switch`.** `columnSortValue`
  (`src/lib/kosztorys/sort-value.ts:24`) has a case per computed column and a `default` that reads
  `row[field]`. The `default` returns `''` both when a field is empty _and_ when it does not exist on
  the row — which is exactly how a missing key becomes a silent no-op (EX-487).
- **Three different header components exist, and only one of them knows about sorting.**
  - `title()` (`kosztorys-v2-columns.tsx:130`) renders `SortHeader` — used by most columns, with a
    `sortable = true` third parameter that three call sites pass `false` to (`:283`, `:284`, `:517`).
  - `StageHeader` (`grid/stage-header.tsx`) — its own `HeaderMenu` with rename / remove / plane /
    worker actions, and no sort items at all.
  - `stageValueHeader()` (`kosztorys-v2-columns.tsx:160`) — a plain `HeaderLabel` in a tooltip, no
    menu whatsoever.

The two subcontractor columns are the sharp case. The comment at `kosztorys-v2-columns.tsx:125-126`
justifies their `sortable: false` as "categorical or dash-laden", but that is not the real blocker:
their column ids (`priceMode`, `priceCoeff`) are **not row fields**. The fields are per-plane —
`OVERRIDE_FIELDS` (`src/lib/kosztorys/constants.ts:5-11`) maps `w_tools` →
`wToolsOverrideType`/`wToolsOverrideValue` and `own_tools` → the `ownTools*` pair. So flipping the
flag alone would render a sort caret over a `default` branch reading `undefined`.

Three facts remove work that would otherwise be in scope:

- **Stage qty columns already have a working sort key** (research, 2026-08-18). `stage_<id>` is a real
  row field — `treeToRows` seeds `stageFields[stageKey(st.id)] = qty[st.id] ?? 0`
  (`src/lib/kosztorys/v2-rows.ts:36`) and `KosztorysV2RowT` carries the index signature
  `{ [stageKey: StageKeyT]: number }` (`types.ts:207-211`) — so the `default` branch resolves it
  correctly and always as a number. Rows with no work in a stage cluster at 0; there is no
  null-vs-zero decision for that axis. The comment at `kosztorys-v2-columns.tsx:157-159` claiming
  `columnSortValue` "has no case" for per-stage ids is true of the two **value** namespaces and false
  of the qty one. That axis needs a header affordance only, no key work.
- `renderedFieldIds` (`use-kosztorys-editor.ts:435`) is built from **column ids**, so stage columns
  are already in it. `reconcileSort` therefore drops a stage sort automatically when the stage is
  deleted or filtered out — no extra handling needed.
- The sort is **persisted nowhere** — not localStorage, URL, DB, preset or snapshot — so a stage id
  can never outlive its stage across a session. (Do not persist it as part of this change: the
  ghost-id reasoning at `stage-keys.ts:7-10` would reopen for `stage_<id>` if anyone did.)

„Zapisz kolejność" also comes for free: `display-order-plan.ts` renumbers each section by the active
sort's key (`use-kosztorys-editor.ts:789`), so any column that gains a key gains persistable order.

## Desired End State

Every column carrying data offers sorting from its own header, with a key that matches the figure the
cell shows. Verified by: opening any of the five column groups' headers in the editor and sorting
both directions, plus unit specs asserting each new key resolves to the rendered figure rather than
to the `default` branch's empty string.

Only two columns remain unsortable, and both are structural rather than exceptions: `actions` and
`layerGap` hold no data to compare.

### Key Discoveries:

- `sortRows` already sinks `null` to the bottom in both directions (`row-view.ts:37-49`) — that is
  the mechanism the „Mnożnik" decision relies on, not new behaviour.
- `SortHeader` (`grid/sort-header.tsx:22`) takes `label`, `active`, `onSort`, optional
  `onPersistOrder` and `tip` — everything the stage-value headers need, so phase 3 composes it rather
  than building a second sort menu.
- `HeaderMenu` (`components/ui/datasheet-grid/header-menu.tsx`) is the shared trigger+menu primitive
  both `SortHeader` and `StageHeader` already compose, so the two menus stay visually identical
  without any shared-styling work.
- `stage-keys.ts` has key **builders** only (`stageKey`, `stageValueNetKey`, `stageValueGrossKey`) —
  no reverse parsers. Phase 1 adds them there, next to the prefixes they must agree with.
- Preview/read-only falls out of the existing wiring: `onSetSort` is passed through `editorOnly(...)`
  (`use-kosztorys-editor.ts:399`), so it is `undefined` in a client preview and every header helper
  must keep its "no callback → plain label" branch.
- `src/__tests__/lib/kosztorys/kosztorys-sort-value.test.ts` is a purpose-built EX-487 harness: its
  fixture orders raw fields _opposite_ to computed figures, so a green test cannot be an artefact of
  input order surviving. New keys extend this file.

## What We're NOT Doing

- No completeness/guard test asserting every assembled column has a sort key, and no change to
  `columnSortValue`'s contract to distinguish "field absent" from "field empty" — both keep resolving
  the same way (owner call — the guard would only check _presence_ of a key, never its correctness).
  Step 3 changes what that shared resolution _is_ (`null` instead of `''`), not the fact that the two
  are indistinguishable.
- No UI signal when a sort dies because its column stopped rendering. `reconcileSort` already clears
  it silently (EX-486), and per-stage keys make that reachable from a „Problemy" filter click as well
  as from an axis toggle. Accepted as-is; if it bites in use it is its own change.
- No sorting for `actions` or `layerGap` — neither holds a comparable value.
- No change to `sortRows` / `sortRowsWithinSections`, the sort scopes, or the `null`-sinking rule.
- No change to filtering („Problemy" conditions, stage narrowing) — this change is sorting only.
- Not touching the degenerate „Sekcja" + „zachowując sekcje" combination (sorting by section name
  within section groups is an identity permutation). It exists today, breaks nothing, and is not part
  of the selective-sorting problem.
- No new columns, no relabelling, no change to the column picker, money axis, or layer axis.

## Implementation Approach

Keep one central key resolver (`columnSortValue`) and teach it the two shapes it cannot express
today: **dynamic per-stage ids** (matched by prefix, with the stage id parsed back out) and
**per-plane fields** (resolved through `OVERRIDE_FIELDS` by the active view). Then bring the two
sort-blind header components up to `SortHeader`'s behaviour, and delete the `sortable` opt-out once
its last call site is gone.

Phases are ordered so the risky half is provable first: after phase 1 every new sort key is unit
tested without rendering anything, leaving phases 2 and 3 as pure header wiring.

## Critical Implementation Details

**Shared denominator for stage value keys.** A stage-value cell computes
`stageValueForView(r, r[qtyKey] ?? 0, totalQtyDone(r), view)` where `totalQtyDone` is Σ of the stages
**of the whole view** — deliberately not the filtered/shown subset
(`kosztorys-v2-columns.tsx:318-322`). The sort key must use the same denominator, or a sorted list
and the amounts printed in it will disagree the moment a rabat is in play. `columnSortValue` receives
the full `stages` array, so it must compute `rowTotalQtyDone(row, stages, view)` itself rather than
being handed a pre-narrowed list.

## Phase 1: Sort keys for the five column groups

### Overview

Give every currently-keyless column a value in `columnSortValue`, including the two shapes the
`switch` cannot express today. Pure logic — no component touched, fully unit testable.

### Changes Required:

#### 1. Reverse parsers for the stage value namespaces

**File**: `src/lib/kosztorys/stage-keys.ts`

**Intent**: The key builders have no inverse, so nothing can turn `stageValueNet_7` back into stage id 7. Add the parsers next to the prefixes they must stay consistent with — splitting them into another
module is how the prefix and its parser drift apart.

**Contract**: One parser per **value** namespace, each returning the stage id or `null` for a
non-matching key. The qty namespace needs none (its key resolves as a plain row field). They must
reject a key belonging to a _different_ namespace rather than `Number()`-ing garbage into `NaN` — the
same trap the file's existing comment about `diffRow` warns about.

#### 2. Stage value keys

**File**: `src/lib/kosztorys/sort-value.ts`

**Intent**: `columnSortValue`'s `switch` matches exact field names, so per-stage ids never reach a
case. The qty axis needs nothing — it falls through to the `default` branch as a real row field. The
two value axes are computed at render, so they resolve to `''` today; add prefix-matched resolution
ahead of the `switch`'s `default` that recomputes the figure the cell renders.

**Contract**: Stage value netto → `stageValueForView(row, row[stageKey(id)] ?? 0,
rowTotalQtyDone(row, stages, view), view)`; brutto → the same passed through
`toGross(..., row.vatRate)`. A key naming a stage id absent from `stages` returns `null`.

#### 3. An empty value is an absence, not a key

**File**: `src/lib/kosztorys/sort-value.ts`

**Intent**: The `default` branch coerces anything non-numeric to `''` (`sort-value.ts:63`), and that
one line does two incompatible jobs. Two consequences, both found by research on 2026-08-18:

- **„Komentarz" would read as broken.** `note` is `string | null`; ascending, every row without a
  comment sorts to the **top** — most of the grid — before the first real comment appears. The cell
  renders nothing there, and `sortRows` already sinks `null` under both directions
  (`row-view.ts:34-37`). This is the same ruling the plan makes for „Mnożnik" under „kwota stała".
- **A cleared numeric cell corrupts an existing sort.** `KosztorysItemT` types `plannedQty` and
  `discountValue` as `number`, but the grid's float column is `Column<number|null>` and clearing a
  cell writes `null` (stated in-code at `kosztorys-v2-columns.tsx:92-98` and in `calc.ts`
  `rowDoneFraction`). That row's key becomes `''`, and `sortRows` compares a **string against a
  number**, so the whole column falls back to `localeCompare` — „10" sorts before „9" across every
  row. Reachable today on „Przedmiar" and „Rabat wart.".

Fixed here rather than filed: it is one line inside the function this phase already rewrites, and
leaving it would make the new „Komentarz" sort ship with the defect it was warned about.

**Contract**: the `default` branch returns `null` for `null`, `undefined` and `''`; a number passes
through as a number; any other string passes through as a string. Every empty-valued row then sinks
to the bottom under both directions, consistently with the „—" its cell renders — this also changes
„Opis prac", „j.m." and „Rabat typ", which is the intended consistency, not collateral.

#### 4. Per-plane subcontractor keys

**File**: `src/lib/kosztorys/sort-value.ts`

**Intent**: `priceCoeff` and `priceMode` are column ids, not row fields — the row carries
`wTools*`/`ownTools*` pairs instead. Resolve them through `OVERRIDE_FIELDS` at the active plane so
the two subcontractor views sort by their own numbers.

**Contract**: Both return `null` when `view === 'client'` (the columns are never assembled there, and
`effectiveCoeff` does not accept the client plane). `priceCoeff` → `null` under the `'amount'`
override type (the cell renders „—"); under `'coeff'` → the row's OWN override value, and only under
`auto` → `effectiveCoeff(row, view)`, the inherited investment default. (Corrected during
implementation: the cell reads the own value under `'coeff'` and treats `effectiveCoeff` as the auto
placeholder only, so an unconditional `effectiveCoeff` would have sorted every hand-set row by the
default it overrode.) `priceMode` → an explicit rank: `auto` (0) < `coeff` (1)
< `amount` (2), so ascending runs from inherited to most hand-overridden.

#### 5. Unit specs for every new key

**File**: `src/__tests__/lib/kosztorys/kosztorys-sort-value.test.ts`

**Intent**: Extend the existing EX-487 harness rather than starting a new file — its fixture is built
so a sort that silently no-ops leaves input order, which is the exact failure being guarded.

**Contract**: Cases for stage qty (the axis that already worked — a guard, since nothing asserted it),
stage value netto and brutto, `priceCoeff`, `priceMode`, and the empty-sinks rule from step 3
(an empty `note`, and a cleared `plannedQty` on a row alongside numeric ones — the case that
currently degrades the whole column to string comparison). Two assertions the row-field cases don't
need: the subcontractor keys must be exercised at **both** planes with rows whose `wTools*` and
`ownTools*` values order oppositely (reading the wrong plane is the one mistake here that would
otherwise pass), and `priceCoeff` must place an `'amount'` row last under both directions.

**Note**: the existing fixture's single stage has `plane: null`, which belongs to neither
subcontractor view — the per-plane cases need stages with a plane assigned.

### Success Criteria:

#### Automated Verification:

- New and existing sort-key specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/kosztorys-sort-value.test.ts`
- Sort-scope specs still pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-view-sort-scope.test.ts src/__tests__/lib/kosztorys/row-view-sort-within-sections.test.ts`

#### Manual Verification:

- None for this phase — nothing is reachable from the UI until phase 2.

---

## Phase 2: Headers that already have a menu

### Overview

Turn on sorting for the three columns whose header already renders `SortHeader` but opts out, and add
sort commands to `StageHeader`'s existing menu. Delete the `sortable` parameter once unused.

### Changes Required:

#### 1. Drop the `sortable` opt-out

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: „Komentarz", „Źródło ceny wykonawcy" and „Mnożnik" now have keys, so their three
`title(..., false)` call sites (`:283`, `:284`, `:517`) become plain `title(...)`. With the last
caller gone, the `sortable` parameter and the part of the helper's comment that justifies it are dead
— remove both, so the next column cannot silently opt out.

**Contract**: `title(field, opts)` — two parameters. The tip-vs-trigger split in the helper's
remaining comment stays; only the sortable rationale goes.

#### 2. Sort commands in the stage header menu

**File**: `src/components/kosztorys/editor/grid/stage-header.tsx`

**Intent**: A stage column's header is the only place to sort by how much was executed in that stage.
Its `HeaderMenu` already exists — add the same four sort commands plus „Zapisz kolejność" and
„Wyczyść sortowanie" that `SortHeader` offers, so both menus answer the same gestures.

**Contract**: New optional props mirroring `SortHeader`'s: the active `SortPickT | null` for this
stage's field, an `onSort` callback, and an optional `onPersistOrder`. The field id is
`stageKey(stage.id)` — resolved by the caller, not rebuilt here. Sort items sit **above** the roster
section, which is the one section that can run long (the file's existing placement rule). The
read-only branch (`stage-header.tsx:78`, no handlers → bare label) must stay a bare label: absent
`onSort` means no sort items, and a preview passes none of these callbacks.

#### 3. Pass the sort state to stage headers

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: `StageHeader` is constructed in the stage column map (`:412-454`) and currently receives
no sort context. Feed it the same three values `title()` reads from `opts`.

**Contract**: For each stage, `active` is `opts.sort?.field === stageKey(st.id)` reduced to its
`{dir, scope}`, `onSort` forwards to `opts.onSetSort?.(stageKey(st.id), pick)`, and `onPersistOrder`
is `opts.onPersistKosztorysOrder`. Both stage column branches — the editable one and the
plane-unconfirmed `computedColumn` one — share the single `header` element already built above them,
so this is one wiring site, not two.

### Success Criteria:

#### Automated Verification:

- Grid column specs still pass: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/`
- Preview/read-only column specs still pass: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts src/__tests__/components/kosztorys/editor/grid/v2-columns-readonly.test.ts`

#### Manual Verification:

- „Komentarz" sorts both directions, and rows without a comment sit at the bottom in both.
- „Źródło ceny wykonawcy" ascending runs auto → własny mnożnik → kwota stała, on both subcontractor
  views.
- „Mnożnik" sorts numerically, and rows showing „—" land at the bottom in both directions.
- A stage header's menu sorts by that stage's quantity, and its rename / remove / plane / worker
  actions still work.
- „Zapisz kolejność" under a stage sort writes that order, and it survives clearing the sort.
- Deleting the stage that is currently sorted clears the sort instead of freezing the rows.

---

## Phase 3: Headers for the per-stage value columns

### Overview

The netto/brutto value columns are the only group with no header menu at all. Give them one by
composing `SortHeader`, keeping their current label shape and tooltip.

### Changes Required:

#### 1. Sortable stage value header

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: `stageValueHeader()` (`:160`) renders a tooltip-wrapped label because no sort key existed
for these ids; phase 1 removed that reason. Compose `SortHeader` instead, mirroring `title()`'s
structure — including its fallback to a plain tooltip-wrapped label when `onSetSort` is absent, which
is what keeps a client preview menu-free.

**Contract**: Same rendered label as today (`<stage label or „Etap N"> netto|brutto`) and the same
group-level tip from `HEADER_TIPS`. The sort field is the column's own id (`stageValueNetKey(id)` /
`stageValueGrossKey(id)`), so the header and `columnSortValue` agree on one string. The stale comment
at `:157-159` explaining why these headers deliberately have no sort must go with the change — leaving
it would contradict the code.

**Note**: the header wraps rather than truncates into the taller fixed header row
(`KosztorysEditorBody`); verify the sort caret does not force a truncate at narrow column widths.

### Success Criteria:

#### Automated Verification:

- No new phase-scoped spec: this phase adds a header affordance over keys already covered by phase
  1's specs, and asserting "this title is a SortHeader element" would test the implementation rather
  than behaviour. The existing grid column specs are the regression check:
  `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/`

#### Manual Verification:

- A stage's „netto" column sorts by that stage's value, both directions.
- Sorting a stage's „netto" column orders rows the same way its „brutto" twin does.
- With a rabat active, the sorted order matches the amounts printed in the cells (shared denominator).
- The header still wraps its label and shows its tooltip, and the „Etapy — kwota brutto" axis toggle
  still hides the group.
- In the client preview the stage value headers render as plain labels with no menu.

---

## Testing Strategy

### Unit Tests:

- Each new key resolves to the figure its cell renders, on a fixture where raw fields order opposite
  to computed ones (existing harness rule).
- `priceCoeff` / `priceMode` at both subcontractor planes, with per-plane values ordered oppositely.
- `priceCoeff` returns `null` under `'amount'`, and the row sinks under both directions.
- Stage value netto/brutto keys computed with the whole-view denominator, asserted with a rabat in
  play so a wrong denominator changes the order.
- A stage key naming an id absent from `stages` returns `null` rather than throwing.

### Integration Tests:

None. Sorting is a pure function over rows plus header wiring; there is no server action, query, or
persistence path in this change. „Zapisz kolejność" already has its own coverage in
`display-order-plan.test.ts` and is key-agnostic.

### Manual Testing Steps:

1. Open a kosztorys with several stages, at least one rabat, and mixed subcontractor price sources.
2. Sort each of the five column groups both directions, in both sort scopes.
3. Switch between the client and both subcontractor views; confirm no sort survives onto a column
   that stopped rendering.
4. Toggle the money axis and the Praca/Postęp layer while a stage-value sort is active.
5. Open the client preview and confirm no header offers a menu.

## Performance Considerations

`sortRows` is decorate-sort-undecorate, so each key is computed once per row, not per comparison. The
stage value key is the only new O(stages) key — the same cost as the existing `net` / `remaining`
keys, and paid n times rather than ~2·n·log(n). No memoisation needed; the render-time
`memoisedByRow` cache in the columns module is a separate path and is deliberately not shared, since
`columnSortValue` runs outside the column build.

## Migration Notes

None — no schema, no stored state. Sort state is transient and per-session; column visibility,
widths and ranks are untouched.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`

## References

- Change identity: `context/changes/2026-08-17-sortowanie-kolumn-spojne/change.md`
- Prior sorting fixes this builds on: EX-487 (computed columns silently unsortable), EX-486 (a sort
  outliving its column) — both documented in `src/lib/kosztorys/sort-value.ts`
- Existing harness: `src/__tests__/lib/kosztorys/kosztorys-sort-value.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Sort keys for the five column groups

#### Automated

- [x] 1.1 New and existing sort-key specs pass
- [x] 1.2 Sort-scope specs still pass

### Phase 2: Headers that already have a menu

#### Automated

- [x] 2.1 Grid column specs still pass
- [x] 2.2 Preview/read-only column specs still pass

### Phase 3: Headers for the per-stage value columns

#### Automated

- [ ] 3.1 Existing grid column specs still pass (no new phase-scoped spec — see phase body)
