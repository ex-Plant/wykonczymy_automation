# Kosztorys editor — server-owned display order + hook decomposition (EX-521)

## Overview

Two jobs, in this order. First, **move ordering arithmetic entirely to the server**: the client
currently transcribes `shiftDisplayOrderFrom`'s SQL rule into two hand-written loops and caches
absolute `display_order` integers, so the same rule lives in three places and only agrees because
someone copied it carefully. Second, **decompose `use-kosztorys-editor.ts`** (1485 lines) — extracting
the untested core logic first, then three self-contained stateful clusters.

Ordering goes first because it _deletes_ code the decomposition would otherwise have to relocate and
then remove.

## Current State Analysis

`src/components/kosztorys/editor/use-kosztorys-editor.ts` is a 1485-line hook with 14 own state
pieces, 8 delegated hooks, ~50 top-level functions and a flat 62-key return. It has **exactly one
call site** (`kosztorys-editor-body.tsx:72`), which spreads the whole object into
`KosztorysEditorProvider` (`:188`); the context type is `ReturnType<typeof useKosztorysEditor>` and
fans out to 10 consumer components.

**Ordering today.** `display_order` is a contiguous-ish integer per owner (sections within an
investment, items within a section). The server owns three operations in
`src/lib/kosztorys/display-order.ts`: `shiftDisplayOrderFrom` (open a slot by pushing the tail down
one), `swapDisplayOrder` (exchange two rows in one statement), `renumberDisplayOrder` (bake a whole
new numbering). Both shift and swap lock through `ORDER BY id FOR UPDATE` so they cannot deadlock
against each other (EX-632) — a constraint any rework must preserve.

The client mirrors that rule twice:

- `use-kosztorys-editor.ts:252` holds `sectionOrderRef`, a `Map<sectionId, displayOrder>` seeded at
  mount, and `:909-912` replays the shift by hand after an insert. It exists solely so
  `applySectionSwap` (`:851`) knows which two integers to exchange.
- `handleInsertItem` (`:727-733`) replays the same shift across `prevById` so item rows keep accurate
  `displayOrder` values for a later `▲▼` or bake.

**This is not currently a user-visible bug.** Every path that changes stored order either goes
through the client (which updates its copy) or remounts the body via `key={remountKey}`
(`kosztorys-editor-v2.tsx:50`, restore/import). Deleting a section leaves a gap rather than
renumbering (`nextSectionDisplayOrder` uses `MAX+1`, deliberately). The defect is the triplicated
rule, not a live symptom.

**Testing.** No hook renderer exists and none is being added — settled in `research.md` and by
`lessons.md:389` / `:954`. The established pattern is a React-free core plus a thin hook wrapper
(`createUndoRedoStack`, `createSaveLanes`, `createJsonMapStore`). Consequently ~14 pure functions are
trapped in the hook body with **zero** coverage, including the keystroke change-planner
(`onChange`, `:1342-1396`) and the undo-reversal planners (`:571-623`) — precisely the code behind
test-plan risk **#4** ("editor data loss / no way to revert").

## Desired End State

- No `display_order` integer is computed anywhere on the client. Reordering is expressed as intent
  (`move this up`, `insert below that one`, `store this sequence`); the server resolves it inside the
  transaction that writes it.
- `sectionOrderRef` and both mirror loops are gone. `shiftDisplayOrderFrom`'s rule exists once.
- The keystroke change-planner, undo-reversal planners, money-axis choice and view-row pipeline are
  module-level pure functions under `src/lib/kosztorys/` with unit tests.
- `use-kosztorys-editor.ts` is roughly half its size, composing three new sub-hooks, and its **return
  object is unchanged** — same 62 keys, same shapes, so no consumer is touched.
- Typing in a 1000-row kosztorys feels exactly as it does on `staging`.

### Key Discoveries

- One call site + a flat named return ⇒ **`tsc` is a complete gate for the decomposition**, provided
  the return shape does not change (`kosztorys-editor-body.tsx:72`, `:188`).
