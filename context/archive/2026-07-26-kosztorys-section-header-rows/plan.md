# Section group header rows in the kosztorys v2 grid — Implementation Plan

## Overview

Every row of the kosztorys grid repeats its section name in the „Sekcja" column — 325 rows, 14
distinct values, the same string over and over. Replace that with one **group header row per
section**: a coloured band carrying the section's colour dot, its name, its item count and its
executed net, opening each block. The band is collapsible, it carries the section's own actions
(rename, colour, insert, reorder, remove), and the „Sekcja" column survives as a hidden-by-default
column rather than being deleted.

Linear: **EX-580**.

## Current State Analysis

- `KosztorysEditorBody` (`src/components/kosztorys/editor/kosztorys-editor-body.tsx:145`) already
  appends two **synthetic rows** to the grid: a spacer (`SPACER_ROW_ID = -2`) and „Razem"
  (`TOTALS_ROW_ID = -1`). They are fake row objects (`{ id } as unknown as KosztorysV2RowT`) and a
  single module-level wrapper, `withTotalsRow` / `TotalsAwareCell`
  (`src/components/kosztorys/editor/grid/kosztorys-totals-row.tsx`), short-circuits on the id and
  renders a baked per-column string instead of the column's own cell. The header rows are the same
  mechanism with a third branch — this is the pattern to extend, not a new one to invent.
- The wrapper component **must stay module-level**: dsg remounts a cell whose `component` identity
  changed, which would tear down a focused `<input>` mid-edit. Per-row data rides on `columnData`
  (`kosztorys-totals-row.tsx:45-59`).
- Synthetic rows never reach the editor: `onChange` filters them out
  (`kosztorys-editor-body.tsx:207`), so a paste landing on one is silently dropped. That guard
  generalizes to "id < 0" and is the reason no `disabled` wrapping is needed.
- **Per-section figures already exist.** `subtotals` (`use-kosztorys-editor.ts:319`,
  `sectionSubtotalsForView`) carries `{ sectionId, sectionName, sectionColor, net, discount,
plannedNet, … }` for the active price view, over the **full dataset** — exactly like `totalNet`,
  which „Razem" shows. So the header's figure is a lookup, not a new arithmetic path, and it agrees
  with „Razem" and with Podsumowanie by construction.
- Section colour already reaches the row: `rowClassName` sets `--section-rail` from
  `rowData.sectionColor` and marks the first row of each section `kosztorys-section-start`
  (`kosztorys-editor-body.tsx:151-221`); the rules live in `globals.css` under `.kosztorys-grid`.
- The section actions live today inside the per-row „…" menu, as the „Sekcje" group of
  `KosztorysRowActionsMenu` (`grid/menus/kosztorys-row-actions-menu.tsx:131-142`), fed by
  `RowActionsCell` (`grid/kosztorys-v2-columns.tsx:212-229`) from four callbacks that share one
  `editorOnly()` gate.
- Rows are **contiguous by section**: `treeToRows` emits section blocks in `displayOrder`
  (`lib/kosztorys/v2-rows.ts:33-51`), and `filterRows` preserves order. A column **sort** breaks
  that — which is why the header rows disappear under an active sort.
- `DEFAULT_HIDDEN_COLUMNS` (`lib/kosztorys/column-config.ts:185`) is a sparse-map default: adding an
  id there hides the column for anyone who never toggled it explicitly, and leaves a deliberate
  choice intact.

## Desired End State

Opening `/inwestycje/<id>/kosztorys_v2`:

- Each section opens with a full-width coloured band: `▸ ● Nazwa sekcji · 12 poz.` on the left, the
  section's **wartość netto** under the „Razem netto" column (and brutto under „Razem brutto" when
  the money axis shows it).
- Clicking the band's chevron collapses the section to just that band; the „Razem" row and every
  other section stay put. Clicking again expands it.
- Double-clicking the name renames the section; the band's „…" menu holds colour, insert
  above/below, move up/down, delete — the per-row „…" menu now holds only „Prace".
- The „Sekcja" column no longer renders by default; it is still listed in „Kolumny" and shows on
  demand.
- Item numbers in the gutter run 1…N continuously; a band carries no number.
- Sorting a column makes every band disappear — flat table, „Razem" only. Clearing the sort brings
  them back.
- The share/preview (`clientView`) render shows the same bands, read-only.

Verify: `pnpm typecheck`, the new unit spec, and a visual pass on investment 42 (14 sections) plus
investment 7 (the ~1000-row perf dataset).

### Key Discoveries

