# Let the kosztorys editor open empty — retire the forced-first-section scaffold

## Overview

An empty kosztorys currently cannot be opened: a non-dismissible dialog blocks the editor until the
user creates a first sekcja, and every new investment without a preset is auto-seeded with one. Both
were EX-463 stopgaps for a cold-start dead end that no longer exists. This change deletes the whole
scaffold and lets the editor render an empty grid with an inert hint pointing at the `Dodaj` menu.

Linear: **EX-615** (retires the EX-463 stopgap).

## Current State Analysis

EX-463 (Done 2026-07-17) justified the scaffold with _"no section means the toolbar's '＋ pozycja' is
hidden and there's no discoverable way in"_. That was true on 2026-07-13. It is false now: the
`Dodaj` menu (`toolbar/menus/kosztorys-add-menu.tsx`) renders Sekcja, Sekcja z szablonu… and both
Etap entries unconditionally, and the toolbar itself renders unconditionally in the editor body.
Only „Praca" is section-gated (`kosztorys-add-menu.tsx:47`, `disabled={addItemSectionId == null}`),
which is correct and stays.

The scaffold therefore protects against nothing, while costing three live code paths, one server
action, one client component, and a dead branch in a render-phase hook.

### Key Discoveries

- **Etapy are investment-scoped, with no section coupling anywhere in the chain.**
  `src/collections/kosztorys-stages.ts` has fields `investment` / `ordinal` / `label` / `plane` and
  no section relation; `addStageAction(investmentId, plane)` (`lib/actions/kosztorys.ts:493`) takes
  no section; `handleAddStage` (`use-kosztorys-editor.ts:792`) sets its own `stages` state and its
  `patchRows` is a harmless no-op over zero rows. `buildNewSectionRow` (`:718`) reads that same live
  `stages` state, so a sekcja added _after_ an etap carries the `stage_<id>` keys. **Etap-first and
  sekcja-first both work; no default-sekcja fallback is needed.**
- **The zero-sekcja state is already reachable in production** — `removeSectionAction` has no
  last-section guard. Probed against it, the server pipeline returns `doneNet` / `sumaPracNet` /
  `rabatClientNet` / `globalRabatNet` all `0`, all finite, nothing throws. So no server work is owed.
- **`becamePopulated` (`use-restore-remount.ts:38`) exists solely for the whole-tree preset seed**,
  which doesn't bump `investment.updatedAt` and so has no `revision` signal. It only fires when
  `restorePending` is armed, and only `handleRestored` arms it. With `SeedFromPresetButton` gone it
  has no live path.
- **„Wypełnij z szablonu" is redundant, not lost.** `seedInvestmentFromPreset` returns `'not-empty'`
  on a populated kosztorys (`lib/kosztorys/seed-from-preset.ts:9`), so `SeedFromPresetButton` was
  inherently empty-only. „Sekcja z szablonu…" (`AddSectionsFromPresetDialog`) yields the same outcome
  on an empty kosztorys and is already ungated in the `Dodaj` menu.
- **Both first-sekcja routes already work from zero rows without a remount.**
  `handleAddSection` (`:756`) and `handleAppendedSections` (`:770`) append optimistically to `rows`.
- **`gridRows` is never empty** — `kosztorys-editor-body.tsx:129` always appends a spacer + „Razem"
  row. Emptiness must not be judged on it.
- **`subtotals` is the search-immune emptiness signal.** It comes off the full dataset, so a search
  filter narrows visible rows without changing it (`kosztorys-editor-body.tsx:98` comment), and
  `KosztorysAddMenu` already reads it for exactly this purpose. `bodyRows`/`viewRows` are _not_
  usable — a search with no hits empties them.
- `EmptyState` (`src/components/ui/empty-state.tsx`) already exists — `title` + optional
  `description` + children.

## Desired End State

Opening an investment whose kosztorys has no sekcje shows the normal editor — toolbar, empty grid,
totals panel — with an inert centred hint over the grid body reading „Kosztorys jest pusty" /
„Dodaj sekcję lub etap z menu „Dodaj" powyżej." Adding a sekcja or an etap from that menu works in
either order and the hint disappears the moment the first sekcja lands, with no page reload and no
remount. Creating an investment without a preset leaves its kosztorys genuinely empty.

Verified by: the E2E/manual walkthrough in Testing Strategy, plus `pnpm typecheck` proving no dead
import survives the deletions.

## What We're NOT Doing

- **Not** deleting `createSectionWithFirstItem`. "A sekcja is never created alone" is a _rendering_
  invariant — a 0-item sekcja emits zero rows and would land invisible — entirely separate from "a
  kosztorys must start with a sekcja". Every remaining create path still needs it.
- **Not** deleting `seedInvestmentFromPreset`. `createInvestmentAction` still uses it for the
  preset-chosen-at-create path; only the _client button_ and its action wrapper go.
- **Not** adding a last-section guard to `removeSectionAction`. Deleting to empty is now a supported
  state, which is the point.