- Display settings are **already** extracted (`useColumnWidths`, `useHiddenColumns`, `useColumnOrder`,
  `useMoneyAxis`, `usePriceView`, `useProgressDisplay`, `useLayer`, `useEngagedConditions`) — the
  un-carved clusters are settlement settings (~220 lines, `:1122-1340`), stage ops (~85 lines,
  `:954-1035`) and view state (~60 lines, scattered).
- `planKosztorysRenumber` already produces a per-section `0…n-1` sequence — the bake's payload is
  _already_ an ordering, dressed up as integers.
- `neighborSectionId` (`row-ops.ts:200-209`) and `sectionNeighbor` already resolve neighbours from the
  rows array; only the absolute integers come from the cached map.
- `patchRows` (`:1122`) is called by stage ops, section ops and settings — it must be resolved before
  any of those three clusters can move.
- `columnOpts` (`:390-424`, 34 keys) forward-references 12 handlers declared below it via function
  hoisting. Any sub-hook feeding it must be **called above** the column build.

## What We're NOT Doing

- **No `renderHook` / `@testing-library/react` / jsdom.** Declined with reasons in `research.md`.
- **No row/section operations split.** `handleAddItem` / `handleRemoveItem` / `handleReorderItem` /
  the section twins / the delete cascade stay in the main hook. They are genuinely intertwined with
  each other, `prevById` and the undo buffer; splitting them relocates a tangle rather than resolving
  it. Reconsider as its own change once ordering has simplified them.
- **No section-field bundle** (research finding 2). `sectionName` + `sectionColor` stay hand-listed at
  their 15 sites. The payoff arrives only if someone adds a third denormalized section field, which
  nothing schedules.
- **No undo command-as-data rework** (research finding 3). The "50 copies of the dataset" premise was
  wrong — rows are structurally shared, so the real retention is low single-digit MB. Record on
  EX-521 and close it.
- **No React Compiler chasing.** EX-496 rules `Nie ścigamy kompilacji poza rozbiciem hooka`; its one
  attempt regressed perf and was reverted.
- **No live multi-tab sync.** Two tabs editing one kosztorys is out of scope (and already the case for
  `rows`).
- **No data migration.** `display_order` column semantics are unchanged; only who computes the values.

## Implementation Approach

**Ordering (phases 1-2).** Each action's public signature changes from "here are the numbers" to
"here is the intent". Neighbour resolution and slot computation move into the same
`withPayloadTransaction` block that performs the write, so the read and the write are atomic — today
the client reads (from a stale-able cache) and the server writes, which is the split that permits
drift at all. `swapDisplayOrder` currently opens its own `getDb(payload)` outside a transaction; it
must move onto a caller-owned transaction handle **while preserving `ORDER BY id FOR UPDATE` in every
statement**, or EX-632's deadlock guard is lost.

**Decomposition (phases 3-6).** Two distinct moves, and only the first changes program structure:

- _Pure extraction_ — lift a function with no closure dependencies into `src/lib/kosztorys/`, pass its
  inputs explicitly, add tests. Zero render impact by construction.
- _Sub-hook_ — move a state cluster into `hooks/use-*.ts`, call it from the main hook **above** the
  column build, and spread its result flat into the same return object. The main hook shrinks; the
  returned shape is byte-identical.

### Critical Implementation Details

**Performance is a hard constraint, and it has a known failure mode.** EX-496's attempt to restructure
this hook moved interactive cell handlers off `columnOpts` into `KosztorysEditorProvider`. Because the
context _value is the whole hook return object_, its identity churns every render, and React re-renders
every consumer on a value-identity change — `React.memo` and datasheet-grid's per-row memoization do
not stop it. Result: every row and header cell re-rendered per keystroke on a 1000-row grid. Reverted.

Two review rules follow, and they are what makes the manual A/B likely to pass:

1. **Nothing moves into `KosztorysEditorProvider`.** Handlers reach cells through `columnOpts` props,
   as they do now.
