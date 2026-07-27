# Subcontractor Price Guard Implementation Plan

## Overview

The subcontractor price in the two tool-plane views can be set to anything — a per-row coefficient, a
flat amount, or the investment's global coefficient. Nothing stops it from swallowing the client
margin. This adds one pure rule (`error` above 80% of the client price, `warning` above the price the
investment's global coefficient would produce) and wires it into the three places a price can breach
it: the two editable cells, the standing render of the „Cena" column, and the global-coefficient
field in the toolbar settings.

## Current State Analysis

The pricing model is already fully centralized and pure:

- `src/lib/kosztorys/calc.ts:44` `subcontractorPrice(row, view)` resolves all three modes:
  `amount` → flat value, `coeff` → `clientPrice × value`, `null` (auto) → `clientPrice × globalCoeff`.
- `src/lib/kosztorys/calc.ts:39` `effectiveCoeff(row, view)` returns the investment's global
  coefficient for the plane — exactly the baseline the warning compares against.
- `src/lib/kosztorys/types.ts:82` `ViewPricingT` carries `clientPrice`, both override fields, and the
  denormalized `globalWToolsCoeff` / `globalOwnToolsCoeff`. Everything the rule needs is on the row —
  no new query, no new prop threading.

The editing surface:

- `src/components/kosztorys/editor/grid/cells/subcontractor-columns.tsx` holds all three columns.
  „Mnożnik" (`subcontractorCoeffColumn`) and „Cena" (`subcontractorPriceColumn`) both write the same
  `overrideType` + `overrideValue` pair; whichever column you type into picks the type. Each already
  rejects unparseable input by returning early from `onChange` before `setRowData`
  (`parsed.kind === 'invalid'`), which is the exact seam the guard hooks into.
- `src/components/ui/decimal-field.tsx:20,54` `DecimalField` already accepts `min`/`max` and, on an
  out-of-range entry, writes the previous value back onto the uncontrolled input and skips the
  commit. The global-coefficient guard is therefore a prop, not new logic.
- `src/components/ui/tooltip.tsx` `SimpleTooltip` wraps Radix but does **not** forward `open`, so it
  can only open on hover. The rejection feedback needs a programmatically-opened tooltip.

Existing precedent for "blocked, and here is why": `kosztorys-row-actions-menu.tsx:62-69` wraps a
disabled action in `SimpleTooltip` carrying the block reason. Existing precedent for a rule-driven red
cell: `kosztorys-v2-columns.tsx:441-444`, where `hasStagesOverPlanned` colours the „% wykonania" cell.

## Desired End State

In either subcontractor view:

- Typing a mnożnik or a kwota stała that would push the price above 80% of the client price does not
  change the row. The cell turns red and opens a tooltip naming the ceiling in złotych. The next
  accepted keystroke, or leaving the cell, clears it.
- The „Cena" cell renders red whenever the row's price is above 80% of the client price and amber
  whenever it is merely above the global-coefficient price — whatever put it there. A lowered client
  price or a raised global coefficient therefore surfaces without anyone touching the subcontractor
  columns.
- The global coefficient field in „Ustawienia" refuses a value above 0.8 and says why in its hint.
- Every total is byte-identical to today. The guard colours and blocks; it never re-prices.

### Key Discoveries:

- `subcontractorPrice` + `effectiveCoeff` (`calc.ts:39-50`) give the rule both figures it needs from a
  row it already has — the guard is a thin predicate over existing pure functions, not new arithmetic.
- `DecimalField`'s `max` already implements reject-and-snap-back (`decimal-field.tsx:54`), so Phase 3
  is one prop plus a hint string.
- `ComputedCell` (`computed-cell.tsx:31-45`) proves the codebase's pattern for a row-reactive cell
  class: `className` may be `(row) => string`, carried through `columnData` so the component identity
  stays stable across renders (EX-422). The „Cena" cell is a bespoke component, not a
  `computedColumn`, so it applies the same idea inline rather than reusing that helper.
- `SimpleTooltip` has no `open` prop. It needs one (optional, forwarded to Radix `Tooltip`) before a
  cell can pop a tooltip on a rejected keystroke rather than on hover.

## What We're NOT Doing

- No threshold column in the database and no per-investment setting — 80% is a code constant.
- No banner or bad-row counter in „Podsumowanie".
- No change to any total, subtotal, or settlement figure. A warned row counts exactly as it does now,
  and an errored row (only reachable side-on, via a lowered client price or a raised global
  coefficient) keeps counting too.
- No guard on the client-price column. Lowering the client price under an existing subcontractor
  price is legal; it just makes the row render red.
- No migration, no backfill. Nothing is persisted by this change.

## Implementation Approach

One pure module owns the rule; three consumers read it and do nothing else. The rule returns a
discriminated result carrying its own Polish message, so no consumer composes a sentence — a message
that reads differently in the tooltip than in the cell is impossible by construction.

The write block lives in the cell's existing `onChange` early-return seam. The standing state is a
render-time class + tooltip on „Cena". The settings guard is a `max` prop. Nothing is shared between
the three except the rule.

## Critical Implementation Details

**Comparison tolerance.** Both comparisons are strictly-greater with a half-grosz tolerance. Without
it a kwota stała typed at exactly the coefficient price (`clientPrice × coeff` re-entered by hand,
rounded to two decimals) reads as "above" on a floating-point remainder and goes amber for no reason
the owner can see.

**Auto rows can only ever be red, never amber.** Under `null` the price _is_ `clientPrice ×
effectiveCoeff`, so the warning comparison is an equality and never fires. Its only failure mode is a
global coefficient above 0.8 — which Phase 3 makes unreachable through the UI, leaving the red path
for rows whose coefficient predates the guard.

**Client price ≤ 0 short-circuits to `null`.** Both comparisons are against a client price; at zero
the ceiling is zero and every non-zero subcontractor price would read as an error on a row that
simply has not been priced yet.

---

## Phase 1: The rule

### Overview

One pure module plus its unit test. Nothing renders yet; this phase is complete when the rule is
correct at its boundaries.

### Changes Required:

#### 1. The guard rule

**File**: `src/lib/kosztorys/subcontractor-price-guard.ts` (new)

**Intent**: Own the whole rule — the threshold, both comparisons, the tolerance, the client-price
short-circuit, and the Polish messages the UI shows. Every consumer reads a result; none re-derives a
figure or writes a sentence.

**Contract**: Exports `MAX_CLIENT_SHARE = 0.8` and

```ts
type SubcontractorPriceIssueT = { severity: 'error' | 'warning'; message: string }
function checkSubcontractorPrice(
  row: ViewPricingT,
  view: ToolPlaneT,
): SubcontractorPriceIssueT | null
```

Precedence: client price ≤ 0 → `null`; price above `clientPrice × MAX_CLIENT_SHARE` → `error`; price
above `clientPrice × effectiveCoeff(row, view)` → `warning`; otherwise `null`. Both figures come from
`calc.ts` (`subcontractorPrice`, `effectiveCoeff`) — this module computes no price of its own.

Also exports `maxSubcontractorPrice(row) = clientPrice × MAX_CLIENT_SHARE`, since the input-rejection
tooltip has to name the ceiling and the settings hint has to name the same constant.

Messages (Polish UI, amounts via `formatNet`):

- error — `Cena wykonawcy nie może przekroczyć 80% ceny klienta (maks. <kwota>).`
- warning — `Cena powyżej stawki z globalnego mnożnika (<kwota>). Pozycja liczy się normalnie.`

#### 2. Unit test

**File**: `src/__tests__/lib/kosztorys/subcontractor-price-guard.test.ts` (new)

**Intent**: Pin the boundaries, which is the whole risk in this change — the rule is three
comparisons and every bug it can have lives on an edge.

**Contract**: Covers exactly 80% of the client price (no error), a hair above (error), exactly the
global-coefficient price (no warning), above it (warning), a client price of 0 and a negative one
(`null` in both), all three override modes, both planes, and a flat amount typed at the rounded
coefficient price (no warning — the tolerance case). Builds rows from the existing fixture helpers in
`src/__tests__/lib/kosztorys/kosztorys-calc.test.ts` if they are exported; otherwise a local factory.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/subcontractor-price-guard.test.ts`
- Type checking passes: `pnpm typecheck`

#### Manual Verification:

- (none — this phase renders nothing)

---

## Phase 2: The grid

### Overview

Wire the rule into the two editable cells (block the write, explain in place) and into the „Cena"
cell's colour (standing state). This is the phase the owner actually sees.

### Changes Required:

#### 1. Controllable tooltip

**File**: `src/components/ui/tooltip.tsx`

**Intent**: Let a caller open a tooltip programmatically. Today `SimpleTooltip` only opens on hover,
so a rejected keystroke has no way to say anything without a second, redundant channel.

**Contract**: `SimpleTooltip` takes an optional `open?: boolean` forwarded to the Radix `Tooltip`
root. Omitted → today's uncontrolled hover behaviour, unchanged for every existing caller.

#### 2. Reject the write and explain it

**File**: `src/components/kosztorys/editor/grid/cells/subcontractor-columns.tsx`

**Intent**: `subcontractorCoeffColumn` and `subcontractorPriceColumn` refuse a value that would breach
80%, at the same early-return seam that already refuses unparseable input. The refusal explains itself
where the user is typing.

**Contract**: Each cell builds the candidate row it is about to commit, runs `checkSubcontractorPrice`
against it, and on `error` returns without calling `setRowData` — the value never enters the row —
while recording the message in cell-local state. That state drives a red input class and an `open`
`SimpleTooltip` around the cell. It clears on the next accepted commit and on blur. `warning` commits
normally and records nothing (the standing state in change 3 shows it).

The block is per-cell state, deliberately not lifted: it describes a keystroke, not the row, and dies
with the cell.

#### 3. Standing state on „Cena"

**File**: `src/components/kosztorys/editor/grid/cells/subcontractor-columns.tsx`

**Intent**: The „Cena" cell renders the rule's verdict on the row as it stands, so a breach caused
from outside the subcontractor columns is still visible.

**Contract**: `subcontractorPriceColumn` runs `checkSubcontractorPrice(rowData, view)` at render and,
when non-null, applies a destructive (error) or amber (warning) class and wraps the cell in a
hover `SimpleTooltip` carrying the result's message. Applies in all three modes — read-only text under
auto/coeff, and the editable input under kwota stała. „Mnożnik" carries no standing state: the rule is
about the price, and a red multiplier would point at the wrong cell when the client price is what
moved.

Amber is whatever the app's existing warning token is; if none exists, add one rather than reaching
for an arbitrary `[...]` colour.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Existing grid tests pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/`

#### Manual Verification:

- W widoku wykonawcy „z narzędziami": w trybie „kwota stała" wpisanie kwoty powyżej 80% ceny klienta nie zmienia wiersza, komórka czerwienieje i pokazuje tooltip z maksymalną kwotą; poprawna kwota kasuje czerwień.
- To samo w kolumnie „Mnożnik" w trybie „własny mnożnik" — mnożnik powyżej 0,8 zostaje odrzucony.
- Kwota stała powyżej stawki z globalnego mnożnika, ale poniżej 80%, wpisuje się normalnie i świeci bursztynowo z tooltipem; sumy w podsumowaniu wykonawcy nie zmieniają się względem stanu sprzed zmiany.
- Obniżenie „Cena j.m." klienta w widoku klienta na tyle, by istniejąca kwota stała przekroczyła 80%, zapala „Cenę" na czerwono po powrocie do widoku wykonawcy.
- To samo zachowanie w widoku „bez narzędzi".

---

## Phase 3: The settings

### Overview

Close the last door: a global coefficient above 0.8 breaches the rule on every „auto" row at once, and
no row-level edit can fix it.

### Changes Required:

#### 1. Cap the global coefficient

**File**: `src/components/kosztorys/editor/toolbar/kosztorys-global-settings.tsx`

**Intent**: Refuse a global coefficient above the threshold at the field, and say so before the user
tries — the existing `COEFF_DESCRIPTION` already explains what the multiplier means and is where the
ceiling belongs.

**Contract**: Both `DecimalField`s get `max={MAX_CLIENT_SHARE}` (reject-and-snap-back is already
implemented at `decimal-field.tsx:54`). `COEFF_DESCRIPTION` gains a line naming the ceiling, sourced
from the same constant rather than a hardcoded „0,8" that can drift from the rule.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- W „Ustawieniach" wpisanie mnożnika powyżej 0,8 cofa pole do poprzedniej wartości i nie zapisuje; 0,8 przechodzi.
- Opis pod polami mówi o suficie.

---

## Testing Strategy

### Unit Tests:

`src/__tests__/lib/kosztorys/subcontractor-price-guard.test.ts` carries the whole automated burden.
The rule is three comparisons over pure inputs, so its boundaries are exhaustively testable at near
zero cost, and every behaviour above it is a class name or an early return over that verdict.

### Integration Tests:

None. Nothing is persisted, no query changes, no server action is touched.

### Manual Testing Steps:

Per phase, above.

## Performance Considerations

`checkSubcontractorPrice` runs once per „Cena" cell per render, over two multiplications on fields
already on the row. At the 1000-row scale the editor targets it is the same order as the
`computedColumn` formulas already evaluated per cell. No memoization — React Compiler is enabled and
this is cheaper than the closure that would cache it.

## Migration Notes

None. No schema change, no persisted field, no existing data touched. Rows that already breach the
rule start rendering red; nothing about them changes.

## References

- Design decisions: `context/changes/2026-07-27-subcontractor-price-guard/change.md`
- Pricing rules: `src/lib/kosztorys/calc.ts:39-55`
- Blocked-action tooltip precedent: `src/components/kosztorys/editor/grid/menus/kosztorys-row-actions-menu.tsx:62-69`
- Rule-driven cell colour precedent: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:441-444`
- Reject-and-snap-back field: `src/components/ui/decimal-field.tsx:43-59`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The rule

#### Automated

- [x] 1.1 Unit tests pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/subcontractor-price-guard.test.ts`
- [x] 1.2 Type checking passes: `pnpm typecheck`

### Phase 2: The grid

#### Automated

- [x] 2.1 Type checking passes: `pnpm typecheck`
- [x] 2.2 Linting passes: `pnpm lint`
- [x] 2.3 Existing grid tests pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/`

### Phase 3: The settings

#### Automated

- [x] 3.1 Type checking passes: `pnpm typecheck`
- [x] 3.2 Linting passes: `pnpm lint`
