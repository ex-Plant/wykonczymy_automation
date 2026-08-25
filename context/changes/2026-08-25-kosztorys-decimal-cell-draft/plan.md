# One edit contract for every numeric kosztorys cell — Implementation Plan

## Overview

Every numeric cell in the kosztorys grid gets the same contract: **hold the typed text as a draft
while the caret is in the cell, settle on blur, roll a refused value back and say so out loud.**
That contract already exists — once, welded into the subcontractor price cells. This change extracts
it, and moves the two cell families that don't have it onto the same machine, fixing a data-losing
bug in each.

## Current State Analysis

Three different edit models sit in one grid today.

**`useOverrideEdit` (`grid/cells/subcontractor-columns.tsx:117`) — the good one.** Keystrokes commit
as they go, but the typed text lives in local state, so the row is never asked to accept a
half-typed string. Leaving the cell settles: accepted values stay, refused ones roll the row back to
the snapshot taken on entry and announce it with a toast. Its React-free half is already a separate
module — `lib/kosztorys/subcontractor-price-edit.ts` exports `overrideSnapshot` / `priceKeystroke`
(`hold` | `blocked` | `commit`) / `priceSettle` (`keep` | `clear` | `rollback`), unit-tested at
`src/__tests__/lib/kosztorys/subcontractor-price-edit.test.ts`. The split exists because this repo
has no `renderHook`: logic that must be tested lives outside React.

**`DiscountValueCell` (`grid/cells/discount-columns.tsx:38`) — broken.** A **controlled** input
committing every keystroke. `discountFromValue` correctly refuses `-` and `1e`, but `12,` is not
invalid: `parseDecimalInput` rewrites it to `12.` and `Number('12.')` is 12. So the cell commits 12,
the parent re-renders with `value="12"`, React resets the DOM node, the comma is swallowed, and the
next digit concatenates — **`12,5` is stored as `125`**. No decimal can be entered into „Rabat wart."
at all.

**`decimalColumn` (`ui/datasheet-grid/decimal-column.ts`) — half-fixed.** Landed 2026-08-25 to
replace react-datasheet-grid's stock `floatColumn`, whose `parseFloat('12,5')` returned 12 and whose
locale-less `new Intl.NumberFormat()` rendered the blurred cell with the very separator it refused.
Comma now parses and the display round-trips, but `parseUserInput: (value: string) => T` receives
only the string — it cannot see the value it is replacing, so it has no way to express _"reject this,
keep what was there"_. `empty` and `invalid` both collapse to `null`, and a lone `-` left standing
past the 500 ms save debounce (`use-kosztorys-editor.ts:138`) clears the cell.

That `null` is also a type lie: `plannedQty`, `clientPrice`, `discountValue` and the `stage_<id>`
keys are all `number` in `lib/kosztorys/types.ts` — the `null` only passes because `keyCol` casts
through `any` at the library boundary (`kosztorys-v2-columns.tsx:83-99`). Every field change fires
`updateItemFieldAction(id, { [field]: value })` (`use-kosztorys-editor.ts:1006`), so a settled `null`
is POSTed.

## Desired End State

One machine, three consumers. Typing `12,5` works in every numeric cell of the grid. A refused entry
never leaves a number on screen that the user did not choose without saying so. No numeric field
ever receives `null`.

Verified by: entering `12,5` in „Rabat wart." stores 12,5; typing `-` into „Przedmiar" and clicking
away leaves the previous quantity standing with a toast; Escape anywhere returns the value the cell
held on entry; the ~1000-row perf dataset still types without stutter.

### Key Discoveries:

- The pure half of the machine already exists and is already the right shape —
  `subcontractor-price-edit.ts:62-115`. This is an extraction, not a new abstraction.
- **The draft alone fixes the rabat bug.** `12,` still commits 12, but the draft keeps `12,` on
  screen, so the next keystroke sees `12,5`. `discountFromValue` needs no change to its parsing.