2. **The return object keeps the same 62 keys, built the same way.** Sub-hooks are spread flat into it.
   Regrouping (`editor.view.search`) is forbidden — it would touch all 10 consumers _and_ change what
   re-renders.

**Ordering: `undo` for a reorder must survive the signature change.** `runReorderReversal` (`:653`)
and the bake's undo (`:842-847`) currently store absolute before/after integers. Once the client has
no integers, both must be re-expressed as intent — a swap's inverse is the opposite direction; a
bake's inverse is the previous id sequence. `touchedIds` stays captured **pre-mutation** (`:871-873`)
and travels as payload; it cannot be re-derived at dispatch time because a later delete prunes the
rows it names.

**`displayOrder` on `KosztorysV2RowT` may become dead.** After phase 2, check with `tsc` (not grep —
`lessons.md`) whether any client code still reads it. If nothing does, remove it from the row type;
if the bake or a sort still needs it, keep it and say why in a comment.

**Resolved (phase 2): kept — it is not a row-type field.** `KosztorysV2RowT` inherits it from
`KosztorysItemT`, the persisted item entity that `insert-kosztorys-tree` / `serialize-kosztorys` /
`kosztorys-tree` all write and read; removing it there is a server change with nothing to do with the
editor. The client side of it is gone regardless — no component computes on it any more (the comment
on `applyInsertItem` records that), the grid renders array position, and the bake sends ids only.

---

## Phase 1: Sections — the server owns section order

### Overview

`swapSectionOrderAction` and `insertSectionAction` take a section id and a direction. `sectionOrderRef`
and its mirror loop are deleted.

### Changes Required:

#### 1. Order-resolution helpers

**File**: `src/lib/kosztorys/display-order.ts`

**Intent**: Give the server the two reads it now has to perform itself — find a row's neighbour in a
direction, and find the slot an insert-relative-to-anchor should open. Both must run on a
caller-owned transaction handle so they are atomic with the write they inform.

**Contract**: Two new scope-parameterised exports taking `(db: DbExecutorT, scope: OrderScopeT,
ownerId: number, …)`; a neighbour resolver returning the adjacent row's `{ id, displayOrder }` or
`null` at the edge, and an anchor-relative slot resolver returning the `at` integer.
`swapDisplayOrder` changes from `(payload, …)` to a `DbExecutorT`-taking signature.
**Every statement keeps `ORDER BY id FOR UPDATE`** — the neighbour SELECT included, since it now
participates in the same lock ordering as the UPDATE that follows it.

#### 2. Section ordering actions

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: Re-express both section-ordering actions as intent, resolving inside one transaction.
`insertSectionAction` already runs in `withPayloadTransaction`; `swapSectionOrderAction` must be moved
into one.

**Contract**: `swapSectionOrderAction(sectionId: number, dir: 'up' | 'down')` and
`insertSectionAction(anchorSectionId: number, dir: 'above' | 'below')`. Both keep their
`ActionResultT` shape and cache tags. An edge no-op returns `{ success: true }` — moving the top
section up is not an error. New zod schemas replace `swapDisplayOrderSchema` at these two call sites;
`insertSectionSchema` loses `atDisplayOrder` and gains the anchor + direction.

Note `insertSectionAction` no longer receives `investmentId` from the client — it derives it from the
anchor section, which also closes a redundant-parameter trust gap.

#### 3. Hook: drop the section-order cache

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Delete `sectionOrderRef`, its seed, its mirror loop and all five writes. `applySectionSwap`
resolves the neighbour it needs for the _optimistic row move_ from `rowsRef` (it already calls
`neighborSectionId` for exactly this) and fires the direction-based action. `handleInsertSection`
passes anchor + direction; `handleAddSection` / `handleAppendedSections` stop caching returned orders.

**Contract**: `applySectionSwap(sectionId, dir)` keeps its `boolean` return (false at the edge, so no
undo command is pushed). The undo/redo closures keep working unchanged — they already pass a
direction. No key of the hook's return changes.

### Success Criteria:

#### Automated Verification:

