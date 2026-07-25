# Subcontractor Views Become Settlement-Only — Implementation Plan

## Overview

A subcontractor view (Z narzędziami / Bez narzędzi) stops being „the same rozpiska at a different
price" and becomes that crew's bill. The quantity itself — the sheet's „Pomiar z natury" — becomes
plane-scoped, which corrects every figure derived from it in one cut. The other plane's etap columns
and every przedmiar-anchored column disappear from those views. An etap with no chosen tryb belongs to
neither crew.

## Current State Analysis

EX-565 (`context/changes/etap-tool-plane/`) introduced `plane` on a stage and gated the per-etap
**wartość** axis (the sheet's U–AE) behind `stageAppliesToView`. The gate stops one level below where
the money is formed:

- `rowTotalQtyDone` (`src/lib/kosztorys/settlement.ts:163`) sums **every** stage's qty column. By
  EX-494 that sum IS „Pomiar z natury", so it is the quantity primitive the whole editor stands on.
- `rowValueForView` → `sectionSubtotalsForView` → `totalNet` → the „Razem" row, the section drawer,
  „Pozostało", „% wykonania" and the row-overshoot highlight all read that plane-blind quantity and
  price it at the **active view's** rate. On a mixed investment every one of them reprices the other
  crew's work.
- The grid therefore contradicts „Podsumowanie podwykonawców" on the same screen, which already
  values each etap at its own plane's price via `subcontractorDueByPlane` (`settlement.ts:128`).
- `DEFAULT_STAGE_PLANE = 'w_tools'` (`settlement.ts:19`) silently credits an unassigned etap to the
  with-tools crew, in the grid and in the settlement panel alike.
- The other plane's **value** columns currently render a „nie dotyczy" placeholder
  (`STAGE_NA_LABEL`, `naStageValueColumn`, `naColumnIds`, `naStageColumnIds`) while their **qty**
  columns still render live numbers — so the view says „not applicable" and „here is the number" about
  the same etap.

Non-obvious findings that shrink the scope:

- **Rabat pozycyjny is already plane-clean.** `netForQtyForView` (`src/lib/kosztorys/calc.ts:76`)
  applies the discount only when `view === 'client'`. Subcontractor figures are pre-rabat by
  construction — no work needed.
- **The global-discount leak is latent, not visible.** `laborCostsNetFromKosztorys = totalNet −
discountAmount` (`use-kosztorys-editor.ts:387`) reads the view-aware total, but the client
  Podsumowanie that renders it is swapped out for `SubcontractorSummary` whenever the plane is not
  client (`kosztorys-totals-panel.tsx:214`). Nobody can see it today — but this change makes
  `totalNet` collapse to one crew's share, sharpening the trap for whoever renders it next.
- **The progress counter is already client-only** — it lives in the „etapy" tab of the client
  Podsumowanie, unreachable from a subcontractor view. No change needed.
- **The section drawer shows only `net`** (`kosztorys-sections-drawer.tsx:84`), a view-aware subtotal.
  It corrects itself once Phase 1 lands; no przedmiar denominator to hide.
- **„Podsumowanie podwykonawców" is not redundant.** Only its top three rows restate what the grid
  will say; „Zaliczki (wypłaty) razem", „Pozostało do wypłaty" and the per-worker breakdown are
  unique to it and stay.

## Desired End State

In Z narzędziami / Bez narzędzi the grid is a settlement document for exactly one crew:

- Only that plane's etapy have columns — qty and wartość alike. The other plane's etapy are absent,
  not blanked.
- „Pomiar z natury" and everything above it (row wartość, section subtotals, per-etap footers,
  „Razem") count only that plane's quantities, priced at that plane's rate.
- No przedmiar in any form: not the quantity, not its wartość, not „% wykonania", not „Pozostało".
- The „Razem Netto" column header says, in that view, that this is what the crew is owed.
- An etap with no tryb appears in neither subcontractor view and counts toward neither figure in
  „Podsumowanie podwykonawców"; the unconfirmed badge is the only thing that reports it exists.
- Rows whose whole pomiar belongs to the other crew stay visible, reading 0 — row numbering and
  layout match across views.

Klient view is untouched: every etap, the full pomiar, przedmiar, „Pozostało", rabat.

Verify by opening a kosztorys with etapy on both planes: Razem(Z narzędziami) + Razem(Bez narzędzi)
equals the whole executed work exactly, provided no etap is unassigned; each equals its own row in
„Podsumowanie podwykonawców" exactly.

### Key Discoveries

- The quantity primitive is the single point of correction: `rowTotalQtyDone` (`settlement.ts:163`).
- Przedmiar has **no plane** — it is typed once per row for the whole offered scope (sheet column N).
  Any figure comparing a plane-filtered pomiar against a whole przedmiar is meaningless in a
  subcontractor view, which is why those columns are hidden rather than filtered.
- `hasStagesOverPlanned` (`settlement.ts:226`) must be hard-anchored to the client pomiar for the same
  reason — comparing one crew's share against the whole przedmiar would flag „under-plan" on work the
  other crew finished.
- `COLUMN_LABELS` (`src/lib/kosztorys/column-config.ts:27`) is view-independent today. Making the
  „Razem Netto" label depend on the view means the label decision moves to the column builder, which
  already receives `view`.
- The whole „nie dotyczy" apparatus (`STAGE_NA_LABEL`, `naStageValueColumn`, `naColumnIds`,
  `naStageColumnIds`) becomes dead once the columns are removed — deleting it is part of the change,
  not a follow-up.

