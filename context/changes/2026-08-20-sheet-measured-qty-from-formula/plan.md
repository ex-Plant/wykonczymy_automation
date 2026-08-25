# „Pomiar z natury" z formuły — Implementation Plan

## Overview

The import stores the sheet's „Pomiar z natury" only when the cell holds a typed number; any formula
is discarded. Narrow that to the one shape the rule was actually argued for — a formula that reads
the stage-quantity columns — so that a pomiar the owner produced any other way (overwhelmingly
`=N{row}`, a copy of Przedmiar) becomes the reference figure it always was. That is what makes the
„z pomiarem do rozpisania na etapy" diagnostic and the „Rozjazd między arkuszem Google a apką"
column see the ~750 rows they are structurally blind to today.

## Current State Analysis

- `readMeasuredQty` (`src/lib/kosztorys/sheet-import/parse-labor-tab.ts:63-80`) returns `null` on
  `startsWith('=')`. Sole caller `:155`.
- The formula grid is already fetched and aligned cell-for-cell (`read-sheet.ts:92-101`), raggedly
  trimmed by Google — every consumer guards with `formulas[rowIndex] ?? []`.
- The stage run is resolved, not fixed: `findStages` (`resolve-columns.ts:88-97`) returns
  `{ firstColumn, count }`, and `PRZEDPOLE_ROWS` is a live layout with etapy `D–I`.
- A general "does this formula mention column X" matcher already exists as a module-private
  `referencesColumn` in `resolve-rates.ts:102-110`, compiled once per column.
- `sheetMeasuredQty` has exactly one logic reader — `measureDiscrepancy`
  (`settlement-rows.ts:115-132`) — feeding the row condition, the „Rozjazd" column and its sort.
  No total, footer, snapshot, reconciliation or listing figure reads it, and the client view is
  gated away from it three times over. Full map in `research.md`.

## Desired End State

A „Pomiar z natury" cell whose formula reaches into the etapy columns still counts as no claim.
Every other cell — typed, `=N72`, `=2,5+3` — carries its value into the kosztorys as the sheet's
reference figure, and the rozjazd against Σ etapów becomes visible in „Problemy" and in the
„Rozjazd" column. Verified by: opening „Porównaj z arkuszem…" on investment 65 or 31 and seeing
prace whose etapy are empty while the sheet claims work done.

### Key Discoveries:

- `parse-labor-tab.ts:63-80` — the rule, and `:64` the comment that only ever justified `=SUM(D:M)`.
- `resolve-rates.ts:102-110` — the predicate to lift; its lookbehind is what keeps `R` from matching
  inside `AR12`.
- `resolve-rates.ts:107` requires `\$?\d` after the letter, so `=SUM(D:M)` — the exact spelling in
  the code comment and the domain notes — would NOT match. The lifted predicate must accept the
  whole-column form too, or the tautological shape slips through.
- `parse-labor-tab.test.ts:151-163` writes a row-3 formula into EVERY row, so an own-row rule breaks
  it: the predicate must be "mentions a stage column anywhere", not "reads its own row".
- `PRZEDPOLE_ROWS` (`fixtures/kosztorys-sheet/rows.ts:71`) is the fixture that catches a hardcoded
  `D:M`.
- Live scan, all 56 linked sheets: `=SUM(<etapy>)` survives in 2 rows base-wide; `=N{row}` fills
  267–448 rows per sheet.

## What We're NOT Doing

- **No backfill sweep** (owner, 2026-08-20). The values land per investment when „Porównaj
  z arkuszem…" is opened — that path already exists (`kosztorys-import.ts:170-251`) and writes only
  what differs. No script, no migration.
- **No new row condition.** The 480 rows with wholly empty etapy stay under the existing
  „z pomiarem do rozpisania na etapy" (owner, 2026-08-20).
- **No filter on pomiar = 0.** A sheet claiming nothing against etapy that claim something stays a
  rozjazd (owner, 2026-08-20); it is 3 rows base-wide.
- **No change to `measureDiscrepancy`, the column, the sort, or the client view.**
- **Not touching `formula-health.ts`.** Its `ownRowReference` answers a different question (which
  shape is this row) and its `measuredCopiedFromPlanned` counter stays as-is.