- `withTotalsRow` (`grid/kosztorys-totals-row.tsx:63`) is a per-column wrapper over `columnData` —
  extending it to a third row kind costs one branch, not a second rendering path.
- A header row does **not** need to span columns. The design puts the label in `description` and the
  figure under `net`/`gross`, so each cell paints its own piece and dsg's own layout keeps the
  columns aligned through horizontal scroll — the same reason „Razem" is a real row.
- `subtotals` is full-dataset, so a search filter narrows the visible rows while the band still
  reports the whole section — **matching „Razem"**, which is full-dataset too. This is the
  consistent reading, not a bug to fix.
- dsg's built-in row numbering counts every rendered row, bands included. Continuous item numbering
  therefore needs a custom `gutterColumn`; the gutter cell is also what carries the colour rail
  (`.dsg-cell-gutter`, `position: sticky`), so the custom column must not disturb that CSS hook.

## What We're NOT Doing

- **Not** deleting the „Sekcja" column or its `SectionNameCell` — owner's call: hidden, not gone.
- **Not** persisting the collapsed set. Collapse is a reading posture for the current session; it
  resets on reload or on a version restore (which remounts the body).
- **Not** touching `sectionSubtotalsForView` or any figure math. The band reads what already exists.
- **Not** adding drag-to-reorder on the band; reordering stays the existing menu items.
- **Not** making the bands sortable/grouped-sort. Under an active sort they simply vanish.
- **Not** changing the Podsumowanie panel, the pie chart, or the export.

## Implementation Approach

A section band is _a totals row scoped to one section_. So: generalize the existing synthetic-row
wrapper from two row kinds to three, insert the bands in a pure function over `viewRows`, and let
the band's cells read the section figure out of the `subtotals` the hook already computes.

Row ids stay in the negative namespace: spacer `-2`, „Razem" `-1`, and a band is
`-1000 - sectionId` — reversible, collision-free against item ids, and `id < 0` remains the single
"is this synthetic" test that `onChange` filters on.

## Critical Implementation Details

**Cell component identity.** Everything new renders through the one module-level
`SyntheticAwareCell`; per-row/per-column data goes on `columnData`. A fresh component per column or
per render remounts the cell and drops keystrokes (see the comment at
`grid/kosztorys-totals-row.tsx:45-52`). This is the trap this change is most likely to fall into.

**Sort ⨉ collapse.** Under an active sort the bands are not rendered, so the collapsed set must be
_ignored_ rather than applied — otherwise sorting would silently hide rows with no band left to
re-expand them. Keep the set in state (so clearing the sort restores the posture), but gate its
application on `sort == null`.

---

## Phase 1: Row model

### Overview

A pure module that turns `viewRows` into the grid's row list with bands inserted, plus the item
ordinals the gutter needs. Everything else in this plan renders what this returns.

### Changes Required

#### 1. Section-header row model

**File**: `src/lib/kosztorys/section-header-rows.ts` (new)

**Intent**: Own the band's row-id namespace and the assembly of the grid's row list, so the
component layer never derives ids by hand and the rules (skip collapsed, drop under sort, no band
for a section with no visible rows) are testable without a grid.

**Contract**:

```ts
export const SECTION_HEADER_ROW_BASE = -1000
export function sectionHeaderRowId(sectionId: number): number // -1000 - sectionId
export function sectionIdFromHeaderRow(rowId: number): number
export function isSectionHeaderRow(id: number): boolean // id <= SECTION_HEADER_ROW_BASE
export function isSyntheticRow(id: number): boolean // id < 0

export function buildSectionHeaderRows(
  viewRows: KosztorysV2RowT[],
  opts: { collapsedSectionIds: ReadonlySet<number>; enabled: boolean },
): { rows: KosztorysV2RowT[]; ordinalByRowId: Map<number, number> }
```

`enabled: false` (sort active) returns `viewRows` unchanged with ordinals 1…N. A band row is a
minimal cast object carrying `id`, `sectionId`, `sectionName`, `sectionColor` — the fields
`rowClassName` and the band cells read — built like `makeTotalsRow()`. Ordinals count **item rows
only**, continuously across bands.

#### 2. Unit spec

**File**: `src/__tests__/lib/kosztorys/section-header-rows.test.ts` (new)

**Intent**: Pin the assembly rules that the UI can't cheaply prove: band per section boundary,
collapsed section contributes its band and no items, a section whose rows were all filtered away
contributes no band, `enabled: false` is a pass-through, and ordinals stay continuous across bands
and skip the bands themselves.

**Contract**: Vitest, mirrors the source path per AGENTS.md. Fixtures are plain row literals — no DB.

### Success Criteria