## What We're NOT Doing

- Not touching the Klient view's figures, columns, or rabat handling.
- Not hiding rows whose pomiar is 0 in the active view — owner chose to keep numbering aligned.
- Not collapsing or restructuring „Podsumowanie podwykonawców" beyond its stale hint text.
- Not adding a column-set test or a Playwright spec — owner scoped tests to the number layer.
- Not changing how a plane is picked, stored, or migrated (owned by EX-565, already shipped).
- Not reconsidering whether the przedmiar carries the rabat (EX-495, open, unrelated).

## Implementation Approach

Correct the quantity first, then let the UI follow. Phase 1 is the only phase that changes what a
number means; after it the figures are already honest and only the grid shows more than it should.
Phase 2 is presentational and deletes the „nie dotyczy" apparatus wholesale. Phase 3 is independent
of both — it closes the latent global-discount trap and a stale hint string.

### Critical Implementation Details

**Ordering inside Phase 1.** `rowTotalQtyDone` gains a required `view` parameter, so every call site
must be threaded in the same commit or the build breaks — `settlement.ts` itself
(`rowValueForView`, `stageTotalsForView`, `hasStagesOverPlanned`) plus four call sites in
`src/lib/kosztorys/sort-value.ts`. Deliberately required, not optional-with-default: a default would
silently reintroduce the plane-blind reading at any site the implementer forgets.

**`hasStagesOverPlanned` takes no `view`.** It passes `'client'` internally on purpose. Handing it the
active view would make the red overshoot highlight appear and disappear as the user switches views.

---

## Phase 1: Plane-scoped quantity

### Overview

The sheet's „Pomiar z natury" becomes view-dependent, and an unassigned etap stops being credited to
the with-tools crew. Every derived figure corrects itself.

### Changes Required

#### 1. The settlement layer

**File**: `src/lib/kosztorys/settlement.ts`

**Intent**: Make the quantity primitive plane-aware and stop defaulting an undecided plane. Everything
else in this file is derived and needs only to pass the view down.

**Contract**:

- Delete `DEFAULT_STAGE_PLANE`.
- `stageAppliesToView(stage, view)` — client accepts every etap; a subcontractor view accepts only
  `stage.plane === view`. A `null` plane matches neither. Document that undecided is not a plane and
  that the cost is the two bills no longer summing to the executed work while any etap is unassigned.
- `rowTotalQtyDone(row, stages, view)` — new required third parameter; sums only stages passing
  `stageAppliesToView`.
- `rowValueForView` / `stageTotalsForView` / `sectionSubtotalsForView` — thread `view` through to
  `rowTotalQtyDone`; no other change.
- `hasStagesOverPlanned(row, stages)` — signature unchanged, passes `'client'` internally.
- `subcontractorDueByPlane` — skip a stage whose `plane` is `null`; `hasUnconfirmedPlane` unchanged.

#### 2. Sort comparators

**File**: `src/lib/kosztorys/sort-value.ts`

**Intent**: Sorting by a pomiar-derived column must order by what the view actually shows.

**Contract**: four `rowTotalQtyDone` call sites take the comparator's existing `view`.

#### 3. Type documentation

**File**: `src/lib/kosztorys/types.ts`

**Intent**: The `null` in `StagePlaneT` now carries a rule, not just an absence.

**Contract**: comment on the plane field states that `null` means undecided and that an undecided etap
belongs to no subcontractor bill.

#### 4. Unit tests

**Files**: `src/__tests__/lib/kosztorys/subcontractor-due-by-plane.test.ts`,
`src/__tests__/lib/kosztorys/kosztorys-v2-rows.test.ts`

**Intent**: Guard the two rules this phase establishes — the quantity is plane-scoped, and undecided
belongs to nobody. Existing fixtures assume the old default and must be given explicit planes rather
than patched to keep passing.