- New DB-integration specs for the section neighbour + anchor-slot resolvers pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/display-order.test.ts`
- Existing `display-order` specs updated to the new signatures and passing (same file)
- A spec covers the edge no-op: moving the first section up, and the last down, leaves stored order unchanged

#### Manual Verification:

- ▲▼ on a section moves it and survives a reload
- „Wstaw sekcję powyżej/poniżej" lands the new section in the right slot and survives a reload
- Insert a section mid-sheet, then ▲▼ a later section — the correct two sections exchange (the scenario the deleted mirror existed to protect)
- Undo/redo of a section move restores the original order

---

## Phase 2: Items — server-owned order and a sequence-based bake

### Overview

The item twins of phase 1, plus „Zapisz kolejność" switching from computed integers to an ordered id
sequence. After this phase the client computes no `display_order` anywhere.

### Changes Required:

#### 1. Item ordering actions

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: Mirror phase 1 on the item scope, reusing the same helpers.

**Contract**: `swapItemOrderAction(itemId: number, dir: 'up' | 'down')` and
`insertItemAction(anchorItemId: number, dir: 'above' | 'below')`. The anchor's `sectionId` is derived
server-side rather than passed.

#### 2. Sequence-based renumber

**Files**: `src/lib/actions/kosztorys.ts`, `src/lib/kosztorys/display-order.ts`

**Intent**: The bake sends the order it wants, not the numbers it computed. The server groups the ids
by their own section and assigns `0…n-1` within each — which is exactly what `planKosztorysRenumber`
computes today, moved one layer down.

**Contract**: `renumberKosztorysOrderAction(investmentId: number, orderedItemIds: number[])`, the ids
in full sheet display order. `renumberDisplayOrderSchema` becomes an id-array schema keeping its
duplicate-id refusal. Ownership validation stays: every id must belong to a section of
`investmentId`, and the whole write still refuses atomically if one id is stale (a row deleted in
another tab) — the existing rollback-on-failure path depends on all-or-nothing.

#### 3. Hook: drop the item mirror and the client-side numbering

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Delete the `prevById` shift loop in `handleInsertItem`. `handleReorderItem` fires a
direction. `handlePersistKosztorysOrder` / `runKosztorysRenumber` send id sequences, with the
failure rollback re-sending the previous sequence. `runReorderReversal` becomes direction-based.

**Contract**: `runKosztorysRenumber(next: number[], revertTo: number[])`. The undo command for a bake
carries the two sequences plus its pre-captured `touchedIds`. `planKosztorysRenumber` returns id
sequences rather than `DisplayOrderRefT[]`; `applyKosztorysOrder` reorders rows by that sequence.
`insertDisplayOrder` and `OrderRefT` become dead — remove if `tsc` agrees.

### Success Criteria:

#### Automated Verification:

- Item-scope resolver specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/display-order.test.ts`
- A spec asserts the sequence bake assigns per-section `0…n-1` from a flat cross-section id list
- A spec asserts a stale id in the sequence refuses the entire write and leaves stored order untouched
- `planKosztorysRenumber` specs updated to the sequence return and passing
- `grep -rn "displayOrder" src/components/kosztorys/` shows no client-side arithmetic on it (read-only display uses are fine)

#### Manual Verification:

- ▲▼ on a pozycja moves it within its section and survives a reload
- „Wstaw pozycję powyżej/poniżej" lands correctly and survives a reload
- Sort by a column, „Zapisz kolejność", reload — the sorted order is stored
- Undo after a bake restores the previous order; redo re-applies it
- Insert a pozycja mid-section, then ▲▼ a later one — the correct two exchange

---

## Phase 3: Extract the untested core logic

### Overview

Lift the pure decision-making out of the hook body into `src/lib/kosztorys/` and test it. This is the
phase that pays down test-plan risk #4.

### Changes Required:

#### 1. Keystroke change planner

**Files**: `src/lib/kosztorys/grid-change-plan.ts` (new), `use-kosztorys-editor.ts`

**Intent**: The `onChange` loop decides, for each edited row, which fields actually changed, which
writes to fire and what to buffer for undo. It is the editor's central decision and is reachable today
only by typing in a browser.