#### Automated Verification

- Unit spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/section-header-rows.test.ts`
- Type checking passes: `pnpm typecheck`

#### Manual Verification

- None — no user-visible change yet.

---

## Phase 2: Rendering the band

### Overview

Extend the synthetic-row wrapper to a third row kind and paint the band.

### Changes Required

#### 1. Generalize the synthetic-row wrapper

**File**: `src/components/kosztorys/editor/grid/kosztorys-totals-row.tsx` → rename to
`kosztorys-synthetic-rows.tsx`

**Intent**: The module now owns three synthetic row kinds, so its name and its wrapper should say
so. One module-level cell component, three branches (spacer / „Razem" / band), everything else
delegates to the wrapped column's own cell.

**Contract**: `withTotalsRow(column, totals)` becomes
`withSyntheticRows(column, { totals, sectionHeader })`, where `sectionHeader` carries what a band
cell needs: the per-section figures (`Map<number, { net: number; gross: number; itemCount: number }>`),
the money axis, and the (editor-only) section callbacks. It rides on `columnData`, never in a
closure. Update the import in `kosztorys-editor-body.tsx`.

#### 2. Band cell

**File**: `src/components/kosztorys/editor/grid/cells/section-header-cell.tsx` (new)

**Intent**: Render the band's piece for the column it sits in — the label block under `description`,
the figure under `net` / `gross`, blank everywhere else — so the band aligns with the data without
any column spanning.

**Contract**: Content by column id: `description` → chevron + colour dot + name + `N poz.`; `net` →
`formatNet(section.net)`; `gross` → the grossed figure (only when the money axis shows brutto);
`actions` → the section menu (Phase 4); anything else → an empty tinted cell. Reuses `formatNet`
(`lib/kosztorys/format.ts`) — no new formatting.

#### 3. Band styling

**File**: `src/styles/globals.css`

**Intent**: Give the band the section's hue as a background wash so the block reads as one group,
and move the existing 2px section divider from the first item row onto the band above it.

**Contract**: A `.kosztorys-grid .dsg-row.kosztorys-section-header .dsg-cell` rule mixing
`--section-rail` into the background (dsg's stylesheet is unlayered — override via the same
custom-property indirection the rail already uses, not a Tailwind utility). The
`kosztorys-section-start` divider rule stays as-is; the class simply lands on the band row now.

#### 4. Wire the rows

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: Feed `buildSectionHeaderRows` into `gridRows`, derive the per-section figure map from
`subtotals`, and mark the band rows in `rowClassName`.

**Contract**: `isSyntheticRow` comes from the lib module (replacing the local `id === SPACER_ROW_ID
|| id === TOTALS_ROW_ID`). `sectionStartRowIds` now keys off the band rows. The figure map is a
`useMemo` over `subtotals` + `tree.vatRate`.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Existing unit suite passes: `pnpm test`

#### Manual Verification

- Investment 42: every section opens with a coloured band showing its name and its wartość netto.
- The sum of the bands' netto equals the „Razem" netto.
- Horizontal scroll keeps the band's figure under „Razem netto".
- Switching Klient / Z narzędziami / Bez narzędzi reprices the bands with the columns.

---

## Phase 3: Numbering and collapse

### Overview

A custom gutter column (continuous item numbers, unnumbered bands) and the collapse toggle.

### Changes Required

#### 1. Custom gutter column

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: dsg's built-in numbering counts bands; the owner reads the gutter as "which position is
this", so the bands must not consume numbers.

**Contract**: A `gutterColumn` whose component renders `ordinalByRowId.get(rowData.id) ?? ''`,
passed through `buildV2Grid` opts. It must keep the `.dsg-cell-gutter` element intact — that is the
sticky element the colour rail paints (globals.css).

#### 2. Collapse state

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Own `collapsedSectionIds` next to the other reading-posture state (search, sort, section
filter), so the body stays composition-only.

**Contract**: `const [collapsedSectionIds, setCollapsedSectionIds] = useState<Set<number>>(new Set())`
plus `toggleSectionCollapsed(sectionId)`, both returned. Not persisted. Applied only when
`sort == null` — the body passes `enabled: sort == null` to `buildSectionHeaderRows`, and the same
condition gates the collapsed set.

#### 3. Chevron

**File**: `src/components/kosztorys/editor/grid/cells/section-header-cell.tsx`

**Intent**: The affordance for the collapse, on the band's left edge where the eye starts.

**Contract**: A `ChevronRight`/`ChevronDown` button (lucide, as elsewhere in the grid menus) calling
`onToggleCollapsed(sectionId)`; the whole label block is the click target.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit spec still passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/section-header-rows.test.ts`