- `priceKeystroke` returns `hold` for an emptied field on purpose (`subcontractor-price-edit.ts:57`):
  writing `type: null` mid-typing flips the cell out of edit mode, swaps the input for read-only text
  and kills the caret. Clearing may only happen at settle. The generic machine must preserve this.
- `priceSettle` returns `row: null` when the row already stands where the rollback would put it —
  the announcement is owed, the write is not (`subcontractor-price-edit.ts:110`). That is exactly the
  "toast only when something changed" rule chosen here.
- Every column is wrapped by `withTotalsRow` (`grid/kosztorys-synthetic-rows.tsx:104`), which
  replaces `component` with `SyntheticAwareCell` and delegates to `columnData.base`, merging over the
  wrapped column's own `columnData`. A new cell must therefore carry its config on `columnData` —
  which is also what EX-422 requires.
- `disabled` → `ReadOnlyCellText` is the convention of every hand-rolled cell (`unit-column.tsx:10`,
  `section-name-cell.tsx:27`, `discount-columns.tsx:39`). `decimalColumn` has no such branch; the
  hand-rolled replacement gains it.
- `keyCol` stays — `description` and `note` still use it with `longTextColumn`.

## What We're NOT Doing

- Not touching `parseDecimalInput` (`lib/utils/parse-decimal-input.ts`) or its spec — its three-way
  result is precisely what makes this work.
- Not changing the resting display format. Cells keep showing raw comma text (`12,5`, `1234,5`) — no
  thousands separator, no padded decimals. One representation, in and out.
- Not adding a guard to the client-view „Cena j.m.". The subcontractor price guard stays exclusive to
  the subcontractor planes.
- Not writing the Playwright spec in this change — see Testing Strategy.
- Not revisiting the „Rabat wart." / global-discount override visibility rules.

## Implementation Approach

Bottom-up, because the layers are strictly dependent: pure module → hook → consumers.

The generic machine is parameterised by a **policy** — the four (optionally five) functions that are
all that differ between a plain number field, the discount pair, and a guarded subcontractor price:

| Policy member         | number field               | discount                      | subcontractor price             |
| --------------------- | -------------------------- | ----------------------------- | ------------------------------- |
| `snapshot(row)`       | `row[field]`               | `{type, value}`               | `{type, value}`                 |
| `restore(row, entry)` | `{...row, [field]: entry}` | both fields                   | both fields                     |
| `applyValue(row, n)`  | `{...row, [field]: n}`     | `discountFromValue` semantics | `withOverride(mode, n)`         |
| `clear(row)`          | `{...row, [field]: 0}`     | `{type: null, value: 0}`      | `{type: null, value: 0}`        |
| `guard(row)`          | —                          | —                             | `checkSubcontractorPrice`       |
| `restoredLabel(row)`  | `formatQty` / raw          | raw value                     | `formatNet(subcontractorPrice)` |

Phase order puts the riskiest consumer last: phase 4 touches the most densely rendered cells in the
grid, so it lands on a machine already proven by phases 2 and 3.

## Critical Implementation Details

**EX-422 — cell component identity.** dsg renders each cell as
`createElement(columns[i].component, props)`; React remounts on a changed component _type_, which
tears down the focused `<input>` and leaves only the last character typed (`lessons.md:145-151`).
Every new `component` must be defined once at module scope, with everything that varies per column
(the field key, the policy) riding on `columnData`. The columns array is rebuilt every render and
correctly so — that is not the problem; a per-call closure in `component:` is.

**Clearing may not happen mid-typing.** See the `hold` discovery above. `cellKeystroke` must return
`hold` — never `clear` — for an emptied field; only `cellSettle` clears.