**Contract**: `planGridChanges(next: KosztorysV2RowT[], prevById: Map<number, KosztorysV2RowT>)`
returning a plain description of field changes, stage changes and affected ids. The hook keeps the
imperative half — firing saves, setting state, arming the coalesce timer.

#### 2. Undo-reversal planners

**Files**: `src/lib/kosztorys/undo-reversal.ts` (new), `use-kosztorys-editor.ts`

**Intent**: `revertOne` (`:571`) and the write-planning half of `runGridReversal` (`:591`) decide how
buffered changes merge back per row and which save lane each restore belongs in. Untested.

**Contract**: A patch-builder merging reversals by row id, and a write planner pairing lane keys with
restore values. `runGridReversal` keeps only the dispatch. **The same lane keys must come out** — the
EX-526 undo↔autosave ordering guarantee depends on it.

#### 3. Small pure helpers

**Files**: `src/lib/kosztorys/money-axis.ts`, `src/lib/kosztorys/row-view.ts` (both new)

**Intent**: The effective-money-axis choice (`:239`, a three-branch conditional over view/preview/
persisted state) and the view-row pipeline (filter → conditions → sort, `:467-476`) are pure and
order-sensitive, and neither has a test.

**Contract**: `effectiveMoneyAxis(...)` returning the axis; `buildViewRows(...)` returning the visible
rows. Pipeline order is part of the contract — searching then sorting is not the same as sorting then
searching.

#### 4. Undo availability

**File**: `src/lib/kosztorys/undo-coalesce.ts`

**Intent**: `canUndo || hasPendingBurst` (`:1502-1503`) is the toolbar's enable rule and is the unit
test S-07 owes. It lands beside the existing coalescing logic rather than in a new file.

**Contract**: `undoAvailability(canUndo, canRedo, hasPendingBurst)` returning both flags.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/grid-change-plan.test.ts` — covers no-op edits, multi-field edits on one row, stage-cell edits, and an edit to a row absent from `prevById`
- `pnpm exec vitest run src/__tests__/lib/kosztorys/undo-reversal.test.ts` — covers merge-by-row-id and lane-key pairing
- `pnpm exec vitest run src/__tests__/lib/kosztorys/money-axis.test.ts` — covers all three branches incl. the subcontractor net lock
- `pnpm exec vitest run src/__tests__/lib/kosztorys/row-view.test.ts` — covers search+condition+sort interaction
- `pnpm exec vitest run src/__tests__/lib/kosztorys/undo-coalesce.test.ts` — extended with the pending-burst availability case

#### Manual Verification:

- Typing across several cells then undoing collapses to one step, as before
- Undo restores every field of a multi-field edit
- Search + a condition filter + a column sort combine as before

---

## Phase 4: Extract the settlement-settings cluster

### Overview

The largest coherent cluster (~220 lines, `:1122-1340`): global coefficients, VAT, settlement mode,
materials rate, global discount — each an optimistic-save handler pair plus the shared
`isSavingSettings` transition.

### Changes Required:

#### 1. Settings sub-hook

**Files**: `src/components/kosztorys/editor/hooks/use-kosztorys-settings.ts` (new), `use-kosztorys-editor.ts`

**Intent**: Move `optimisticSettingSave`, `saveSetting`, the five `apply*`/`handle*` pairs,
`handleApplyPercentDiscount`, `isSavingSettings` and the `globalDiscount` state into one hook. It is
the thinnest-coupled mutation cluster: it needs only `patchRows`, the undo push and the tree's
settings.

**Contract**: `useKosztorysSettings({ investmentId, tree, patchRows, pushReversible, ... })` returning
exactly the keys the main hook currently returns for these — spread flat, **no renaming**. Must be
called **above** the column build, since `columnOpts` references settings handlers.

`patchRows` stays in the main hook (stage ops and section ops also call it) and is passed in as an
argument. `globalDiscountRef`'s latest-value pattern moves with the state it guards.

### Success Criteria:

#### Automated Verification:

- No spec changes expected; existing kosztorys specs still pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/`
- The hook's return type is unchanged — verified by `tsc` against the 10 untouched consumers