- **Not removing the dead `referenceQty`** in `build-sheet-comparison.ts` — separate cleanup.
- **Not fixing the 23 sheets that fail to resolve** — closed by the owner as self-service (insert a
  column for the section name; point at „Wartość netto" with the column picker).

## Implementation Approach

One predicate, built from the resolved stage run and applied where the parser reads the Pomiar cell.
The predicate is lifted out of `resolve-rates.ts` into a module of its own so both call sites share
one regex contract rather than two near-copies — this is the dedup, not an extra abstraction. The
rule change and the two specs that encode the old rule land together, specs first.

## Phase 1: The stage-reference predicate

### Overview

Extract the existing column-reference matcher into a shared module, widen it to whole-column ranges,
and add a stage-aware wrapper.

### Changes Required:

#### 1. New module

**File**: `src/lib/kosztorys/sheet-import/formula-refs.ts`

**Intent**: Home for "does this formula reach into these columns", so the rates resolver and the
robocizna parser share one answer. Carries the lookbehind rationale from its old home.

**Contract**: exports `referencesColumn(column: number): (formula: unknown) => boolean` — the
current behaviour plus the whole-column form — and `referencesAnyColumn(columns: number[])`, which
the stage case uses. The pattern must match both `D5`/`$D$5` and the `D:` of a whole-column range;
everything else about it (uppercase fold, `startsWith('=')` guard, compile-once-per-column) is
unchanged. Regex is the one place a snippet is warranted:

```
`(?<![A-Z])\\$?${columnLetter(column)}(\\$?\\d|\\s*:)`
```

#### 2. Rates resolver

**File**: `src/lib/kosztorys/sheet-import/resolve-rates.ts`

**Intent**: Drop the local copy and import the shared one. Behaviour is unchanged for the rates path
— a rate formula referencing a whole column is not a shape that tab has.

**Contract**: `referencesColumn` at `:102-110` deleted; call sites at `:252` and `:275` untouched.

### Success Criteria:

#### Automated Verification:

- New spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/formula-refs.test.ts`
- Rates resolution is unchanged: `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/resolve-rates.test.ts`

#### Manual Verification:

- None — no user-visible surface in this phase.

---

## Phase 2: Narrow the Pomiar rule

### Overview

The parser stops discarding every formula, and the two specs that assert the old rule are rewritten
to assert the new one. Specs first: both must go red before the parser changes.

### Changes Required:

#### 1. The parser

**File**: `src/lib/kosztorys/sheet-import/parse-labor-tab.ts`

**Intent**: „Pomiar z natury" means nothing only when the sheet computed it FROM the etapy — that is
the tautology the rule was built for. A formula that produced the number any other way is still the
owner's claim about what was measured, and it is exactly the claim the rozjazd is meant to test.
Rewrite the `:63-67` comment: it currently states the broad rule as the reason.

**Contract**: `readMeasuredQty` takes the resolved stage columns and skips the cell only when the
formula references one of them; the empty-cell and non-finite guards are untouched. `parseLaborTab`
already has `resolved.stages` in scope at the call site (`:89`, `:155`) — no signature change.

#### 2. Specs — rewritten red-first

**File**: `src/__tests__/lib/kosztorys/sheet-import/parse-labor-tab.test.ts`

**Intent**: The `:151` case keeps its `=SUM(D3:M3)` fixture and still passes, but its title
(„written as a formula") now claims more than the code does. Retitle to name the stage sum, and add
the mirror case: a Pomiar written as a reference to Przedmiar IS read.

**Contract**: existing `it` retitled; one new `it` asserting `=N5` in the Pomiar column yields the
cell's value, not `null`. `POMIAR_COLUMN` and `BIALOSTOCKA_ROWS` are already in the file.

**File**: `src/__tests__/lib/kosztorys/sheet-import/build-sheet-comparison.test.ts`

**Intent**: `:239-248` asserts the old definition through the `referenceQty` counter and its comment
states the reversed semantics. It must encode the new rule instead — which means the fixture needs
BOTH shapes, or the test proves nothing about the boundary.

**Contract**: the formula fixture puts `=SUM(D5:M5)` on one praca row and `=N{row}` on another;
`referenceQty` becomes `{ matched: 3, withValue: 2 }` for a different reason (the stage sum is the
one dropped). Comment rewritten to say which shape is refused and why.

**File**: `src/__tests__/lib/actions/kosztorys-compare-with-sheet.test.ts`

**Intent**: `:135-152` is the DB-backed end-to-end assertion of the same rule, and the two `it`s
after it read the rows this one leaves behind — so the fixture change has to keep a cleared row for
them to be about anything.

**Contract**: the `=N5` fixture on `FIRST_ITEM_ROW` becomes `=SUM(D5:M5)`; counters stay
`{ updated: 2, cleared: 1, unmatched: 1 }` and the `null` expectation holds — the rule now refuses
the stage sum rather than any formula. Add a case asserting `=N5` is written rather than cleared.
`:154-209` re-checked against the state the rewritten test leaves.

### Success Criteria:

#### Automated Verification:

- Parser specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/parse-labor-tab.test.ts`
- Comparison spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/build-sheet-comparison.test.ts`
- DB-backed spec passes: `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-compare-with-sheet.test.ts`
- Both specs were seen RED before the parser change (record the failure output in the commit body).

#### Manual Verification:

- „Porównaj z arkuszem…" on investment 65 reports prace whose Pomiar was previously discarded, and
  the „Problemy" menu shows a non-zero „z pomiarem do rozpisania na etapy".
- On an investment whose sheet is the blank offer (`=SUM(<etapy>)` throughout), the count stays 0 —
  the tautology is still refused.
- Re-opening the same window a second time reports „już zgodne" (nothing rewritten).
- The investor preview shows no „Rozjazd" column and no problems menu.

---

## Phase 3: Comments and the record

### Overview

Three comments in the code now state the broad rule as fact, and two documents record the blind spot
as accepted. Both must say what is true, and the reversal must be legible so nobody restores it.

### Changes Required:

#### 1. Stale comments

**File**: `src/lib/kosztorys/sheet-import/read-sheet.ts`, `src/lib/kosztorys/sheet-import/footer-totals.ts`

**Intent**: `read-sheet.ts:96-100` justifies the second grid fetch with "a formula is the only
evidence a figure was not typed" — the fetch is still needed, the reason narrows.
`footer-totals.ts:125-140` explains reading the Pomiar column off the grid because the stored figure
is null on formula cells; the code stays correct (it never trusted the field) but the stated reason
no longer holds.

**Contract**: comment text only, no behaviour change in either file.

#### 2. The record

**File**: `context/reference/kosztorys-editor-domain-notes.md`, `context/reference/kosztorys-sheet/formula-anomalies.md`

**Intent**: The domain notes (`:109-118`, `:740-745`) record the owner's 2026-08-15 ruling that
`=N{row}` is a normal state, with the agent's inference „nie ma czego zapisać jako pomiar" appended.
The inference is what today's ruling reverses; the ruling itself stands. `formula-anomalies.md`
records the „strukturalnie ślepa" column and the 16 677 zł behind it as accepted — that is now
resolved and must say so, with the amount, so the dogfooding gap has a visible ending.

**Contract**: prose only. Both entries name the date and the owner's ruling.

### Success Criteria:

#### Automated Verification:

- None — prose and comments only.

#### Manual Verification:

- Neither document still claims the „Rozjazd" column is blind on `=N{row}`.

---

## Testing Strategy

### Unit Tests:

- The predicate: single-letter vs two-letter columns, `$` anchors, `D5` vs `D:M`, and the `AR12`
  false-hit the lookbehind exists to prevent.
- The parser: stage sum refused, Przedmiar reference accepted, empty cell still not a zero
  measurement, narrow-etapy layout (`PRZEDPOLE_ROWS`) not tripped by a `D:M` assumption.

### Integration Tests:

- The DB-backed compare action: which prace get a figure written, which get cleared, and that a
  second read writes nothing.

### Manual Testing Steps:

1. Open „Porównaj z arkuszem…" on investment 65, confirm prace appear that were silent before.
2. Open „Problemy" → „z pomiarem do rozpisania na etapy", confirm the list is non-empty and the
   „Rozjazd" column reveals itself.
3. Open the same investment's client preview, confirm neither surface appears.
4. Repeat step 1 on an investment whose sheet is the blank offer, confirm nothing is claimed.

## Performance Considerations

`conditionCounts` (`use-kosztorys-editor.ts:360-365`) walks every row for every registry entry on
every edit, and today `measure-diverged` short-circuits at `sheetQty == null` on nearly every row.
After the change each such row costs `rowTotalQtyDone` plus two `netForQtyForView` calls — on the
worst investment that is ~150 rows out of ~450. Worth a look on the 1000-row perf dataset
(`perf-seed-kosztorys.ts`) if editing feels heavier; no pre-emptive optimisation.

## Migration Notes

None. No schema change, no backfill — the values land per investment through the existing compare
window. Kosztorys data is throwaway until dogfooding merges to `main`.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`
- Golden master unchanged: `pnpm test:parity`

## References

- Research: `context/changes/2026-08-20-sheet-measured-qty-from-formula/research.md`
- The rule's origin: `context/archive/2026-08-13-pomiar-bez-etapu/plan.md`
- The blind spot as accepted: `context/reference/kosztorys-sheet/formula-anomalies.md`
- The predicate's current home: `src/lib/kosztorys/sheet-import/resolve-rates.ts:102-110`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The stage-reference predicate

#### Automated

- [x] 1.1 New spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/formula-refs.test.ts` — 29761d54
- [x] 1.2 Rates resolution is unchanged: `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/resolve-rates.test.ts` — 29761d54

### Phase 2: Narrow the Pomiar rule

#### Automated

- [x] 2.1 Parser specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/parse-labor-tab.test.ts` — ba60b524
- [x] 2.2 Comparison spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/build-sheet-comparison.test.ts` — ba60b524
- [x] 2.3 DB-backed spec passes: `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-compare-with-sheet.test.ts` — ba60b524
- [x] 2.4 Both specs seen RED before the parser change — ba60b524

### Phase 3: Comments and the record

#### Automated

- [x] 3.1 No phase-scoped automated check — prose and comments only — a93e7a49
