# Kosztorys filters: visible and extended — Implementation Plan

## Overview

Two changes to the kosztorys editor's filtering, sharing one theme — the filter state stops being
something you can only read by opening a menu, and the registry that drives it grows three new axes.

1. **A chip bar** under the toolbar naming every source that is currently hiding rows, each removable
   in one click (EX-713).
2. **Three new complementary condition pairs** in the registry — discount, subcontractor-rate source,
   note (EX-714).

Both replace the cancelled EX-693 (a sheet-style per-column funnel), whose condition half duplicated
this registry and whose value half died on the stage/crew grain — see `change.md`.

## Current State Analysis

The editor hides rows through four independent mechanisms, and **none of them is legible without
opening something**:

| Source              | State                                            | Persisted                                   | Trigger tells you                             |
| ------------------- | ------------------------------------------------ | ------------------------------------------- | --------------------------------------------- |
| Search              | `search` (`use-kosztorys-view-state.ts:27`)      | no                                          | the text is in the input                      |
| Filter conditions   | `engagedConditionIds` via `useEngagedConditions` | **yes**, `kosztorys-filters:<investmentId>` | a count on „Filtry"                           |
| The engaged problem | same set, ids from `PROBLEM_CONDITIONS`          | **yes**, same store                         | „Problemy (1)" — at most one, by construction |
| Collapsed sections  | `collapsedSectionIds` (`:59-61`)                 | deliberately **no**                         | a count on „Filtry"                           |

Key facts the plan turns on:

- **Row filtering happens in one place** — `applyRowConditions` (`src/lib/kosztorys/row-conditions.ts:336`),
  called from `buildViewRows` (`src/lib/kosztorys/row-view.ts:88`) in the order search → conditions →
  sort. Hiders AND-remove, `diagnostic` keepers OR-keep, and `latchedRowIds` is a blunt bypass ahead
  of both.
- **`resetFilters` (`use-kosztorys-view-state.ts:84`) clears conditions + collapsed sections only** —
  it leaves `search` and `sort` alone.
- **Problems are mutually exclusive**: every problem row calls `toggleConditionExclusive(id, PROBLEM_IDS)`
  (`kosztorys-problems-menu.tsx:77,95`), so at most one is ever engaged.
- **`foldSuppressed` is `search.trim() !== ''` and nothing else** (`kosztorys-editor-body.tsx:168`).
  The archived first instalment recorded "an active item filter suppresses section folding" as a
  standing rule, but only search actually does it. Today the discrepancy is invisible; the chip bar
  puts both states on screen at once and makes it a visible lie.
- **The grid's height is measured on mount and on window resize only** (`src/hooks/use-element-height.ts`):
  `window.innerHeight − rect.top − 8`. There is **no ResizeObserver, on purpose** — one looped with
  react-datasheet-grid's own resize detector (`context/foundation/lessons.md`, the flicker lesson).
  `useElementHeight` has exactly one consumer (`use-kosztorys-editor.ts:141`).
- **No chip primitive exists in this repo.** No screen renders an active-filters bar. The nearest
  parts are `RemoveButton` (`src/components/ui/remove-button.tsx`, icon-only X), `BADGE_BASE`
  (`src/components/ui/badge.tsx`) and the `badge` button size/variants (`src/components/ui/button.tsx:22-40`).
- **`foldableSectionIds` (`use-kosztorys-editor.ts:464`) runs `sectionIdsWhereAllMatch` over every
  `kind: 'filter'` condition**, whether or not that condition has a `sectionLabel`. Today every
  filter has one, so the waste has never existed.

## Desired End State

Opening a kosztorys that was left filtered, the owner sees — without clicking anything — a row of
chips naming exactly what is hidden and by what, and can lift any one of them with a single click or
all of them with „Wyczyść wszystko". The „Filtry" menu grows three new axes (rabat, źródło stawki
wykonawcy, komentarz), each as a complementary pair, and an engaged filter now suppresses section
folding the way search always has.

Verified by: engaging a filter and a collapsed section together, then reloading — the chips report
both, unticking the filter's chip restores the rows, and the grid's bottom edge still sits at the
window bottom in both states.

### Key Discoveries

- Filter state is already centralized in one hook, so the chip bar can be a pure read of the context
  — no new state, no second source of truth (`use-kosztorys-view-state.ts:113-131`).
- A chip bar above the grid moves `rect.top` **without** triggering either re-measure trigger, so the
  grid keeps a stale, too-tall height and its bottom rows get clipped by the `overflow-hidden` shell.
- `conditionCounts` already computes whole-dataset counts for every registry condition
  (`use-kosztorys-editor.ts:374`), so chips get their numbers for free.