#### Manual Verification:

- Changing a global coefficient updates the grid and the totals, and persists across reload
- VAT change, settlement mode change, materials rate change each behave as before
- Global discount toggle + percent discount behave as before, incl. undo

---

## Phase 5: Extract stage operations

### Overview

~85 lines (`:954-1035`): add/remove/rename a stage column, set its tool plane and worker.

### Changes Required:

#### 1. Stage-ops sub-hook

**Files**: `src/components/kosztorys/editor/hooks/use-kosztorys-stage-ops.ts` (new), `use-kosztorys-editor.ts`

**Intent**: Move `stages` state, `stagesRef`, `patchStageField` and the five handlers out. This cluster
touches `rows` only through `patchRows` and never touches the undo stack — the loosest coupling of the
three mutation clusters.

**Contract**: `useKosztorysStageOps({ investmentId, tree, patchRows, workers })` returning `stages`,
`stagesRef` and the handlers, spread flat under their existing names. Called above the column build.

`stagesRef` must stay a ref written during render (the rename no-op guard reads the fresh label) — do
not "clean it up" into state.

### Success Criteria:

#### Automated Verification:

- Existing stage specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/`
- Return type unchanged — `tsc`

#### Manual Verification:

- Add a stage column, rename it, set its plane and worker, remove it — all as before
- Removing a stage with recorded progress still warns/blocks as before

---

## Phase 6: Extract view state

### Overview

~60 lines, currently scattered: search, sort, collapsed sections, the resize guide, `resetFilters`,
and the preview-pinned view/condition composition.

### Changes Required:

#### 1. View-state sub-hook

**Files**: `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts` (new), `use-kosztorys-editor.ts`

**Intent**: Gather the read-only-presentation state into one place. It depends on nothing in the data
plane — no rows, no stages, no actions.

**Contract**: `useKosztorysViewState({ investmentId, preview, clientView })` returning `search`,
`setSearch`, `sort`, `setSortField`, `collapsedSectionIds`, `toggleSectionCollapsed`, `resetFilters`,
`guideX`, `setGuideX`, `view`, `engagedConditionIds`, `toggleCondition` under their existing names.

**The preview pinning is security-relevant** and must move verbatim: `view` is forced to `'client'`
under preview, and `engagedConditionIds` is forced to the client set. Both are half of the disclosure
lock described at `assertDisclosurePair` — do not simplify the branches.

### Success Criteria:

#### Automated Verification:

- Existing disclosure/preview specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/`
- Return type unchanged — `tsc`
- `src/components/kosztorys/editor/use-kosztorys-editor.ts` is under 900 lines: `wc -l`

#### Manual Verification:

- Search, sort, collapse/expand, „Zresetuj filtry" behave as before
- Column resize guide still tracks the cursor
- The client preview page still shows the client plane with no coefficient columns, regardless of `localStorage`
- **Performance A/B**: open a 1000+ row kosztorys on this branch and on `staging`, type continuously in a cell — no added lag or jumpiness

---

## Testing Strategy

### Unit Tests

- `planGridChanges` — no-op edits, multi-field, stage cells, unknown row id
- `undo-reversal` — merge-by-row-id, lane-key pairing (the EX-526 ordering contract)
- `effectiveMoneyAxis` — all three branches incl. the subcontractor net lock
- `buildViewRows` — pipeline order under combined search + condition + sort
- `undoAvailability` — the pending-burst case S-07 owes

### Integration Tests (DB-backed, `skipIf(!ENV_READY)`)

- Neighbour + anchor-slot resolvers, both scopes, incl. edge no-ops
- Sequence bake assigns per-section `0…n-1` from a flat cross-section id list
- A stale id refuses the whole bake atomically
- Insert-then-swap: the scenario the deleted client mirror existed to protect

### Manual Testing Steps