**The draft is bound to a grid POSITION, not to a row.** `useOverrideEdit` stores `rowId` alongside
the draft and no-ops on settle when the row underneath has changed (a filter or a refresh landing
mid-edit would otherwise write one row's snapshot onto another) — `subcontractor-columns.tsx:150`.
The extracted hook keeps this.

**Escape must not blur itself.** The rollback has to be the last write; a synchronous blur would
settle the draft the current render still holds. Hand the cell back to the grid via `stopEditing`
and let it blur a render later (`subcontractor-columns.tsx:171-176`).

---

## Phase 1: The pure machine — `cell-edit.ts` + three policies

### Overview

Extract `priceKeystroke` / `priceSettle` into a policy-driven, domain-free pair, and express the
three cell families as policies. No React, no component changes — this phase is pure logic and its
tests.

### Changes Required:

#### 1. The generic machine

**File**: `src/lib/kosztorys/cell-edit.ts` (new)

**Intent**: Hold the keystroke/settle state machine that every numeric cell shares, so the rules
(`hold` while typing, clear only at settle, roll back and announce only when something moved) exist
once.

**Contract**: Exports `CellEditPolicyT<RowT, EntryT>` (`snapshot`, `restore`, `applyValue`, `clear`,
optional `guard`, `restoredLabel`), plus `cellKeystroke(raw, row, policy)` returning
`hold | blocked | commit` and `cellSettle(draft, row, policy, entry)` returning
`keep | clear | rollback`. `rollback` carries `reason: 'blocked' | 'invalid'`, `row: RowT | null`
(null when the row already stands where the rollback would put it — announcement owed, write not)
and `restoredLabel: string`. Parsing goes through `parseDecimalInput`; `empty` is `hold` in
`cellKeystroke` and `clear` in `cellSettle`.

#### 2. Subcontractor policy — the existing behaviour, re-expressed

**File**: `src/lib/kosztorys/subcontractor-price-edit.ts`

**Intent**: Move this module onto the generic machine without changing what it does. It keeps
exporting `priceKeystroke` / `priceSettle` / `overrideSnapshot` / `withOverride` / `modeChange` as
adapters over a `subcontractorPolicy(view, mode)`, so its existing spec keeps describing the same
behaviour and the cells' imports don't move in this phase.

**Contract**: `subcontractorPolicy(view, mode): CellEditPolicyT<RowT, OverrideSnapshotT>` —
`guard` is `checkSubcontractorPrice`, `restoredLabel` is `formatNet(subcontractorPrice(...))`.
Public signatures of the existing exports are unchanged.

#### 3. Numeric-field and discount policies

**File**: `src/lib/kosztorys/cell-edit.ts` (or a sibling if it grows past cohesion)

**Intent**: The two new policies. The numeric one is the whole answer to "what does an emptied
cell commit" — `clear` writes `0`, never `null`.

**Contract**: `numericFieldPolicy(field: keyof RowT): CellEditPolicyT<RowT, number>` and
`discountPolicy(): CellEditPolicyT<RowT, DiscountPairT>`. The discount policy's `applyValue` keeps
`discount-edit.ts`'s implied-`percent` rule; `clear` writes `{discountType: null, discountValue: 0}`,
matching `discountFromValue`'s `empty` branch today.

### Success Criteria:

#### Automated Verification:

- New spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/cell-edit.test.ts` — covers
  `hold` on empty and on garbage, `clear` on settle-empty, `rollback` with `row: null` when nothing
  moved, `blocked` from a guard, and `12,` → 12 / `12,5` → 12,5 as consecutive keystrokes.
- Existing pure specs stay green (behaviour unchanged):
  `pnpm exec vitest run src/__tests__/lib/kosztorys/subcontractor-price-edit.test.ts src/__tests__/lib/kosztorys/kosztorys-discount-edit.test.ts`

#### Manual Verification:

- None — this phase renders nothing.

---

## Phase 2: `useCellDraft` + the subcontractor cells as its first consumer

### Overview

Lift the React half out of `useOverrideEdit` into a hook that knows nothing about prices, and move
„Cena j.m." / „Mnożnik" onto it. Behaviour must be indistinguishable before and after.

### Changes Required:

#### 1. The hook

**File**: `src/components/kosztorys/editor/grid/cells/use-cell-draft.ts` (new)

**Intent**: Own the draft lifecycle for one cell: hold the typed text and the entry snapshot while
focused, commit accepted keystrokes, settle on blur, roll back with a toast, and abandon on Escape.
Colocated with the cells rather than in `editor/hooks/` because its consumers are cell components,
not the editor composition root.

**Contract**: `useCellDraft(rowData, setRowData, policy, stopEditing)` returns
`{ draft: string | null, blockReason: string | null, onChange, onBlur, onEnter, onEscape }` — the
shape `useOverrideEdit` returns today. Keeps the `rowId` guard on settle and the "Escape does not
blur itself" ordering. The rollback toast fires only on `rollback` with a non-null row or a
`blocked` reason, at `REVERT_TOAST_MS` (5000).

#### 2. Subcontractor cells

**File**: `src/components/kosztorys/editor/grid/cells/subcontractor-columns.tsx`

**Intent**: Delete `useOverrideEdit` and call `useCellDraft(…, subcontractorPolicy(view, mode), …)`
from both cells. The standing verdict (`checkSubcontractorPrice` rendered even when nobody is
typing), the tooltip's fixed tree shape and the alert glyph all stay exactly as they are.

**Contract**: `SubcontractorCoeffCell` / `SubcontractorPriceCell` keep their props and their column
factories keep their `copyValue` / `deleteValue` / `keepFocus` / `disableKeys` settings.

### Success Criteria:

#### Automated Verification:

- The pure half is untouched by construction, so its spec is the guard:
  `pnpm exec vitest run src/__tests__/lib/kosztorys/subcontractor-price-edit.test.ts src/__tests__/lib/kosztorys/subcontractor-price-guard.test.ts`
- No new phase-scoped automated check exists for the hook itself — this repo has no `renderHook`,
  and the extraction moves no logic that a unit test can reach. Its guard is the manual pass below.

#### Manual Verification:

- In „Z narzędziami": typing a mnożnik over the ceiling still refuses in-place, and leaving the cell
  restores the previous price with the „Wartość odrzucona — przywrócono …" toast.
- Typing `0,9` into „Mnożnik" no longer strands the row at 0 (the original EX incident).
- Escape mid-edit returns the value the cell held on entry, silently.
- „Źródło ceny" still switches mode without changing the displayed price.

---

## Phase 3: „Rabat wart." onto the shared machine

### Overview

Replace the controlled input with a draft. This is where `12,5` stops being stored as `125`.

### Changes Required:

#### 1. The rabat cell

**File**: `src/components/kosztorys/editor/grid/cells/discount-columns.tsx`

**Intent**: `DiscountValueCell` reads its text from the draft instead of from `rowData`, and settles
on blur through `useCellDraft(…, discountPolicy(), …)`. The `disabled` branch and
`discountValueColumn`'s `copyValue` / `deleteValue` are unchanged.

**Contract**: The cell keeps writing the `discountType` + `discountValue` pair together — that
pairing is the orphan-bug guard `discount-edit.ts` exists for, and it moves into the policy intact.
`DiscountTypeCell` is not touched.

#### 2. Discount edit module

**File**: `src/lib/kosztorys/discount-edit.ts`

**Intent**: Keep `discountFromValue` / `discountFromType` as they are — the policy calls into them.
Only add whatever the policy needs (a snapshot/restore pair over the field couple) if it isn't
already expressible.

**Contract**: Existing exports and their signatures unchanged; `kosztorys-discount-edit.test.ts`
keeps passing untouched.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/kosztorys-discount-edit.test.ts` — unchanged
  spec, still green.
- Extended `cell-edit.test.ts` covers the discount policy: an emptied field settles to
  `{type: null, value: 0}`, and a value typed with no type set implies `percent`.

#### Manual Verification:

- Typing `12,5` into „Rabat wart." stores 12,5 (today: 125). Same for `12.5`.
- Clearing „Rabat wart." and leaving removes the rabat (type back to „Bez rabatu").
- Typing garbage and leaving restores the previous rabat; the toast appears only if the row's
  value had already moved.