- The `kind: 'client'` conditions must never reach the chip bar: under `preview` the engaged set is
  the investment's stored client-view settings, not a reading gesture (`use-kosztorys-view-state.ts:37-39`).

## What We're NOT Doing

- **No value filters** (wykonawca / etap). Dropped during planning on their own merits — rationale in
  `change.md`. No Linear issue exists for them and none should be filed as a to-do.
- **No saved filter views** (named combinations). Still the natural next step toward the offer view,
  still a separate change.
- **No per-column funnel** in grid headers. That is the cancelled EX-693.
- **No change to what a filter DOES to totals.** Sums keep counting hidden rows.
- **No chips in the client preview.** `preview` renders its own header, not the toolbar.
- **No new persistence key.** Chips read the state that already exists; nothing new is stored.

## Implementation Approach

Phase 1 is pure registry + pure logic, testable without a renderer, and lands independently. Phase 2
is the UI, plus the two behavioural corrections the bar's honesty depends on (fold suppression and
reset scope). Phase 1 first, so the bar has the full set of things to show on the day it appears.

## Critical Implementation Details

**Grid height re-measure — dropped (owner, po implementacji).** It was built and then taken back out
together with the one-line bar. The trade it assumed ran the wrong way: the point of the bar is that a
filter cannot be on without being seen, and a chip past the right edge of a single scrolling line is
exactly the filter nobody knows about. So the bar **wraps**, its height follows the chip count, and
the grid keeps measuring on mount and window resize only — its bottom simply sits lower while filters
are on. `useElementHeight` stays as it was, single-consumer and observer-free.

**Chip bar wraps.** Superseded the original "one line, horizontally scrollable, never wrapping" —
which existed only to keep the grid's re-measure to a single flip, and stopped having a purpose once
the re-measure went.

**Reset scope changes an existing control.** Widening `resetFilters` to also clear `search` changes
what the „Zresetuj filtry" item in the „Filtry" menu does, and what the empty-state's reset button
does (`kosztorys-editor-body.tsx:349`). That is intended — one way back to „pokaż wszystko" — but it
is a behaviour change to two existing call sites, not only to the new bar.

## Phase 1: Three new condition pairs in the registry

### Overview

Add rabat, subcontractor-rate source and komentarz to `ROW_CONDITIONS` as complementary
`kind: 'filter'` pairs, and stop `foldableSectionIds` doing a full-dataset pass for conditions that
cannot fold a section.

### Changes Required:

#### 1. The registry

**File**: `src/lib/kosztorys/row-conditions.ts`

**Intent**: Add three axes as complementary pairs, following the existing entries' shape and comment
discipline. Each pair is what makes „pokaż mi tylko te z…" expressible by unticking the other half.

**Contract**: New `RowConditionT` entries appended in display order, all `kind: 'filter'`:

- `has-discount` / `no-discount` — „z rabatem" / „bez rabatu". Predicate: `discountType != null && discountValue > 0`.
  Written that way rather than on `discountType` alone because a type with a zero value takes nothing
  off the row (`rowDiscountForView`, `calc.ts:138`, derives the złotówki, never reads the raw input).
  Both halves carry a `sectionLabel` („Sekcje z rabatem" / „…bez rabatu") — a rabat concentrated in one
  section is a real question.
- `manual-rate-w-tools` / `formula-rate-w-tools` and the `own-tools` twin — „ze stawką wykonawcy wpisaną
  ręcznie" / „…liczoną z formuły", each `plane`-tagged. Predicate: the plane's
  `wToolsOverrideType` / `ownToolsOverrideType` being non-null vs null. Split per plane for the same
  reason the price diagnostics are: a row holds a stawka on both planes at once, so a single entry
  asking about "the active view" would answer for only half the kosztorys. `sectionLabel: null` —
  folding whole sections by where their rates came from hides pricing, which is the mistake „Zwiń puste
  sekcje" made.
- `has-note` / `no-note` — „z komentarzem" / „bez komentarza". Predicate: `note` non-null and non-blank
  after trim. `sectionLabel: null` — a section whose every row lacks a comment is not a section worth
  folding.