Collected into `context/foundation/manual-checks.md` at the final phase. The performance A/B is the
gate for the hard constraint and is run last, on the complete branch.

### Not covered

Browser-level undo/redo remains uncovered — already owed as **EX-525**, and section/row ⋯-menu
ordering as **EX-472**. This change does not discharge either; phases 1-2 make EX-472 more valuable,
so note the new action signatures on it.

## Performance Considerations

The whole constraint is stated under _Critical Implementation Details_: nothing moves into
`KosztorysEditorProvider`, and the return object keeps its 62 keys built the same way. Sub-hook
extraction is render-neutral by construction — the same `useState` calls run in the same order from
the same component. There is no automated perf guard in this repo and none is being added; the gate is
the manual A/B in phase 6.

Phases 1-2 slightly _increase_ server work per reorder (one extra indexed SELECT inside the
transaction, bounded by one owner's row count). ▲▼ is a user gesture, not a hot loop — acceptable.

## Migration Notes

No schema change and no data migration. `display_order` keeps its meaning; only the party computing
its values changes. No prod migration is owed by this change.

## Whole-tree Gate

Run **once**, after phase 6.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit suite passes: `pnpm test`
- DB-integration suite passes: `pnpm test:integration`
- Parity guard passes: `pnpm test:parity`
- Build succeeds: `pnpm build`

## References

- Research: `context/changes/2026-08-15-kosztorys-editor-hook-split/research.md`
- Reference pattern (React-free core + thin hook): `src/components/kosztorys/editor/hooks/use-undo-redo.ts:41-101`
- Lock-ordering constraint: `src/lib/kosztorys/display-order.ts:79-92` (EX-632)
- The reverted perf regression: `context/archive/2026-07-17-kosztorys-editor-compile-fix/change.md:34-52`
- No-hook-renderer doctrine: `context/foundation/lessons.md:389`, `:954`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Sections — the server owns section order

#### Automated

- [x] 1.1 Section neighbour + anchor-slot resolver specs pass — bf352988
- [x] 1.2 Existing display-order specs updated to new signatures and passing — bf352988
- [x] 1.3 Edge no-op spec (first section up, last section down) passes — bf352988

### Phase 2: Items — server-owned order and a sequence-based bake

#### Automated

- [x] 2.1 Item-scope resolver specs pass — b1a7cce1
- [x] 2.2 Sequence bake assigns per-section 0…n-1 from a flat id list — b1a7cce1
- [x] 2.3 Stale id refuses the entire bake atomically — b1a7cce1
- [x] 2.4 planKosztorysRenumber specs updated to the sequence return — b1a7cce1
- [x] 2.5 No client-side displayOrder arithmetic remains — b1a7cce1

### Phase 3: Extract the untested core logic

#### Automated

- [x] 3.1 grid-change-plan specs pass — 510833f4
- [x] 3.2 undo-reversal specs pass — 510833f4
- [x] 3.3 money-axis specs pass — 510833f4
- [x] 3.4 row-view specs pass — 510833f4
- [x] 3.5 undo-coalesce extended with pending-burst availability — 510833f4

### Phase 4: Extract the settlement-settings cluster

#### Automated

- [x] 4.1 Existing kosztorys specs still pass — c2678845
- [x] 4.2 Hook return type unchanged (tsc against untouched consumers) — c2678845

### Phase 5: Extract stage operations

#### Automated

- [x] 5.1 Existing stage specs pass — 1f1044f9
- [x] 5.2 Hook return type unchanged (tsc) — 1f1044f9

### Phase 6: Extract view state

#### Automated

- [x] 6.1 Existing disclosure/preview specs pass — a8761abc
- [x] 6.2 Hook return type unchanged (tsc) — a8761abc
- [ ] 6.3 use-kosztorys-editor.ts under 900 lines — MISSED: 1439 → 1040. The four carved groups do not add up to 540 lines; the remainder is ~330 lines of row/section ops (deliberately out of the carve) plus ~170 lines of derived-figure memos. Owner accepted 1040 rather than widen the carve.