#### Manual Verification

- Collapsing a section hides its rows, keeps its band and its netto, and leaves „Razem" unchanged.
- Item numbers run 1…N with no gaps and no number on a band, collapsed or not.
- Sorting a column removes the bands; clearing the sort restores them _and_ the collapsed sections.
- Investment 7 (~1000 rows): scrolling stays smooth, collapse is instant.

---

## Phase 4: Section actions on the band

### Overview

Move the „Sekcje" group out of the per-row menu onto the band, add inline rename, hide the „Sekcja"
column by default.

### Changes Required

#### 1. Extract the section menu

**File**: `src/components/kosztorys/editor/grid/menus/kosztorys-section-actions-menu.tsx` (new)

**Intent**: The section actions get their own menu on the band, so there is exactly one place to
look for them.

**Contract**: Takes the existing `SectionActionsT` bundle (colour, name, itemCount, insert
above/below, move up/down, set colour, remove) and owns the delete-confirm dialog moved out of
`KosztorysRowActionsMenu`. Insert/move need no sort guard — under a sort there is no band.

#### 2. Slim the row menu

**File**: `src/components/kosztorys/editor/grid/menus/kosztorys-row-actions-menu.tsx`,
`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: Two routes to the same action is the thing this change is removing; the row menu keeps
„Prace" only.

**Contract**: Drop the `section` prop, the „Sekcje" group and the section confirm dialog from
`KosztorysRowActionsMenu`; `RowActionsCell` stops assembling the section bundle. The four section
callbacks move to the band cell, still behind the one `editorOnly()` gate.

#### 3. Inline rename on the band

**File**: `src/components/kosztorys/editor/grid/cells/section-header-cell.tsx`

**Intent**: Rename where the name is shown.

**Contract**: Reuse `useInlineRename` (`editor/hooks/use-inline-rename.ts`) exactly as
`SectionNameCell` does, committing through `onRenameSection(sectionId, name)` — the same fan-out
that patches every row's denormalized copy. Absent in `clientView`.

#### 4. Hide the „Sekcja" column by default

**File**: `src/lib/kosztorys/column-config.ts`

**Intent**: The column is redundant beside the bands but stays available.

**Contract**: Add `'sectionName'` to `DEFAULT_HIDDEN_COLUMNS`. The map is sparse, so anyone who
explicitly toggled it keeps their choice.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit suite passes: `pnpm test`

#### Manual Verification

- The band's „…" menu inserts, moves, recolours and deletes the section; the per-row „…" shows only
  „Prace".
- Renaming on the band updates the band, the („Sekcja") column when shown, and the Podsumowanie.
- Deleting a section from the band still asks for confirmation and reports the item count.
- „Kolumny" lists „Sekcja" unticked; ticking it brings the old column back.

---

## Phase 5: Client view and E2E

### Overview

The offer view gets the same bands, then the browser-level guard.

### Changes Required

#### 1. Client-view band

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`,
`src/components/kosztorys/editor/grid/cells/section-header-cell.tsx`

**Intent**: The offer is read sectionwise with a total per section — this is the layout the owner
composes by hand in the sheet before sending.

**Contract**: The bands render under `clientView` too; the editor-only bits (rename, menu) are
already dropped by `editorOnly()`, so the band degrades to dot + name + count + figure. Collapse
stays available.

#### 2. E2E spec

**File**: `e2e/kosztorys-section-headers.spec.ts` (new)

**Intent**: The band's value, the collapse and the numbering cross the grid, the hook and the
subtotals — the layer where a unit test can't see the regression.

**Contract**: Playwright against the 5435 `db-test` fixture (`pnpm test:e2e`): a band exists per
section with a non-empty netto; collapsing hides that section's items and keeps „Razem"; item
numbering has no gap after a collapse.

### Success Criteria

#### Automated Verification

- E2E passes: `pnpm test:e2e e2e/kosztorys-section-headers.spec.ts`
- Type checking passes: `pnpm typecheck`
- Full unit suite passes: `pnpm test`

#### Manual Verification

- The share/preview link renders the bands read-only, with no rename and no „…" menu.
- The client view's netto/brutto toggle moves the band's figure with the columns.
- Print/screenshot of the offer view reads as sections with a total each.

---

## Testing Strategy

### Unit Tests

- `buildSectionHeaderRows`: band per boundary, collapsed section, filtered-empty section, sort
  pass-through, ordinal continuity, id round-trip (`sectionIdFromHeaderRow(sectionHeaderRowId(x)) === x`).