#### 2. Don't compute fold sets nothing can use

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts` (the `foldableSectionIds` memo, ~:464)

**Intent**: Skip `sectionIdsWhereAllMatch` for filter conditions declaring `sectionLabel: null`. Four
of the six new entries are such, and each would otherwise cost a full pass over every row on every
recompute — and that memo's deps include `rows`, so it recomputes on every edit.

**Contract**: The map keeps its `Map<conditionId, Set<sectionId>>` shape; ids that cannot fold simply
have no entry. `KosztorysFiltersMenu` already reads it with `?? new Set<number>()`
(`kosztorys-filters-menu.tsx:68`), and a section row with an empty set already renders unticked by
design, so the consumer needs no change.

#### 3. Menu length

**File**: `src/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu.tsx`

**Intent**: The „Prace" list goes from 4 rows to 12 if nothing is done. Render the two rate-source
pairs only when the active view is the plane they judge, so a reader in „Inwestor" — where no
subcontractor price is on screen at all — is not offered a filter about one.

**Contract**: The toggle list filters on `condition.plane == null || condition.plane === view`. `view`
is already on the context. Worst case becomes 10 rows in a crew view, 8 in „Inwestor".

### Success Criteria:

#### Automated Verification:

- New condition predicates covered in `src/__tests__/lib/kosztorys/row-conditions.test.ts`: a rabat
  typed with value 0 counts as „bez rabatu"; a whitespace-only komentarz counts as „bez komentarza";
  each rate-source entry judges its own plane and ignores the other.
- Complementarity holds — for every new pair, each row matches exactly one half:
  `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions.test.ts`

#### Manual Verification:

- „Filtry" → „Prace" lists the three new axes, and the rate-source pair appears only in a crew view.
- Unticking „z rabatem" leaves only rows with no rabat, and the totals do not move.
- Section rows under „Sekcje" offer „Sekcje z rabatem" and do not offer a section row for komentarz
  or rate source.

---

## Phase 2: The active-filter chip bar

### Overview

A one-line, horizontally scrollable bar under the toolbar's control row, naming every source that is
hiding rows, each with an X. Plus the two corrections that keep it from lying: an engaged filter
suppresses section folding, and „Wyczyść wszystko" clears everything the bar shows.

### Changes Required:

#### 1. The chip primitive

**File**: `src/components/ui/filter-chip.tsx` (new)

**Intent**: A label with a remove affordance — the repo has no such component, and this is the second
place (after the future filter views) that will want one, so it lands in `ui/` rather than beside the
editor.

**Contract**: Props: the label, an `onRemove`, and an optional count. Built on `BADGE_BASE` and the
`badge` button size so it matches the pills already on screen; the X is `RemoveButton`'s icon at badge
scale. Removal is a button, not a whole-chip click — a chip that removes itself on any click is a trap
next to text people want to read.

#### 2. The bar's model

**File**: `src/components/kosztorys/editor/toolbar/active-filters-model.ts` (new)

**Intent**: Turn the editor's filter state into an ordered list of chips. Pure and React-free, so the
question "what is currently hiding rows" is testable without a renderer — the split this codebase
already uses for `problems-menu-model.ts`.

**Contract**: Takes the engaged ids, the collapsed-section set, the search string, the whole-dataset
counts and the active view; returns `{ id, label, onRemoveKind }[]` describing:

- one chip per engaged `kind: 'filter'` condition, labelled „Ukryto: <label>" — the tick in the menu
  means visible, so the chip has to say the opposite of the label to mean the same thing;
- one chip for the engaged problem, if any (at most one, by construction);
- one aggregate chip „Zwinięte sekcje (N)" — never N chips, which would flood the bar on a big
  kosztorys;
- one chip for a non-empty search, showing the phrase.

`kind: 'client'` conditions are excluded — under `preview` the toolbar does not render at all, and an
owner's bar must never offer to lift a client-view setting.

#### 3. The bar

**File**: `src/components/kosztorys/editor/toolbar/kosztorys-active-filters-bar.tsx` (new)

**Intent**: Render the model. Absent entirely when the model is empty — no empty strip over the grid.

**Contract**: One line, `overflow-x-auto`, no wrapping. Ends with „Wyczyść wszystko" calling the
widened `resetFilters`. Each chip's X dispatches by kind: `toggleCondition` for a filter,
`toggleConditionExclusive(id, PROBLEM_IDS)` for the problem (the same call its own menu makes, so the
two can never disagree), `setCollapsedSectionIds(new Set())` for the sections chip, `setSearch('')`
for search.

#### 4. Placement

**File**: `src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx`

**Intent**: Render the bar as a second line inside the toolbar's own bordered container, below the
control row — part of the chrome, not a third band above the grid.

**Contract**: The bar is a sibling of the existing `flex flex-wrap` control row, inside the
`border-border shrink-0 border-b` wrapper. The wrapper keeps `shrink-0`, so the bar's height comes out
of the grid's.

#### 5. Re-measure the grid when the bar appears or goes

**File**: `src/hooks/use-element-height.ts`, `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: The bar changes `rect.top` without a mount or a window resize, so nothing re-measures and
the grid keeps a stale height. Give the hook a way to re-measure on demand and call it when the bar's
presence flips.

