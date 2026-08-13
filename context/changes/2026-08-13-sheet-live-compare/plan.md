# Porównanie z arkuszem na żywo — Implementation Plan

## Overview

Two actions built on one live read of the owner's sheet:

- **„Porównaj z arkuszem"** — a dialog that reckons both sides (sheet totals vs the investment's
  stored tree), lists the pozycje that exist on only one side, and reports three classes of suspicious
  formulas. Its most important output is the sentence that says how many pozycje the „Rozjazd" column
  is structurally blind on — today zero rozjazdów reads as agreement when it actually means _nothing
  to compare against_.
- **„Zaciągnij pomiary z arkusza"** — refreshes the stored reference quantity on matched pozycje
  without the full wipe-and-reinsert import.

Preceded by the removal of the „Etapy są prawdą" row action: the escape hatch goes away, and a
rozjazd now closes only by fixing the sheet or filling the etapy.

## Current State Analysis

The read path is already built and safe. `readImportGrids` (`sheet-import/read-sheet.ts:43`) takes
its client as a parameter, runs under a `spreadsheets.readonly` credential that physically cannot
write, and fetches **values and formulas in one parallel pair of `values.batchGet` calls**
(`:69-78`). The formula grid is then discarded once `buildImportPlan` returns — nothing in
`ImportReportT` carries a formula string. That discarded grid is the entire raw material for formula
health.

What exists and is reusable:

- `itemKey` / `keyItems` (`build-import-plan.ts:49,65`) — the section+description+occurrence identity
  the sheet forces on us, because rows have no stable id. Module-private today.
- `currentByKey` (`:177-180`) — already maps that key onto the investment's **real**
  `kosztorys_items.id`. That is exactly the join a write needs; it is simply never used for one.
- `parseRobocizna` (`parse-robocizna.ts:79`) — turns the robocizna grid into sections/items/stages
  with no dependency on the cennik tabs.
- `compareFooterTotals` (`footer-totals.ts:51`) — but note what it actually compares: the sheet's
  footer rows against what the app computes **from the sheet's own parsed items**. It validates the
  parse; it does **not** compare the sheet against the investment's stored tree. The both-sides
  reckoning this change needs is genuinely new.
- `previewKosztorysImport` / `applyKosztorysImport` (`actions/kosztorys-import.ts:48,83`) — the
  read/write pair, its shared `derivePlan`, its `sheetFailureMessage` translation of Google's English
  errors, and the never-trust-the-payload rule stated at `:81-82`.
- `handleOpenImport` (`toolbar/menus/kosztorys-actions-menu.tsx:91-105`) — the fetch-on-click pattern
  and the documented Radix workaround (a programmatically-opened dialog never fires `onOpenChange`,
  so the **parent** fetches and passes `preview` + `loaded` as props).

What blocks a comparison today:

- `buildImportPlan` returns `{ok:false}` when zero cennik tabs parse (`:142-150`). That refusal is
  correct for an import — it stops 0 zł subcontractor rates being written to 400 pozycje — but on an
  inspector it would blank the whole diagnosis on exactly the sheet that needs diagnosing. The
  comparison sidesteps it structurally: it needs no rates at all, so it never calls `resolveItemRates`.
- `readMeasuredQty` (`parse-robocizna.ts:65-77`) refuses **any** formula. Correct for `=SUM(D:M)`
  (comparing Σ etapów with Σ etapów can never fire) and — per the ruling below — also kept for `=N`.

## Desired End State

Opening „Porównaj z arkuszem" on investment 31 reads the sheet fresh and answers three questions
without leaving the editor: how far apart the two sides are in złotych, which pozycje exist on only
one side, and on how many pozycje the „Rozjazd" column cannot say anything because the sheet's Pomiar
is a copied Przedmiar. „Zaciągnij pomiary z arkusza" brings the reference quantities up to date in one
click. The „Etapy są prawdą" action is gone from the row menu and from the codebase.