- The computed „Rabat kwota netto" tracks the typed value on every keystroke, as it does today.

---

## Phase 4: The grid's numeric columns onto a hand-rolled cell

### Overview

„Cena j.m." (Inwestor), „Przedmiar" and every per-etap „ilość" leave `keyColumn` + `decimalColumn`
for a cell on the shared machine. This kills the `-`-clears-the-cell hole and the `null` writes, and
is the phase that carries the performance risk.

### Changes Required:

#### 1. The numeric column factory

**File**: `src/components/ui/datasheet-grid/decimal-column.tsx` (replaces today's `.ts`)

**Intent**: A domain-free numeric dsg column built on `useCellDraft`, so the grid's plain number
cells get the same contract as the guarded ones. Replaces the `createTextColumn` wrapper, whose
`parseUserInput` signature is what made "reject and keep" unexpressible.

**Contract**: `decimalColumn(field, policy)` returns a `Column` whose `component` is a single
module-level cell reading `{ field, policy }` from `columnData` (EX-422), plus:
`copyValue` → raw comma text, `pasteValue` → whitespace-stripped `parseDecimalInput`,
`deleteValue` → `0`, `disabled` → `ReadOnlyCellText`. The comma text helper and the
whitespace-stripping parse move over from today's module rather than being rewritten.

#### 2. Column wiring

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: Point the three call sites (`:277` clientPrice, `:343` plannedQty, `:450` the stage qty
columns) at the new factory instead of `keyCol(field, decimalColumn, …)`. `keyCol` itself stays —
`description` and `note` still use it — but its comment about `decimalColumn` being nullable stops
being true and needs correcting.

**Contract**: Column `id`s, titles, `minWidth`s and the stage columns' `PLANE_UNCONFIRMED_CELL`
tinting are unchanged, so the column-order and readonly specs keep passing.

#### 3. Spec rewrite

**File**: `src/__tests__/components/ui/datasheet-grid/decimal-column.test.ts`

**Intent**: Today's spec asserts `columnData.parseUserInput` / `formatBlurredInput`, an API that
disappears with `createTextColumn`. Re-point it at what survives: the comma text/parse helpers,
`pasteValue` on `1 234,5`, and `deleteValue` returning `0`.

**Contract**: Keeps asserting the load-bearing property — what the cell displays parses back to the
same number.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/components/ui/datasheet-grid/decimal-column.test.ts`
- Column-shape specs still green:
  `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/v2-columns-order.test.ts src/__tests__/components/kosztorys/editor/grid/v2-columns-readonly.test.ts src/__tests__/components/kosztorys/editor/grid/stage-column-filter.test.ts src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts`

#### Manual Verification:

- Typing `12,5` into „Przedmiar" and into a per-etap „ilość" stores 12,5.
- Typing `-` into „Przedmiar" and clicking away leaves the previous quantity standing, with a toast.
- Clearing „Przedmiar" and leaving stores 0 — and no `null` reaches the server (no error toast, no
  revert).
- Delete on a multi-cell selection writes 0 across it.
- Copy a cell, paste into another; paste `1 234,5` copied from the owner's sheet — both land as
  numbers.
- Escape mid-edit returns the entry value.
- **Perf**: on `INV=7 node --env-file=.env --import tsx src/scripts/perf-seed-kosztorys.ts`
  (~1000 items), typing into a stage „ilość" column keeps up with the keyboard and scrolling stays
  smooth with ~10 stage columns visible.
- A disabled/preview grid renders these cells as read-only text, not as live inputs.

---

## Testing Strategy

### Unit Tests:

- `cell-edit.test.ts` is the centre of gravity: the state machine's five outcomes, per policy.
- The existing `subcontractor-price-edit` / `subcontractor-price-guard` / `kosztorys-discount-edit`
  specs are the regression guard for the extraction — they must pass **unchanged**. Editing them to
  fit the refactor would be editing away the guard.

### Integration Tests:

- None. Nothing here touches the DB layer; `updateItemFieldAction` is unchanged.

### Browser-level (E2E) — deferred, and owed:

The bug this change exists to kill — a comma swallowed by a controlled input's re-render — is
**invisible to every unit test**. The pure machine sees the whole draft string (`12,5`) and answers
correctly today; what was broken is the DOM round trip. That is a browser risk by definition.

Per AGENTS.md a browser-level slice owes its E2E: author it at the review gate, or file it into the
**E2E backlog** — a Linear issue labelled `e2e-backlog` in project „Wykonczymy". Do not close this
change without one or the other. The spec to write: type `12,5` into „Rabat wart.", blur, reload,
assert the persisted value is 12,5; then type `-` into „Przedmiar", blur, assert the previous
quantity stands.

### Manual Testing Steps:

Aggregated into `context/foundation/manual-checks.md` at the final phase by `/10x-implement`. The
perf pass on the ~1000-item dataset is the one that cannot be skipped.

## Performance Considerations

Phase 4 replaces a library cell with a hook-bearing one on the grid's most numerous columns. dsg
virtualises rows, so the live count is roughly (visible rows × visible numeric columns) — with ten
stage columns on screen that is several hundred inputs, each with a `useState`. The library's own
`TextComponent` also carries refs and two effects per cell, so this is a like-for-like swap rather
than new weight, and the two subcontractor columns have run this exact shape for months. The risk is
the _count_, which is why the perf-seed pass is a hard manual check rather than an optional one.

React Compiler is on; do not hand-write memoisation to pre-empt a regression that has not been
observed.

## Migration Notes

None — no schema, no stored data, no persisted format changes. The only behavioural delta reaching
the database is that an emptied numeric cell now writes `0` where it used to attempt `null`.

## Whole-tree Gate

Run once, after phase 4:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit suite passes: `pnpm test`
- Build succeeds: `pnpm build`

## References

- Change identity: `context/changes/2026-08-25-kosztorys-decimal-cell-draft/change.md`
- The machine being extracted: `src/lib/kosztorys/subcontractor-price-edit.ts:62-115`,
  `src/components/kosztorys/editor/grid/cells/subcontractor-columns.tsx:117-192`
- EX-422 cell-identity trap: `context/foundation/lessons.md:145-157`
- The half-fix this builds on: `src/components/ui/datasheet-grid/decimal-column.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The pure machine — `cell-edit.ts` + three policies

#### Automated

- [x] 1.1 New spec passes: `cell-edit.test.ts` — d109ddcc
- [x] 1.2 Existing pure specs stay green: `subcontractor-price-edit.test.ts`, `kosztorys-discount-edit.test.ts` — d109ddcc

### Phase 2: `useCellDraft` + the subcontractor cells as its first consumer

#### Automated

- [x] 2.1 `subcontractor-price-edit.test.ts` + `subcontractor-price-guard.test.ts` green after the extraction — fbb6a31f
- [x] 2.2 No phase-scoped automated check for the hook itself (no `renderHook` in this repo) — recorded deliberately — fbb6a31f

### Phase 3: „Rabat wart." onto the shared machine

#### Automated

- [x] 3.1 `kosztorys-discount-edit.test.ts` green — its `discountFromValue` block moved to `cell-edit.test.ts` with the now-dead function
- [x] 3.2 `cell-edit.test.ts` extended with the discount policy's clear/implied-percent cases

### Phase 4: The grid's numeric columns onto a hand-rolled cell

#### Automated

- [ ] 4.1 Rewritten `decimal-column.test.ts` passes
- [ ] 4.2 Column-shape specs green: `v2-columns-order`, `v2-columns-readonly`, `stage-column-filter`, `preview-columns`