### Integration Tests

- None owed: no new server action, no SQL, no schema change.

### Manual Testing Steps

1. Investment 42 — bands present, Σ band netto = „Razem" netto.
2. Collapse two sections, scroll, expand — no row loss, numbering continuous.
3. Sort „Razem netto" — bands vanish; clear the sort — bands and collapsed state return.
4. Search a phrase matching one section — only that section's band shows; its figure is still the
   whole section's.
5. Rename / recolour / delete a section from the band.
6. Investment 7 (~1000 rows) — scroll and collapse stay smooth.
7. Share link — read-only bands.

## Performance Considerations

`buildSectionHeaderRows` is one O(n) pass over `viewRows`, memoized alongside the existing
`viewRows` memo — negligible next to the per-row pricing the grid already does. Collapsing _reduces_
the rendered row count. The per-section figure map is O(sections).

## Migration Notes

None. No schema, no stored data, no server action. The only persisted surface touched is the
localStorage column map, and it is deliberately left sparse so an explicit choice survives.

## References

- Change record: `context/changes/2026-07-26-kosztorys-section-header-rows/change.md`
- Synthetic-row pattern: `src/components/kosztorys/editor/grid/kosztorys-totals-row.tsx`
- Per-section figures: `src/lib/kosztorys/settlement.ts` (`sectionSubtotalsForView`)
- Colour rail precursor: `src/lib/kosztorys/section-colors.ts`, `src/styles/globals.css`
- Linear: EX-580

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Row model

#### Automated

- [x] 1.1 Unit spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/section-header-rows.test.ts` — f9c825f1
- [x] 1.2 Type checking passes: `pnpm typecheck` — f9c825f1

### Phase 2: Rendering the band

#### Automated

- [x] 2.1 Type checking passes: `pnpm typecheck` — a5282ff2
- [x] 2.2 Linting passes: `pnpm lint` — a5282ff2
- [x] 2.3 Existing unit suite passes: `pnpm test` — a5282ff2

### Phase 3: Numbering and collapse

#### Automated

- [x] 3.1 Type checking passes: `pnpm typecheck` — ebe497b6
- [x] 3.2 Linting passes: `pnpm lint` — ebe497b6
- [x] 3.3 Unit spec still passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/section-header-rows.test.ts` — ebe497b6

### Phase 4: Section actions on the band

#### Automated

- [x] 4.1 Type checking passes: `pnpm typecheck` — 7af257b2
- [x] 4.2 Linting passes: `pnpm lint` — 7af257b2
- [x] 4.3 Unit suite passes: `pnpm test` — 7af257b2

### Phase 5: Client view and E2E

#### Automated

- [ ] 5.1 E2E passes: `pnpm test:e2e e2e/kosztorys-section-headers.spec.ts`
- [x] 5.2 Type checking passes: `pnpm typecheck` — c1829a2a
- [x] 5.3 Full unit suite passes: `pnpm test` — c1829a2a

> 5.1 stays open. The spec and its `seed:kosztorys-bands` fixture are authored, but `pnpm test:e2e`
> cannot run inside a git worktree: the bootstrap symlinks `node_modules` to the main tree and
> Turbopack's production build aborts with "Symlink node_modules is invalid, it points out of the
> filesystem root". Run it from the main working tree once this branch merges — tracked as **EX-582**
> (`e2e-backlog`).

## Drift from the plan

Recorded at the review gate; the shipped shape is the truth, this section says where it differs.

- **Rename gesture.** Desired End State said double-click-to-rename; the Phase 4 contract said reuse
  `useInlineRename` (focus-to-edit). Shipped follows the contract. The gate additionally gave
  `useInlineRename` an untouched-draft guard, so focusing a name and leaving no longer writes.
- **Collapse click target.** Plan said the whole label block toggles; shipped is the chevron only —
  in editor mode the rename input owns the rest of the block, and a click that both focuses the input
  and folds the section reads as a bug.
- **`ordinalGutterColumn` placement.** Landed in `grid/kosztorys-synthetic-rows.tsx` next to the other
  synthetic-row cells rather than behind `buildV2Grid` opts in `kosztorys-v2-columns.tsx`.
- **One band class, not two.** `kosztorys-section-header` and `kosztorys-section-start` were always
  applied together and were collapsed into the former at the gate; `globals.css` carries the merged
  rule.
- **Synthetic-id namespace.** The negative-id constants and factories moved out of the component into
  `src/lib/kosztorys/synthetic-rows.ts`, so the module that asserts `id < 0` owns every id in the set.
  `section-header-rows.ts` keeps only the grouping algorithm.