**Contract**: new/updated cases covering

- mixed-plane investment: `rowTotalQtyDone` at each subcontractor view returns only that plane's qty;
  at `'client'` returns the full sum (the sheet's O);
- the identity `Razem(w_tools) + Razem(own_tools) === executed work pre-rabat`, holding when every
  etap has a plane and failing to hold (with the flag raised) when one does not;
- `subcontractorDueByPlane` with all-null planes returns 0/0/0 and `hasUnconfirmedPlane: true`;
- `hasStagesOverPlanned` is unaffected by the active view.

### Success Criteria

#### Automated Verification:

- Unit tests pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/`
- Full suite passes: `pnpm test`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- On a kosztorys with etapy on both planes, „Razem netto" in Z narzędziami plus „Razem netto" in Bez
  narzędzi equals „Suma wykonanej pracy" in „Podsumowanie podwykonawców".
- Each view's „Razem netto" equals that plane's row in „Podsumowanie podwykonawców" exactly.
- Klient view's figures are unchanged from before the change.
- Setting an etap's tryb back to unpicked drops its work out of both crews' totals and raises the
  unconfirmed badge.

**Implementation Note**: After completing this phase and all automated verification passes, pause for
manual confirmation before proceeding.

---

## Phase 2: The subcontractor grid shows only that crew's bill

### Overview

Remove the other plane's etap columns and every przedmiar-anchored column from subcontractor views,
and delete the „nie dotyczy" apparatus they made necessary.

### Changes Required

#### 1. Column construction

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: A crew's bill does not list the other crew's etapy at all, and does not mention the
przedmiar, which has no plane. Blanking was rejected — a wall of dead cells across every row, with the
qty columns still reading as if they counted. Nothing becomes uneditable: quantities are entered in
the Klient view, which shows every etap.

**Contract**:

- One filtered stage list drives all four etap column blocks (qty, wartość netto, wartość brutto,
  wartość %): stages passing `stageAppliesToView(stage, view)`.
- Delete `naStageValueColumn` and the `STAGE_NA_LABEL` import.
- `plannedQty`, `plannedNet`/`plannedGross`, `donePercent`, `remaining`/`remainingGross` become
  client-only, following the existing `discountCols` pattern (`view === 'client' ? [...] : []`).
- The „Razem Netto" column title is view-dependent: in a subcontractor view it states that the figure
  is what that crew is owed. `COLUMN_LABELS.net` stays the client wording; the override lives here,
  where `view` is already in scope.

#### 2. Totals row

**Files**: `src/components/kosztorys/editor/grid/kosztorys-totals-row.tsx`,
`src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: With the columns gone there is nothing to mark „nie dotyczy", and the per-etap footer loop
must stop contributing out-of-view etapy to the pomiar sum.

**Contract**:

- `withTotalsRow(column, columnTotals)` — the `naColumnIds` parameter and its branch are removed.
- Delete `naStageColumnIds` in the editor body.
- The footer loop skips a stage failing `stageAppliesToView` before it writes any total or adds to
  `qtySum`.

#### 3. Stage header

**File**: `src/components/kosztorys/editor/grid/stage-header.tsx`

**Intent**: A wrench glyph on an etap with no tryb claims a crew nobody picked.

**Contract**: drop `effectivePlane` and the `DEFAULT_STAGE_PLANE` import; render the plane icon only
when `stage.plane != null`. The red label and unconfirmed badge are unchanged.

#### 4. Dead constant

**File**: `src/lib/kosztorys/stage-keys.ts`

**Intent**: `STAGE_NA_LABEL` has no remaining reader.

**Contract**: delete the export; confirm via `pnpm typecheck` that no import survives.

### Success Criteria

#### Automated Verification:

- Full suite passes: `pnpm test`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- The string „nie dotyczy" no longer appears in `src/`: `grep -r "nie dotyczy" src/`

#### Manual Verification:

- In Z narzędziami only with-tools etapy have columns; bez-narzędzi etapy are absent, not blank.
- No przedmiar column, no „Wartość przedmiaru", no „% wykonania", no „Pozostało" in either
  subcontractor view.
- A row whose whole pomiar belongs to the other crew stays visible and reads 0, keeping row numbering
  aligned with the Klient view.
- The „Razem Netto" header reads as the crew's amount in a subcontractor view and unchanged in Klient.
- An etap with no tryb shows no wrench, only the red label and the badge.

**Implementation Note**: After completing this phase and all automated verification passes, pause for
manual confirmation before proceeding.

---

## Phase 3: Close the global-discount trap and the stale hint

### Overview

Two small independent corrections in the summary layer.

### Changes Required

#### 1. Anchor the labour figure to the client plane

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: A global discount is a concession to the client and must never be computed against a
crew's amount. Today the leak is invisible because the client Podsumowanie is swapped out in
subcontractor views; after Phase 1 the underlying total collapses to one crew's share, so the next
person to render this figure outside Klient would ship a wrong number silently.

**Contract**: `discountAmount` and `laborCostsNetFromKosztorys` derive from the **client-view** total,
not the active-view `totalNet`. Comment states why, so the anchor is not "simplified" away later.

#### 2. Stale unconfirmed-plane hint

**File**: `src/components/kosztorys/summary/blocks/subcontractor-summary.tsx`

**Intent**: `UNCONFIRMED_PLANE_HINT` says unconfirmed etapy are counted as „z narzędziami". Phase 1
makes that false — they are counted for nobody, which is a different warning: the sum is short.

**Contract**: the hint states that etapy without a chosen rozliczenie are in neither amount, so the
sum is lower than the work actually executed until they are assigned. The comment above the constant
is updated with it.

### Success Criteria

#### Automated Verification:

- Full suite passes: `pnpm test`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- The client Podsumowanie's robocizna figure is identical whether the panel was opened from Klient
  directly or after switching views.
- With an unassigned etap present, the badge's tooltip in „Podsumowanie podwykonawców" describes a
  missing amount, not a with-tools default.

---

## Testing Strategy

### Unit Tests

Scoped by the owner to the number layer — a wrong figure here is silent and monetary, and unit tests
catch it directly and fast. Column-set and browser coverage were considered and declined.

- `rowTotalQtyDone` per view on a mixed-plane fixture, including the client case returning the sheet's
  full O.
- The settlement identity: `Razem(w_tools) + Razem(own_tools) === executed work pre-rabat` when every
  etap has a plane.
- Undecided plane: contributes to neither figure, raises `hasUnconfirmedPlane`.
- `hasStagesOverPlanned` invariant under view switching.

Existing fixtures in `kosztorys-v2-rows.test.ts` and `kosztorys-empty-sections.test.ts` assume the
old default plane and get explicit planes rather than accommodating patches.

### Manual Testing Steps

1. Open a kosztorys with etapy on both planes and quantities recorded against each.
2. In Klient, note „Razem netto" and „Suma wykonanej pracy" in the panel.
3. Switch to Z narzędziami: confirm only with-tools etap columns, no przedmiar-anchored columns, and
   that „Razem netto" matches the with-tools row in „Podsumowanie podwykonawców".
4. Repeat in Bez narzędzi; confirm the two „Razem netto" figures sum to „Suma wykonanej pracy".
5. Unset one etap's tryb: confirm it vanishes from both subcontractor views, both totals drop, and the
   badge appears with the corrected hint.
6. Confirm a row executed entirely by the other crew still appears, reading 0.

## Migration Notes

No schema change — `plane` already exists (`20260724_2_add_plane_to_kosztorys_stages`, carried on
staging). Kosztorys data is throwaway until dogfooding merges to `main`, so existing rows with a
`null` plane need no backfill: they simply read as unassigned, which is now their correct meaning.

## References

- Change notes and owner rulings: `context/changes/2026-07-25-subcontractor-view-settlement-only/change.md`
- Predecessor slice: `context/changes/etap-tool-plane/plan.md` (EX-565)
- Subcontractor panel origin: `context/archive/2026-07-21-podsumowanie-podwykonawcow/plan.md`
- Domain background: `context/reference/kosztorys-editor-domain-notes.md`
- Throwaway spike diff (reference only, will go stale): session scratchpad
  `adhoc-subcontractor-view.patch`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Plane-scoped quantity

#### Automated

- [x] 1.1 Unit tests pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/` — 69290c80
- [x] 1.2 Full suite passes: `pnpm test` — 69290c80
- [x] 1.3 Type checking passes: `pnpm typecheck` — 69290c80
- [x] 1.4 Linting passes: `pnpm lint` — 69290c80

### Phase 2: The subcontractor grid shows only that crew's bill

#### Automated

- [x] 2.1 Full suite passes: `pnpm test`
- [x] 2.2 Type checking passes: `pnpm typecheck`
- [x] 2.3 Linting passes: `pnpm lint`
- [x] 2.4 The string „nie dotyczy" no longer appears in `src/`

### Phase 3: Close the global-discount trap and the stale hint

#### Automated

- [ ] 3.1 Full suite passes: `pnpm test`
- [ ] 3.2 Type checking passes: `pnpm typecheck`
- [ ] 3.3 Linting passes: `pnpm lint`
