# Column reordering on the shared DataTable — Implementation Plan

## Overview

The kosztorys grid already lets the owner drag columns into the order they want. The primitive behind
it — a sparse rank map plus a framer `Reorder.Group` dialog — was written domain-free but lives under
`src/lib/kosztorys/` and `src/components/kosztorys/`, so the six TanStack tables in the app can't
reach it. This change promotes both into shared homes and feeds the resulting order into
`useReactTable`'s `columnOrder`, exposing it through the picker those tables already render.

## Current State Analysis

**What exists and is reusable unchanged:**

- `src/lib/kosztorys/column-order.ts` — `orderColumnKeys`, `rankForMove`, `baseRanksFromKeys`,
  `orderColumns`, `groupColumns`. Pure functions, zero domain knowledge, covered by
  `src/__tests__/lib/kosztorys/column-order.test.ts`.
- `src/components/kosztorys/editor/dialogs/column-order-dialog.tsx` — the drag surface. Already
  prop-driven: takes `ColumnToggleItemT[]` plus `ranks` / `baseRanks` / `onSetRank` / `onReset`. The
  only kosztorys-specific thing in it is one sentence of Polish copy.
- `src/components/ui/column-toggle-menu.tsx` — the shared, table-library-agnostic picker
  presentation, already consumed by both worlds.
- `src/components/filters/column-toggle.tsx` — the TanStack adapter over that menu.
- `src/components/kosztorys/editor/toolbar/kosztorys-view-menu.tsx:206-215` — the reference wiring:
  dialog as a **sibling** of the dropdown, never inside `DropdownMenuContent`.

**What's missing:** `src/components/ui/data-table/data-table.tsx` holds `sorting` and
`columnVisibility` state but never sets `columnOrder`, so every table renders in declaration order.

**Verified against `@tanstack/table-core@8.21.3` source** (these three facts drive the design):

- `core/table.ts:499-505` — `getAllLeafColumns()` runs its columns through `_getOrderColumnsFn()`.
  `core/row.ts:170` builds `getAllCells()` from that. **Cells are therefore already ordered**, so
  turning `columnOrder` on cannot desync headers from body. An earlier read of this said otherwise;
  it was wrong, and Phase 5 is a simplification rather than the correctness fix it was first taken for.
- `features/ColumnOrdering.ts:152` — ids absent from `columnOrder` are appended **at the end**. A
  persisted dense `string[]` would therefore freeze today's column set and dump every future column
  at the end for anyone who ever dragged once. The sparse rank map is what avoids that: an unranked
  key sorts at its declared index. Because we always feed a complete array derived from the live
  column set, that append branch never fires.
- `features/ColumnVisibility.ts:215-222` — `getVisibleCells()` = left + center + right visible cells,
  where `_getAllVisibleCells()` filters `getAllCells()` by `getIsVisible()`. With no pinning in use
  this is exactly what `data-table-row.tsx:63-65` hand-rolls today.

**The six in-scope tables** (the ones already passing `storageKey`):
`transfers`, `investments`, `fleet`, `users`, `leads`, `cashRegisters`.

## Desired End State

On each of the six tables, the „Kolumny" dropdown carries a „Ustaw kolejność kolumn…" row. It opens
the same drag dialog the kosztorys grid uses. A dropped column persists to `localStorage` under a
per-table key, survives reload, and a column added to the table later still appears at the position
the code declares rather than at the far right. „Przywróć domyślną kolejność" clears the order and
leaves visibility alone.

Verified by: the adapter spec in Phase 4, plus the manual checks aggregated at the final phase.

### Key Discoveries

- `filters/column-toggle.tsx:17` reads `table.getAllColumns()` — **declaration order**. The reorder
  list must read `getAllLeafColumns()` (ordered) or the dialog opens showing the pre-drag order.