- **Not** adding action buttons to the empty state (decided: inert text — see Key Decisions).
- **Not** touching `context/archive/2026-07-11-kosztorys-editor-ux/`. An archive records what was
  true then; it is not amended.

## Implementation Approach

Three phases, ordered so nothing is ever half-wired: add the replacement affordance first, then
delete the client scaffold that it replaces, then delete the now-unreachable server surface. Each
phase leaves the app in a working state.

## Critical Implementation Details

**Emptiness signal.** Gate the empty state on `subtotals.length === 0`, never on `gridRows`
(always ≥ 2 synthetic rows) and never on `viewRows`/`bodyRows` (a no-hit search empties them, which
would show „Kosztorys jest pusty" over a populated kosztorys). `subtotals` is already destructured in
`kosztorys-editor-body.tsx` and is full-dataset by construction.

**Live state, not the tree prop.** The signal must come from editor state, not `tree.sections` — the
first sekcja arrives through the optimistic path with no new `tree` prop, so a `tree`-derived gate
would leave the hint stuck over a grid that now has a row.

**Client view register.** The share layout (`clientView`) renders no toolbar and no `Dodaj` menu, so
it must not be told to use one. It gets the title only, no description.

---

## Phase 1: Empty-grid hint

### Overview

Give the empty editor an affordance before removing the one that forces a sekcja, so the app is never
in a state where an empty kosztorys has no guidance.

### Changes Required

#### 1. Empty-state overlay

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: When the kosztorys holds no sekcje, overlay a centred inert hint on the grid body
pointing at the `Dodaj` menu, so an empty editor reads as empty-and-actionable rather than broken.
The grid still renders beneath it (header row + synthetic rows), so the overlay must not replace it.

**Contract**: Reuse `EmptyState` from `@/components/ui/empty-state`. Render it inside the existing
`relative` grid wrapper (`:175`) as an absolutely-positioned, pointer-events-none sibling of the
grid, gated on `subtotals.length === 0`. Copy: title „Kosztorys jest pusty"; description
„Dodaj sekcję lub etap z menu „Dodaj" powyżej." — **omit the description when `clientView`**, which
has no such menu. It must sit above the grid but below `KosztorysTotalsPanel` in stacking order.

### Success Criteria

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- An investment with zero sekcje opens the editor showing the hint over an empty grid — not a dialog.
- Typing a search term that matches nothing on a _populated_ kosztorys does NOT show the hint.
- The share/client view of an empty kosztorys shows the title without the „Dodaj" sentence.

---

## Phase 2: Delete the client scaffold

### Overview

Remove the forced dialog and the affordances that only existed inside it.

### Changes Required

#### 1. The dialog and its render

**File**: `src/components/kosztorys/editor/dialogs/empty-kosztorys-dialog.tsx` — delete.

**File**: `src/components/kosztorys/editor/kosztorys-editor-v2.tsx`

**Intent**: Drop the `tree.sections.length === 0` gate and the dialog it rendered; the editor now
always renders the body.

**Contract**: Remove the import (`:5`) and the conditional render (`:63-65`). `handleRestored` stays
— the versions drawer still calls it.

#### 2. The empty-only preset button

**File**: `src/components/kosztorys/editor/dialogs/seed-from-preset-button.tsx` — delete.

**Intent**: Its only mount point was the dialog, and its action refuses a populated kosztorys, so it
has no reachable home. „Sekcja z szablonu…" in the `Dodaj` menu covers the same outcome.

#### 3. The dead remount clause

**File**: `src/components/kosztorys/editor/hooks/use-restore-remount.ts`

**Intent**: `becamePopulated` existed only because the whole-tree preset seed left `revision`
unchanged. With that path gone the hook's sole trigger is `revisionChanged`, which a restore always
bumps. Removing it deletes a render-phase ref-compare and two eslint suppressions.

**Contract**: Drop `prevEmpty`, `becamePopulated`, and the comment block explaining them; the latch
condition becomes `restorePending && revisionChanged`. The hook keeps its `tree` parameter and its
`RestoreRemountT` return shape unchanged, so `kosztorys-editor-v2.tsx` needs no edit.

### Success Criteria

#### Automated Verification:

- Type checking passes (proves no dangling import): `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit tests pass: `pnpm test`

#### Manual Verification:

- Restoring a snapshot from the „Wersje" drawer still reseeds the grid (the remount still fires).
- „Sekcja z szablonu…" still populates an empty kosztorys from the `Dodaj` menu.

---

## Phase 3: Delete the server scaffold

### Overview

Remove the two server paths whose only callers are now gone.

### Changes Required

#### 1. `seedBlankSectionAction`

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: Delete the action (`:292-321`) and its idempotency guard. Its only caller was the deleted
dialog, and its guard existed only to absorb that dialog's double-submit.

**Contract**: Remove the export and its comment block. `createSectionWithFirstItem` and
`withPayloadTransaction` remain imported — other actions in the file use both.

#### 2. `seedFromPresetAction`

**File**: `src/lib/actions/kosztorys-presets.ts`

**Intent**: Delete the action (`:72`). Its only caller was the deleted button.

**Contract**: Remove the export. `seedInvestmentFromPreset` (`lib/kosztorys/seed-from-preset.ts`)
stays — `createInvestmentAction` still calls it. `listPresetsAction` stays; it has other callers.

#### 3. The new-investment auto-seed

**File**: `src/lib/actions/investments.ts`

**Intent**: A new investment without a preset now gets a genuinely empty kosztorys. Drop the `else`
branch (`:84-107`) and the warning constant it was the only user of.

**Contract**: Remove `SEED_BLANK_WARNING` (`:21-22`) and the `else` branch, collapsing
`if (chosenPresetId) { … } else { … }` to the `if` alone. Drop the now-unused imports
`createSectionWithFirstItem` and `withPayloadTransaction` (verify with `pnpm typecheck` — do not
grep-guess). The preset branch, its `warning`, and the `['investments']` revalidation are untouched.

#### 4. Orphaned test coverage and comments

**File**: `src/__tests__/lib/actions/kosztorys-create-order.test.ts`

**Intent**: The `seedBlankSectionAction idempotency (CR2)` describe block (`:158-190`) tests a
deleted action.

**Contract**: Delete that describe block, the `seedBlankSectionAction` entry in the destructured
import (`:27`), and the CR2 rationale line in the file header comment (`:11`). The other blocks in
the file stay.

**File**: `src/__tests__/lib/kosztorys/display-order.test.ts`

**Intent**: The comment at `:195` explains a rendering fact by reference to `EmptyKosztorysDialog`.

**Contract**: Rewrite the comment to state the rendering invariant on its own terms (a 0-item sekcja
emits zero rows) without naming the deleted component. The assertions do not change.

### Success Criteria

#### Automated Verification:

- Type checking passes (proves no orphaned import or caller): `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit tests pass: `pnpm test`
- DB-backed integration specs pass: `pnpm test:integration`

#### Manual Verification:

- Creating an investment **without** a preset succeeds and opens an empty kosztorys showing the hint.
- Creating an investment **with** a preset still seeds the full rozpiska and shows no warning toast.

---

## Testing Strategy

No new automated tests are owed. This change deletes behavior rather than adding it, and the state it
newly exposes (zero sekcje) was already reachable via `removeSectionAction` and already probed clean
across the financial pipeline. The one new surface — the hint — is a presentational branch whose
regression risk is cosmetic, and `pnpm typecheck` is the real guard for the deletions.

The deleted CR2 spec is not replaced: it asserted an idempotency guard that only existed to absorb the
deleted dialog's double-submit.

**E2E disposition:** browser-level, but deferred rather than authored. This is a subtractive change
whose risk is a dangling reference, which typecheck catches deterministically. File to the E2E
backlog (Linear, label `e2e-backlog`, project "Wykonczymy") covering: open an investment with zero
sekcje → hint visible, no dialog → add an etap → add a sekcja → the etap column is present on the new
row and the hint is gone.

### Manual Testing Steps

1. Delete every sekcja from a test investment's kosztorys → the hint appears, no dialog.
2. From `Dodaj`, add „Etap — z narzędziami" **first**, then „Sekcja" → the new row carries the etap
   column with a `0`, and the hint clears without a reload.
3. Reload → the etap and the sekcja both persisted.
4. Reverse the order on another empty investment (Sekcja first, then Etap) → same result.
5. Confirm „Praca" stays disabled while zero sekcje exist and enables once one is added.
6. Create a new investment with no preset → empty kosztorys, hint, no warning toast.
7. Create a new investment with a preset → full rozpiska, no warning toast.
8. Open the share/client view of an empty kosztorys → title only, no „Dodaj" sentence.

## Migration Notes

None. No schema change and no data path. Per AGENTS.md, kosztorys data is throwaway until dogfooding
merges to `main`, so the investments already carrying an auto-seeded „Sekcja 1" need no cleanup —
they are simply a kosztorys with one sekcja, which remains a valid state.

## References

- Change record: `context/changes/2026-07-28-drop-empty-kosztorys-scaffold/change.md`
- Retired stopgap's design home: `context/archive/2026-07-11-kosztorys-editor-ux/dialog-stopgap-design.md`
- Linear: EX-615 (this change), EX-463 (the stopgap it retires)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Empty-grid hint

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck` — 0ccea6c2
- [x] 1.2 Linting passes: `pnpm lint` — 0ccea6c2

### Phase 2: Delete the client scaffold

#### Automated

- [x] 2.1 Type checking passes (proves no dangling import): `pnpm typecheck` — a74f93a2
- [x] 2.2 Linting passes: `pnpm lint` — a74f93a2
- [x] 2.3 Unit tests pass: `pnpm test` — a74f93a2

### Phase 3: Delete the server scaffold

#### Automated

- [x] 3.1 Type checking passes (proves no orphaned import or caller): `pnpm typecheck` — 4e4ac624
- [x] 3.2 Linting passes: `pnpm lint` — 4e4ac624
- [x] 3.3 Unit tests pass: `pnpm test` — 4e4ac624
- [x] 3.4 DB-backed integration specs pass: `pnpm test:integration` — 4e4ac624