**Contract**: `useElementHeight` returns its `measure` alongside the ref and the height; the editor
runs it in a layout effect keyed on whether the bar is rendered. One consumer today, so the signature
change ripples nowhere else. Do **not** reach for a ResizeObserver — the hook's comment and the
flicker lesson forbid it, and a discrete state-driven re-measure is not what looped.

#### 6. Fold suppression follows every filter, not only search

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx` (the `bodyRows` memo, ~:163-171)

**Intent**: Make the archived standing rule true. With a filter engaged and sections collapsed, a row
is hidden twice and lifting the filter's chip appears to do nothing.

**Contract**: `foldSuppressed` becomes "search is non-empty **or** any engaged condition removes rows"
— `engagedHiders(engagedConditionIds).length > 0` (`row-conditions.ts:423`) is exactly that predicate
and already exists for the empty state. Collapsed sections are not cleared, only suppressed, so
lifting the filter restores them. Add `engagedConditionIds` to the memo's deps.

#### 7. Reset clears what the bar shows

**File**: `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts` (`resetFilters`, :84)

**Intent**: „Wyczyść wszystko" must mean it. Today `resetFilters` leaves `search` behind, so the bar
would keep a chip after the button that claims to clear everything.

**Contract**: `resetFilters` additionally clears `search`. `sort` stays — it hides no rows, and
clearing it would be an unasked side effect of a button about filters. The two existing callers (the
menu's „Zresetuj filtry", the empty state's reset) inherit the wider behaviour on purpose.

### Success Criteria:

#### Automated Verification:

- `src/__tests__/components/kosztorys/editor/toolbar/active-filters-model.test.ts`: an empty state
  yields no chips; a filter, a problem, three collapsed sections and a search yield four chips with
  the sections aggregated; `kind: 'client'` ids never produce one.
- `src/__tests__/lib/kosztorys/row-view.test.ts` (or the section-band spec): with a hider engaged and
  a section collapsed, the collapsed section's surviving rows are rendered — the fold is suppressed.
- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/toolbar/active-filters-model.test.ts`

#### Manual Verification:

- With no filters, no bar is rendered and the grid's bottom edge sits at the window bottom.
- Engaging a filter makes the bar appear and the grid's bottom edge **stays** at the window bottom —
  no clipped rows, no dead strip.
- Clicking a chip's X lifts exactly that one filter; „Wyczyść wszystko" empties the bar and restores
  every row, including clearing the search box.
- With ~8 filters engaged the bar stays one line and scrolls horizontally; the grid does not resize as
  chips are added.
- Collapsing sections and then engaging a filter shows the sections' matching rows, and lifting the
  filter restores the collapsed state.
- The client share link (`preview`) renders no bar.

---

## Testing Strategy

### Unit Tests:

- The three new condition pairs: complementarity, and each predicate's boundary (zero-value rabat,
  blank comment, per-plane override).
- The chip model: every source represented, sections aggregated, client conditions excluded, empty in
  means empty out.

### Integration Tests:

None owed. Both phases are pure logic plus one presentational component; nothing crosses a server
boundary.

### Manual Testing Steps:

Aggregated into `context/foundation/manual-checks.md` at the final phase, per the standing convention.

## Performance Considerations

Six new registry entries add six whole-dataset counting passes to `conditionCounts` and — after the
Phase 1 guard — two to `foldableSectionIds`. Both memos already recompute on `rows`, so at ~1000 rows
this is on the order of a few thousand extra predicate calls per edit; negligible against the passes
already there, and the guard removes more work than the new entries add for the four
non-folding conditions.

## Whole-tree Gate

Run once, after Phase 2.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`

## References

- Cancelled predecessor and its rationale: EX-693 (Linear), `change.md`
- First instalment, archived: `context/archive/2026-08-14-kosztorys-filter-conditions/change.md`
- Grid height / flicker constraint: `context/foundation/lessons.md` — "react-datasheet-grid in a flex
  container flickers"
- Registry: `src/lib/kosztorys/row-conditions.ts`; menu model precedent:
  `src/components/kosztorys/editor/toolbar/menus/problems-menu-model.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Three new condition pairs in the registry

#### Automated

- [x] 1.1 New condition predicates covered in `row-conditions.test.ts` (zero-value rabat, blank komentarz, per-plane rate source) — acf21753
- [x] 1.2 Complementarity holds for every new pair — acf21753

### Phase 2: The active-filter chip bar

#### Automated

- [x] 2.1 `active-filters-model.test.ts` — every source represented, sections aggregated, client conditions excluded
- [x] 2.2 Fold suppression under an engaged hider covered by a spec