### Key Discoveries

- `compareFooterTotals` is sheet-vs-parse, not sheet-vs-app (`footer-totals.ts:41-50`) — reuse it as
  the sheet's **internal consistency** check, and build the app-vs-sheet reckoning separately.
- `currentByKey` (`build-import-plan.ts:177-180`) already holds live DB ids under the match key.
- The zero-cennik refusal is bypassed by _not needing rates_, not by adding a flag.
- Row identity is fragile by construction: any description or section rename breaks the match and any
  reorder of two identically-named prace silently swaps which DB row each maps to
  (`build-import-plan.ts:49-50`, `columns.ts:29-36`). The comparison must present unmatched rows as a
  _question_, never as a fact about the world.
- `null` in the stored reference figure collapses several meanings — no such column, empty cell, a
  formula. After Phase 1 it no longer also means „the owner dismissed this row", which is precisely
  what makes the refresh a plain overwrite with nothing to preserve.

## What We're NOT Doing

- **Not** importing `=N` Pomiar as a reference quantity. It is a copied offer, not a measurement;
  showing it as a rozjazd would turn that column into a list of work not yet done, which is
  „Pozostało"'s job. It is reported in the formula-health block instead.
- **Not** writing anything back to the sheet. Bidirectional sync stays a parked non-goal
  (`roadmap.md` § Parked, `prd.md:298-299`); this change lands inside the read-only importer exception.