- Once `canHide` is gone, nothing filters the picker's list, so picker and dialog collapse onto one
  item list built from `getAllLeafColumns()` — and the picker then renders in the user's chosen order
  too, matching the kosztorys picker (whose list the dialog's own comment calls "already in grid order").
- `transfer-data-table.tsx:59` reuses the `"transfers"` storage key across pages that pass different
  `excludeColumns`. Sparse ranks handle this by construction — a rank on an absent key simply doesn't
  apply. This is the same multi-view case `column-order.ts` already reasons about in its comments.
- `fleet-data-table.tsx:42-63`'s footer is already index-based (`indexOf(COSTS_COLUMN_ID)`), so it
  survives reordering. It is the only in-scope table with a footer.
- `create-json-map-store.ts` is the kosztorys persistence primitive, but it keys a module-level
  singleton per storage key. `DataTable` needs one store **per `storageKey` prop**, and its existing
  visibility persistence already solves the SSR-mismatch with a hydrate-after-mount effect. Phase 3
  mirrors that block rather than introducing a second persistence idiom into this file.

## What We're NOT Doing

- **The 4 keyless `<DataTable>` call sites** — `sheets/kosztorys-data-table`,
  `sheets/investments-without-sheet-table`, `kosztorys/summary/tables/materials-transactions-table`,
  `kosztorys/summary/tables/subcontractor-payouts-table`. None passes `storageKey` and none renders a
  column picker; joining in would cost both. They keep rendering in declaration order.
- **The positional footer in `materials-transactions-table.tsx:221-234`** (`colSpan: length − 2`,
  assumes `billed` is second-to-last). Only breaks under reordering, which that table never gets.
- Column resizing, pinning, or per-user server-side persistence. Order is a browser-local preference,
  same as visibility and the kosztorys widths.
- Backfilling or migrating existing `table-columns:*` visibility entries. Order is a new, separate key.
- A Playwright spec for the drag (filed to the E2E backlog in Phase 5 instead).

## Implementation Approach

Promote first, wire second. Phases 1 and 2 are pure moves and deletions that leave behaviour
identical — they can land and be verified before any new behaviour exists. Phase 3 adds the state and
the seam, Phase 4 the surface. Phase 5 cleans up and closes the gate.

The rank map is the persisted form, not the order itself. `DataTable` derives a dense
`columnOrder: string[]` from `orderColumnKeys(allLeafIds, ranks)` on each render; the dialog writes a
single rank per drop via `rankForMove`. That is the whole reason a column added next month lands
where the code puts it.

## Critical Implementation Details

**Dialog placement.** The dialog must render as a **sibling** of `DropdownMenu`, never inside
`DropdownMenuContent` — content unmounts with the menu on close and the dialog loses the focus fight.
`kosztorys-view-menu.tsx:205-215` carries the same constraint and its comment.

**Base ranks are per-render, not persisted.** `baseRanksFromKeys` must be computed from the _current_
leaf-column id list at the moment the dialog opens. `rankForMove` needs it to resolve the fallback
rank of an unmoved neighbour; persisting it would defeat the sparseness the whole design rests on.

---

## Phase 1: Promote the primitive

### Overview

Move the rank algebra and the drag dialog out of `kosztorys/` into shared homes. No behaviour change
anywhere — the kosztorys grid must look and act identically when this phase lands.

### Changes Required:

#### 1. Rank algebra

**File**: `src/lib/kosztorys/column-order.ts` → `src/lib/table/column-order.ts`

**Intent**: The module has no kosztorys knowledge; its home was an accident of where it was first
needed. Move it so a second consumer can import it without reaching into a feature directory.

**Contract**: All five exports (`ColumnRanksT`, `orderColumnKeys`, `rankForMove`,
`baseRanksFromKeys`, `groupColumns`, `orderColumns`) keep their signatures. Update the importers:
`components/kosztorys/editor/hooks/use-column-order.ts`,
`components/kosztorys/editor/dialogs/column-order-dialog.tsx`,
`components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`, and any other hit on
`@/lib/kosztorys/column-order`.

#### 2. Its spec

**File**: `src/__tests__/lib/kosztorys/column-order.test.ts` → `src/__tests__/lib/table/column-order.test.ts`

**Intent**: The mirroring rule in AGENTS.md ties a spec's path to its source's path — the spec moves
with the module.

**Contract**: Import path updated; assertions unchanged.

#### 3. The drag dialog

**File**: `src/components/kosztorys/editor/dialogs/column-order-dialog.tsx` → `src/components/ui/column-order-dialog.tsx`

**Intent**: Put it beside `column-toggle-menu.tsx`, its sibling in the same "shared presentation,
per-library adapter" split. It is already prop-driven and needs no structural change.

**Contract**: Props unchanged except one addition — `description?: string`, defaulting to the current
kosztorys sentence, so a table caller can say where its setting applies instead of claiming it works
„we wszystkich kosztorysach". `kosztorys-view-menu.tsx` updates its import and passes the kosztorys
description explicitly.

### Success Criteria:

#### Automated Verification:

- The moved algebra spec passes at its new path: `pnpm exec vitest run src/__tests__/lib/table/column-order.test.ts`
- The kosztorys column specs still pass: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/v2-columns-order.test.ts`
- No import of `@/lib/kosztorys/column-order` or `editor/dialogs/column-order-dialog` remains: `grep -rn "lib/kosztorys/column-order\|dialogs/column-order-dialog" src` returns nothing

#### Manual Verification:

- The kosztorys grid's „Ustaw kolejność kolumn" dialog opens, drags, and persists exactly as before the move

---

## Phase 2: Retire `canHide`

### Overview

Owner call: any column may be hidden. Removing the concept also collapses the picker list and the
reorder list into one, which Phase 4 depends on.

### Changes Required:

#### 1. The meta field

**File**: `src/components/tables/column-meta.ts`

**Intent**: Delete the `canHide?: boolean` declaration from the `ColumnMeta` module augmentation.

**Contract**: The other four meta fields (`label`, `align`, `tooltip`, `minWidth`) are untouched.

#### 2. The filter

**File**: `src/components/filters/column-toggle.tsx:17`

**Intent**: Drop the meta half of the filter. Nothing in the repo sets TanStack's own
`enableHiding: false`, so `getCanHide()` is unconditionally true and the whole `.filter(...)` goes.

**Contract**: The item list becomes every leaf column. Phase 4 changes the source call from
`getAllColumns()` to `getAllLeafColumns()`; this phase only removes the filter.

#### 3. The declaration sites

**Files**: `src/components/tables/investments.tsx:92`, `fleet.tsx:21`, `users.tsx:21`,
`leads.tsx:34`, `sheets.tsx:30,56,94,108`

**Intent**: Remove `canHide: false` from each `meta` object, keeping any sibling keys
(`minWidth: 'min-w-56'` on investments, `align: 'right'` on two sheets columns). Drop the `meta` key
entirely where `canHide` was its only member.

**Contract**: Accepted consequence — a user can now hide every column and land on an empty table,
recoverable from the picker. `sheets.tsx` is edited even though its two tables are out of scope for
reordering; the type field it references is being deleted, so it has no choice.

### Success Criteria:

#### Automated Verification:

- No reference survives: `grep -rn "canHide" src` returns nothing
- The tables' own specs still pass: `pnpm exec vitest run src/__tests__/components/tables` (skip the command if that directory holds no specs — this phase has no other phase-scoped automated check and is covered by the whole-tree gate)

#### Manual Verification:

- On the investments table, „Nazwa" now appears in the Kolumny list and can be unticked
- Hiding every column leaves an empty table that recovers from the picker

---

## Phase 3: Ranks in `DataTable`

### Overview

Persist a rank map per table, derive `columnOrder` from it, and widen the `toolbar` seam so the
controls can reach the writers.

### Changes Required:

#### 1. Persistence

**File**: `src/components/ui/data-table/column-visibility-storage.ts`

**Intent**: Add order persistence beside the visibility pair already in this file, under its own
key prefix so the two settings can't clobber each other.

**Contract**: `readOrder(key: string): ColumnRanksT` / `writeOrder(key: string, ranks: ColumnRanksT)`,
mirroring `readVisibility` / `writeVisibility` — same try/catch, same `{}` fallback on absent,
corrupt, or unavailable storage. Prefix `table-column-order:` (visibility keeps `table-columns:`).
Non-finite values are dropped on read, the same guard `use-column-order.ts` applies, because
`localStorage` is client-writable and a `NaN` would scramble the comparator with no error. Rename the
file to `column-prefs-storage.ts` and update the one importer.

#### 2. Order state

**File**: `src/components/ui/data-table/data-table.tsx`

**Intent**: Hold ranks in state, hydrate after mount, and hand `useReactTable` the derived order.

**Contract**: A `ranks` `useState<ColumnRanksT>({})` plus a hydration `useEffect` on `storageKey`,
mirroring the `columnVisibility` block at lines 57-61 — the effect is what keeps the server render
and the first client render agreeing. `state.columnOrder` becomes
`orderColumnKeys(table.getAllLeafColumns().map(c => c.id), ranks)`, computed from the column defs
rather than the table instance to avoid a read-during-construction cycle. Two writers, `setRank(key,
rank)` and `resetOrder()`, persist through `writeOrder` on every change exactly as
`onColumnVisibilityChange` does. Tables without a `storageKey` keep an empty map, so declaration
order stands and nothing persists.

#### 3. The toolbar seam

**File**: `src/components/ui/data-table/data-table.tsx` and its 8 toolbar call sites

**Intent**: The current `(table, columnVisibility) => ReactNode` has no room for the rank writers.
Widen it to a single object so future additions don't repeat this migration.

**Contract**: `toolbar?: (ctx: DataTableToolbarContextT<TData>) => React.ReactNode` where the context
carries `table`, `columnVisibility`, `ranks`, `setRank`, `resetOrder`. Call sites:
`transfers/transfer-data-table.tsx:65`, `investments/investment-data-table.tsx:54`,
`fleet/fleet-data-table.tsx:64`, `users/user-data-table.tsx:56`, `leads/leads-data-table.tsx:44`,
`cash-registers/cash-registers-table.tsx:85` destructure what they use; the two
argument-ignoring sites (`sheets/kosztorys-data-table.tsx:41`,
`sheets/investments-without-sheet-table.tsx:32`) need no edit.

### Success Criteria:

#### Automated Verification:

- New storage spec passes: `pnpm exec vitest run src/__tests__/components/ui/data-table/column-prefs-storage.test.ts` — round-trip, absent key → `{}`, corrupt JSON → `{}`, `NaN`/`"x"` rank dropped on read, order and visibility keys independent

#### Manual Verification:

- All six tables still render, sort, and toggle visibility exactly as before (no order UI yet)

---

## Phase 4: Wire the UI

### Overview

One item list, one picker, one dialog behind it.

### Changes Required:

#### 1. The menu entry

**File**: `src/components/ui/column-toggle-menu.tsx`

**Intent**: Offer the reorder trigger from inside the picker, where it costs no toolbar width and
matches the kosztorys surface.

**Contract**: An optional `onOpenOrder?: () => void`. When passed, the menu renders a separator and a
„Ustaw kolejność kolumn…" `DropdownMenuItem` (`ArrowUpDown` icon) below the checkbox list. When
absent — the kosztorys grid, which has its own menu — nothing renders and the component is unchanged.

#### 2. The adapter

**File**: `src/components/filters/column-toggle.tsx`

**Intent**: Own the dialog's open state, build the shared item list in current order, and translate a
drop into a single persisted rank.

**Contract**: Props gain `ranks`, `setRank`, `resetOrder` from the toolbar context. The item list
switches from `table.getAllColumns()` to `table.getAllLeafColumns()` so both surfaces read the user's
current order. `baseRanks` comes from `baseRanksFromKeys` over that same id list, recomputed per
render. Renders `<ColumnOrderDialog>` as a **sibling** of the menu with a table-flavoured
`description`, wired to `setRank` / `resetOrder`. When no rank writers are passed the component
behaves exactly as today.

### Success Criteria:

#### Automated Verification:

- New adapter spec passes: `pnpm exec vitest run src/__tests__/components/filters/column-toggle-order.test.ts` — pure functions over an id list, no hook renderer: an empty rank map yields declaration order; a rank moves one id and leaves the rest; an id absent from the map sorts at its declared index rather than the end; `rankForMove` at both edges and an interior drop produce an order matching the dragged list

#### Manual Verification:

- On transfers, the Kolumny dropdown shows „Ustaw kolejność kolumn…"; the dialog opens, a column drags, the table reorders on drop
- The new order survives a page reload
- „Przywróć domyślną kolejność" restores declaration order and leaves hidden columns hidden
- A hidden column appears greyed in the dialog, is still draggable, and lands in its set position when shown again
- Order set on `/transfery` also applies on another page reusing the `transfers` key, and a column excluded there is unaffected
- The fleet footer's „Razem" still sits under the costs column after reordering
- Investments and cash-registers reorder independently of each other (no key bleed)

---

## Phase 5: Cleanup & close

### Overview

Collapse the hand-rolled visible-cell filter onto TanStack's own, then discharge the E2E gate.

### Changes Required:

#### 1. Visible cells

**Files**: `src/components/ui/data-table/data-table-row.tsx`,
`src/components/ui/data-table/virtualized-table-body.tsx`, `src/components/ui/data-table/data-table.tsx`

**Intent**: `row.getAllCells().filter(cell => visibleColumnIds.has(cell.column.id))` reproduces
`getVisibleCells()` (`ColumnVisibility.ts:215-222`) by hand. Swapping it deletes the
`visibleColumnIds` prop and the two `new Set(...)` constructions that feed it.

**Contract**: `DataTableRow` loses its `visibleColumnIds` prop and calls `row.getVisibleCells()`.
`data-table.tsx` keeps `visibleColumnIdList` (the `footer` callback's public contract) but drops the
`Set`; `virtualized-table-body.tsx` keeps its own `Set` only if `leafHeaders` still needs it. This
touches all 10 `<DataTable>` call sites including the 4 out of scope — a rendering equivalence, not a
behaviour change, which is why it lands last with everything else already proven.

#### 2. E2E gate

**Intent**: The drag path is browser-level and AGENTS.md blocks archive until it is authored or
filed. File it.

**Contract**: A Linear issue in project "Wykonczymy" labelled `e2e-backlog`: drag a column in the
transfers picker, reload, assert header order held. Record its id in the review gate's findings list.
Reality-check the Linear MCP first — if unreachable, leave the box open and say so rather than claim
a filing.

### Success Criteria:

#### Automated Verification:

- The Phase 3 and 4 specs still pass: `pnpm exec vitest run src/__tests__/components/ui/data-table/column-prefs-storage.test.ts src/__tests__/components/filters/column-toggle-order.test.ts`
- No `visibleColumnIds` prop survives: `grep -rn "visibleColumnIds" src/components/ui/data-table` shows only the `footer` callback's parameter

#### Manual Verification:

- Every table still renders the same columns in the same order as before this phase — the six in scope and the four out of it
- The virtualized tables (materials transactions, subcontractor payouts) still size their columns correctly while scrolling

---

## Testing Strategy

### Unit Tests

- `column-order.test.ts` (moved, unchanged) — the rank algebra: midpoints, both edges, ties breaking
  by assemble index, an empty map as a no-op.
- `column-prefs-storage.test.ts` (new) — round-trip, absent/corrupt/unavailable storage, non-finite
  ranks dropped, order and visibility keys independent.
- `column-toggle-order.test.ts` (new) — the adapter's pure core: ranks + id list → ordered ids, and a
  drop's `rankForMove` producing an order that matches the dragged list. No hook renderer; this
  codebase deliberately has none.

### Integration Tests

None. Nothing here touches the DB, a server action, or a query — it is client state plus
`localStorage`, so `scripts/test-integration.sh` has nothing to discover.

### Manual Testing Steps

Aggregated into `context/foundation/manual-checks.md` at Phase 5 from the per-phase
`#### Manual Verification:` bullets above.

## Performance Considerations

`orderColumnKeys` is an O(n log n) sort over leaf-column ids — at most ~20 per table, on every
render. Negligible, and React Compiler handles the memoization. The drag itself is already solved:
`ColumnOrderDialog` drives the list from a local `useDraft` and commits one rank on drop, precisely
because writing on every crossing rebuilt the kosztorys grid between frames.

## Migration Notes

None. The rank map starts empty for every user, which is exactly declaration order. Existing
`table-columns:*` visibility entries are untouched under a different prefix.

## Whole-tree Gate

Run once, after Phase 5:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`
- Build succeeds: `pnpm build`

## References

- Change identity: `context/changes/2026-08-26-table-column-reordering/change.md`
- Reference wiring for the dialog-as-sibling constraint: `src/components/kosztorys/editor/toolbar/kosztorys-view-menu.tsx:205-215`
- Rank-map rationale: the comments in `src/lib/kosztorys/column-order.ts` and `src/components/kosztorys/editor/hooks/use-column-order.ts`
- TanStack facts verified in `@tanstack/table-core@8.21.3`: `core/table.ts:499`, `core/row.ts:170`, `features/ColumnOrdering.ts:118-157`, `features/ColumnVisibility.ts:215`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Promote the primitive

#### Automated

- [x] 1.1 Moved algebra spec passes at its new path — bef2cffe
- [x] 1.2 Kosztorys column-order grid spec still passes — bef2cffe
- [x] 1.3 No import of the old lib or dialog path remains — bef2cffe

### Phase 2: Retire `canHide`

#### Automated

- [x] 2.1 No `canHide` reference survives in `src` — ff1352d1
- [x] 2.2 The tables' own specs still pass — ff1352d1

### Phase 3: Ranks in `DataTable`

#### Automated

- [x] 3.1 `column-prefs-storage` spec passes — 88cbb781

### Phase 4: Wire the UI

#### Automated

- [x] 4.1 `column-toggle-order` adapter spec passes — be59be6a

### Phase 5: Cleanup & close

#### Automated

- [x] 5.1 Phase 3 and 4 specs still pass
- [x] 5.2 No `visibleColumnIds` prop survives outside the `footer` callback