- **Not** previewing before the refresh writes. With the escape hatch gone there is no decision left
  to protect, and a preview would cost a second full read (apply may never trust the browser's copy).
- **Not** caching the comparison. Every open is a fresh read.
- **Not** rendering a per-pozycja table of all 336 rows — that is a second grid and duplicates the
  „Rozjazd" column.
- **Not** detecting anomalies generically (majority-pattern-per-column). Three named classes only.
- **Not** writing a browser test now — filed to the E2E backlog.
- **Not** dropping the `sheet_measured_qty` column or its migration. The figure stays; only the
  per-row escape hatch goes.

## Implementation Approach

Four moving parts, in dependency order: remove the escape hatch → build the pure comparison core →
expose it through a server read and a dialog → add the write action. The pure core carries all the
logic and all the tests; the dialog renders a record it does not compute.

The comparison deliberately reuses the importer's parser and identity helpers rather than reading the
sheet its own way. A second copy of the occurrence-indexed key would drift the first time a pozycja is
renamed, and the two features would then disagree about which rows match — the exact class of bug the
„one concept, one name" rule exists to prevent.

## Critical Implementation Details

**Layer choice, recorded deliberately.** `AGENTS.md` says an on-demand read a client component invokes
belongs in `src/lib/queries` as a `'use server'` function returning a plain object, never in
`src/lib/actions`. The comparison read lands in `src/lib/actions/kosztorys-import.ts` anyway, next to
`previewKosztorysImport`, which is itself a pure read living there. Reason: the two share
`getInvestmentSheetId`, `sheetFailureMessage` and `readImportGrids`, and the dialog's error path is
already written against `ActionResultT`. Splitting the pair across two layers would duplicate the
failure-message helper and give the two sheet-reading dialogs two different error shapes. The rule's
only surviving example (`queries/register-saldo.ts`) is an unrelated scalar read.

**The refresh writes `null` too.** On a matched pozycja whose sheet Pomiar is now empty or a formula,
the refresh clears the stored figure rather than leaving a stale number behind. Overwriting _is_ the
contract, in both directions.

**Bulk write, not N round-trips.** 336 pozycje through `payload.update` is 336 statements. The refresh
writes through a single raw-SQL statement in `src/lib/db/`, per the data-access layer rule.

---

## Phase 1: Usunięcie „Etapy są prawdą"

### Overview

Delete the per-row escape hatch entirely. A rozjazd now closes only by fixing the sheet or by filling
the etapy. This must land first: it is what makes the refresh in Phase 4 a plain overwrite with no
second state to preserve.

### Changes Required:

#### 1. The server action and its test

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: Remove `clearSheetMeasuredQtyAction` (`:122-144`) including its docblock — nothing else
mutates the reference figure per row.

**Contract**: The exported symbol `clearSheetMeasuredQtyAction` disappears. `sheetMeasuredQty` stays
absent from `ItemPatchT` / `itemPatchSchema`, so the figure remains read-only by type.

**File**: `src/__tests__/lib/actions/kosztorys-clear-sheet-measured-qty.test.ts`

**Intent**: Delete — its entire subject is gone.

#### 2. The editor handler and the prop chain

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Remove the import (`:73`), the `onClearSheetMeasuredQty` entry in the returned column opts
(`:374`) and `handleClearSheetMeasuredQty` (`:995-1005`) with its „Etapy są prawdą" comment.

**Contract**: The editor's column-opts object no longer carries `onClearSheetMeasuredQty`.

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts`

**Intent**: Drop the optional `onClearSheetMeasuredQty` field (`:67-69`) and its comment.

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: Drop the guarded prop wiring (`:247-250`).

#### 3. The row menu item

**File**: `src/components/kosztorys/editor/grid/menus/kosztorys-row-actions-menu.tsx`

**Intent**: Remove the `onClearSheetMeasuredQty` prop (`:54-56`, `:66`) and the menu item plus its
description (`:120-128`), along with any separator left dangling.

**Contract**: `KosztorysRowActionsMenu`'s props type loses `onClearSheetMeasuredQty`.

#### 4. The record

**File**: `context/foundation/manual-checks.md`

**Intent**: Remove the EX-686 manual check that exercises „Etapy są prawdą" — the behaviour it
verifies no longer exists.

**File**: `context/changes/2026-08-13-sheet-live-compare/change.md`

**Intent**: Record the removal and the reason (the escape hatch hid the symptom by deleting data, was
per-row against a bulk problem, and was the sole reason the refresh had a decision to make).

### Success Criteria:

#### Automated Verification:

- No reference to `clearSheetMeasuredQty` or `onClearSheetMeasuredQty` remains: `grep -rn "learSheetMeasuredQty" src/` returns nothing
- The divergence-column spec still passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/divergence-column.test.ts`

#### Manual Verification:

- The row action menu on a pozycja carrying an imported Pomiar no longer offers „Etapy są prawdą"
- The „Rozjazd" column, its counter and its filter still behave as before

---

## Phase 2: Rdzeń porównania

### Overview

A pure, synchronous module that turns the sheet grids plus the investment's current tree into a
comparison record. No I/O, no rates, no writes — and therefore no exposure to the zero-cennik refusal.
This phase carries the logic and all the unit tests.

### Changes Required:

#### 1. Row identity, extracted

**File**: `src/lib/kosztorys/sheet-import/item-key.ts` (new)

**Intent**: Move `itemKey` and `keyItems` out of `build-import-plan.ts` verbatim, comments included,
so both the import and the comparison key rows through one implementation. A second copy would drift
the first time a pozycja is renamed, and the two features would then disagree about which rows match.

**Contract**: `export const itemKey(section, description, occurrence): string` and
`export function keyItems(items, sectionName): Map<string, KosztorysItemT>` — signatures unchanged.
`build-import-plan.ts` imports both instead of defining them.

#### 2. The comparison record

**File**: `src/lib/kosztorys/sheet-import/build-sheet-comparison.ts` (new)

**Intent**: Build the both-sides reckoning: what each side says the work is worth, which pozycje are
on one side only, and how many rows carry a reference quantity at all. Deliberately does not resolve
rates, which is what keeps it working on a sheet whose cennik is broken.

**Contract**:

```ts
export type SheetComparisonT = {
  // Both sides' money, computed through calc.ts on each side rather than summed locally —
  // a reimplementation would agree with the parser's own mistakes.
  totals: {
    plannedNetFromSheet: number
    plannedNetFromApp: number
    executedNetFromSheet: number
    executedNetFromApp: number
  }
  // The sheet's own summary rows against what its own prace add up to — internal consistency,
  // reused verbatim from the import preview.
  footer: FooterComparisonT[]
  counts: { sheetItems: number; appItems: number; matched: number }
  onlyInSheet: { section: string; description: string }[]
  onlyInApp: { section: string; description: string }[]
  // How many matched pozycje would carry a reference quantity after a refresh — the denominator
  // behind „Rozjazd nic o nich nie powie".
  referenceQty: { matched: number; withValue: number }
  health: FormulaHealthT
}

export function buildSheetComparison(
  grids: ImportGridsT,
  currentTree: SnapshotPayloadT,
): { ok: true; comparison: SheetComparisonT } | { ok: false; problems: string[] }
```

`ok:false` only when `resolveRobocizna` itself fails — a sheet whose robocizna columns cannot be
located has nothing to compare. A broken cennik is **not** a refusal here.

The app side of `totals` reads `currentTree` through the same `calc.ts` entry points
`footer-totals.ts:61-71` uses on the sheet side (`rowPlannedNetForView` / `netForQtyForView`, client
plane), so the two halves of each pair are computed the same way.

#### 3. Formula health

**File**: `src/lib/kosztorys/sheet-import/formula-health.ts` (new)

**Intent**: Classify the already-fetched formula grid into the three classes that actually change
money or blind the comparison. Everything else is left alone — a class that is harmless today teaches
the owner to ignore the block.

**Contract**:

```ts
export type FormulaHealthT = {
  // Pomiar copied from Przedmiar (`=N<own row>`): not a measurement, so no reference quantity is
  // stored — these rows are why zero rozjazdów proves nothing.
  measuredCopiedFromPlanned: number
  // Przedmiar read from an etap column (`=M<own row>`): the offer becomes a derivative of execution,
  // and an empty etap makes it a zero offer — this is what pushed „Pozostało" positive.
  plannedReadFromStage: number
  // #REF! / #DIV/0! arriving as strings from UNFORMATTED_VALUE and silently coerced to 0.
  errorValues: number
  // Row-level detail for the classes above, capped for rendering.
  samples: { row: number; description: string; klass: FormulaClassT }[]
  totalRows: number
}

export function scanFormulaHealth(
  grid: unknown[][],
  formulas: unknown[][],
  resolved: ResolvedRobociznaT,
  footerStart: number,
): FormulaHealthT
```

Own-row references are matched by normalizing the formula's own row number to a marker before
comparing, per the method already written down in
`context/reference/kosztorys-sheet/formula-anomalies.md:88-97`. Only rows above `footerStart` are
scanned — summary rows are formulas by nature.

#### 4. Specs

**File**: `src/__tests__/lib/kosztorys/sheet-import/formula-health.test.ts` (new)

**Intent**: Pin the three classes against hand-built grids: `=N5` in Pomiar on row 5 counts as copied;
`=SUM(D5:M5)` does **not** (it is the canonical sheet's own shape and must not be reported as an
anomaly); `=M5` in Przedmiar counts; `#REF!` as a string counts; a hand-typed number counts as
nothing. Include the two harmless cases from the anomaly scan (`=219,25+21,75` in Przedmiar,
`=600-70-60` in an etap column) as rows that must **not** be reported.

**File**: `src/__tests__/lib/kosztorys/sheet-import/build-sheet-comparison.test.ts` (new)

**Intent**: Pin the diff and the totals: a pozycja present on both sides counts as matched; one renamed
in the sheet shows up in both `onlyInSheet` and `onlyInApp` (the honest answer given content-based
identity); a sheet with zero readable cennik tabs still produces a comparison; `referenceQty.withValue`
counts only rows whose Pomiar was typed by hand.

**File**: `src/__tests__/lib/kosztorys/sheet-import/build-import-plan.test.ts`

**Intent**: Unchanged in substance — it must still pass after the key helpers move, which is the
regression guard on the extraction.

### Success Criteria:

#### Automated Verification:

- New specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/formula-health.test.ts src/__tests__/lib/kosztorys/sheet-import/build-sheet-comparison.test.ts`
- The importer's own specs still pass after the extraction: `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/`

#### Manual Verification:

- None — this phase has no user-visible surface.

---

## Phase 3: Odczyt serwerowy i okno „Porównaj z arkuszem"

### Overview

Wire the pure core to a live read and render it. One read per click, no caching. A failure produces a
single error toast.

### Changes Required:

#### 1. The server read

**File**: `src/lib/actions/kosztorys-import.ts`

**Intent**: Add `compareWithSheet(investmentId)` beside `previewKosztorysImport`, reading the grids and
the current tree and handing both to `buildSheetComparison`. Reuses `getInvestmentSheetId`,
`MISSING_SHEET` and `sheetFailureMessage` so the two sheet-reading dialogs fail in the same words.

**Contract**: `export async function compareWithSheet(investmentId: number): Promise<ActionResultT<SheetComparisonT>>`,
wrapped in `protectedAction` with no revalidation tags (it writes nothing).

#### 2. The dialog

**File**: `src/components/kosztorys/editor/dialogs/sheet-compare-dialog.tsx` (new)

**Intent**: Render the comparison record: the two both-sides money rows with their difference, the
sheet's internal footer check, the two unmatched lists, and the formula-health block. The health block
leads with the sentence that matters — how many pozycje out of how many carry a Pomiar copied from
Przedmiar, and therefore that the „Rozjazd" column says nothing about them.

**Contract**: `type PropsT = { open: boolean; onOpenChange: (open: boolean) => void; comparison: SheetComparisonT | null; loaded: boolean }`
— fetched by the parent and passed in, mirroring `SheetImportDialog`'s contract for the documented
Radix reason. Wide content needs `sm:max-w-4xl` plus the edge-to-edge `p-0` + inner-scroll layout from
`add-sections-from-preset-dialog.tsx:111,122`; `DialogContent` otherwise caps at `min(90vw,600px)`
(`ui/dialog.tsx:55`). The unmatched lists are capped with a „…i N więcej" tail rather than rendering
hundreds of rows.

#### 3. The report vocabulary, shared

**File**: `src/components/kosztorys/editor/dialogs/sheet-report-block.tsx` (new)

**Intent**: `SheetImportDialog`'s `Block` (`:180-187`) is file-local and unexported, and both dialogs
need the same labelled-section shape. Extract it once and have both import it, rather than growing a
second visual dialect for the same report.

**Contract**: A named export taking a title and children; `sheet-import-dialog.tsx` drops its local
copy and imports this one.

#### 4. The menu entry

**File**: `src/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.tsx`

**Intent**: Add „Porównaj z arkuszem…" directly under „Pobierz z arkusza Google…", with a
`handleOpenCompare` modelled on `handleOpenImport` (`:91-105`) — set open, clear the previous result,
fetch on the click, toast on failure, set loaded in `finally`. The dialog is mounted as a sibling of
`DropdownMenu`, never a child.

**Contract**: New state `compareOpen` / `comparison` / `compareLoaded`; the dialog joins the existing
sibling stack at `:182-217`.

### Success Criteria:

#### Automated Verification:

- No phase-scoped automated check — this phase is server wiring plus presentational components whose
  logic all lives in Phase 2's tested core. The whole-tree gate covers it at the end.

#### Manual Verification:

- On investment 31, „Porównaj z arkuszem…" opens and reports a difference between the sheet's wartość
  netto and the app's, and names how many pozycje have a Pomiar copied from Przedmiar
- The dialog scrolls internally on a long unmatched list; the page itself never scrolls sideways
- Unsharing the sheet (or cutting the network) produces one error toast rather than a broken dialog
- An investment with no kosztorys attached reports „Inwestycja nie ma kosztorysu."

---

## Phase 4: „Zaciągnij pomiary z arkusza"

### Overview

Refresh the stored reference quantity on every matched pozycja, in one click, without preview. The
server re-reads and re-derives; it takes nothing from the browser but an investment id.

### Changes Required:

#### 1. The bulk write

**File**: `src/lib/db/kosztorys-sheet-measured-qty.ts` (new)

**Intent**: Set the reference quantity on many pozycje in one statement — 336 `payload.update` calls
would be 336 round-trips.

**Contract**: `export async function setSheetMeasuredQty(rows: { id: number; qty: number | null }[]): Promise<number>`
— a single `UPDATE … FROM (VALUES …)` returning the number of rows touched. Statement plus row mapper
only; no auth and no cache work, per the layer rule.

#### 2. The action

**File**: `src/lib/actions/kosztorys-import.ts`

**Intent**: Add `refreshSheetMeasuredQty(investmentId)`. Re-reads the sheet, rebuilds the match, and
writes the sheet's current claim onto every matched pozycja — including `null` where the sheet no
longer has a hand-typed Pomiar, so a stale number cannot survive a refresh.

**Contract**: `export async function refreshSheetMeasuredQty(investmentId: number): Promise<ActionResultT<{ updated: number; cleared: number; unmatched: number }>>`,
`protectedAction` with `KOSZTORYS_TREE_TAGS`. Takes **only** the investment id — the same
never-trust-the-payload rule stated at `:81-82` and independently at `sheets-sync.ts:234-237`.

#### 3. The trigger

**File**: `src/components/kosztorys/editor/dialogs/sheet-compare-dialog.tsx`

**Intent**: A button inside the comparison dialog — the comparison _is_ the preview, so a separate
menu entry would ask the owner to read the same numbers twice. On success it reports what changed and
asks the editor to reload the tree via the existing `onTreeReplaced` path.

**Contract**: New optional prop `onRefreshed?: () => void`, wired in the actions menu to the same
`onTreeReplaced?.()` the import already uses.

#### 4. Spec

**File**: `src/__tests__/lib/actions/kosztorys-refresh-sheet-measured-qty.test.ts` (new)

**Intent**: Assert the **persisted rows**, not the action's return value — a success result can hide a
failed write. Cover: a matched pozycja gets the sheet's hand-typed Pomiar; a matched pozycja whose
sheet Pomiar became a formula gets `null`; an unmatched pozycja is left untouched. DB-backed, under
the integration-gate tree.

### Success Criteria:

#### Automated Verification:

- The refresh spec passes: `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-refresh-sheet-measured-qty.test.ts`

#### Manual Verification:

- On investment 31, the refresh reports a non-zero count and the „Rozjazd" counter changes accordingly
- Editing a Pomiar in the sheet and refreshing again moves that pozycja's rozjazd
- Clearing a Pomiar in the sheet and refreshing removes that pozycja's reference figure

---

## Phase 5: Domknięcie

### Overview

Put the change where the team looks for it, and record what was deliberately not built.

### Changes Required:

#### 1. Roadmap and tracker

**File**: `context/foundation/roadmap.md`

**Intent**: Record this work under the importer slice (S-15) as a follow-up rather than a new number —
the owner's call. Update the slice's `Status` in both places it appears (the at-a-glance row and the
per-slice block).

**Contract**: Mirror the same state onto S-15's Linear issue. Reality-check the Linear MCP first; if
it is unreachable, update `roadmap.md` only and say so rather than claim a change that did not happen.

#### 2. E2E backlog

**Intent**: File one Linear issue labelled `e2e-backlog` in project „Wykonczymy" covering the browser
path for both actions, and note in it that a browser test needs a stubbed Google sheet — the harness
is larger than the feature. EX-686 has no such issue either; note that gap in the same place rather
than opening a second one.

#### 3. Living docs

**File**: `context/reference/kosztorys-sheet/formula-anomalies.md`

**Intent**: Update the „Wnioski dla importera" section: point 2's open ruling is now decided (`=N` is
reported, never imported), and note that the scan described there is now implemented rather than only
prescribed.

**File**: `context/reference/kosztorys-editor-domain-notes.md`

**Intent**: Record that the rozjazd has no per-row escape hatch — it closes by fixing the sheet or
filling the etapy — and what the live comparison answers that the stored figure cannot.

### Success Criteria:

#### Automated Verification:

- No phase-scoped automated check — this phase is prose and tracker state only.

#### Manual Verification:

- S-15's Linear issue and `roadmap.md` agree on the slice's state
- The `e2e-backlog` issue exists and its id is recorded in the review-gate ledger

---

## Testing Strategy

### Unit Tests

- Formula classification: the three reported classes, and — just as important — the shapes that must
  **not** be reported (`=SUM(D:M)` in Pomiar, hand arithmetic in Przedmiar or an etap column).
- The comparison diff: matched / only-in-sheet / only-in-app, including the rename case where a single
  pozycja honestly appears in both unmatched lists.
- Resilience: a sheet with zero readable cennik tabs still yields a comparison.

### Integration Tests

- The refresh action against the test DB, asserting the persisted `sheet_measured_qty` on each of the
  three row classes (matched-with-value, matched-now-formula, unmatched).

### Manual Testing Steps

1. Open investment 31's kosztorys, run „Porównaj z arkuszem…", confirm the difference and the
   copied-Pomiar count match `formula-anomalies.md`.
2. Run „Zaciągnij pomiary z arkusza", confirm the rozjazd counter changes and the figures move toward
   each other.
3. Edit one Pomiar in the sheet, refresh again, confirm only that pozycja moved.
4. Revoke the service account's access to a test sheet and confirm a single error toast.

## Performance Considerations

One comparison is 1 × `spreadsheets.get` + 2 × `values.batchGet` plus one full tree read — the same
cost as an import preview, which is proven acceptable for a single investment. Deliberately uncached:
a stale comparison would defeat the only reason the feature exists. The refresh pays the same read
again rather than trusting the browser's copy, and writes through one statement.

## Migration Notes

None. No schema change: `sheet_measured_qty` and its migration stay exactly as they are. Phase 1
removes a mutation of that column, not the column.

## Whole-tree Gate

Run once, after Phase 5.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full suite passes: `pnpm test`
- Build succeeds: `pnpm build`

## References

- Research: `context/changes/2026-08-13-sheet-live-compare/research.md`
- Origin and rejected alternatives: `context/changes/2026-08-13-sheet-live-compare/change.md`
- The anomaly scan this change acts on: `context/reference/kosztorys-sheet/formula-anomalies.md`
- The divergence model it extends: `context/changes/2026-08-13-pomiar-bez-etapu/`
- The import pipeline's design of record: `context/changes/2026-08-11-kosztorys-importer/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Usunięcie „Etapy są prawdą"

#### Automated

- [x] 1.1 No reference to `clearSheetMeasuredQty` remains in `src/` — b5307753
- [x] 1.2 The divergence-column spec still passes — b5307753

### Phase 2: Rdzeń porównania

#### Automated

- [x] 2.1 Formula-health and comparison specs pass — daaa172c
- [x] 2.2 The importer's own specs still pass after the key extraction — daaa172c

### Phase 3: Odczyt serwerowy i okno „Porównaj z arkuszem"

#### Automated

- [x] 3.1 No phase-scoped automated check (server wiring + presentation; logic tested in Phase 2)

### Phase 4: „Zaciągnij pomiary z arkusza"

#### Automated

- [ ] 4.1 The refresh spec passes against the persisted rows

### Phase 5: Domknięcie

#### Automated

- [ ] 5.1 No phase-scoped automated check (prose and tracker state only)
