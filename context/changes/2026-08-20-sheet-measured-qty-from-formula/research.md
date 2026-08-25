---
date: 2026-08-20T07:30:15Z
researcher: ex-Plant
git_commit: 069071557ecefbff24f6c5fb5fc970f73fcdcff8
branch: kosztorys-client-view-offer-settlement-variants
repository: wykonczymy
topic: "Importing „Pomiar z natury" when the cell holds a formula that is not the stage sum"
tags: [research, codebase, kosztorys, sheet-import, measured-qty, rozjazd]
status: complete
last_updated: 2026-08-20
last_updated_by: ex-Plant
---

# Research: importing „Pomiar z natury" from a formula cell

**Date**: 2026-08-20T07:30:15Z
**Researcher**: ex-Plant
**Git Commit**: `069071557ecefbff24f6c5fb5fc970f73fcdcff8`
**Branch**: `kosztorys-client-view-offer-settlement-variants`
**Repository**: wykonczymy

## Research Question

The import discards „Pomiar z natury" whenever the cell holds a formula, so the diagnostic
„z pomiarem do rozpisania na etapy" is structurally blind on most live sheets. Can the rule be
narrowed to "only a formula that references the stage-quantity columns means no measurement", and
what does that touch?

## Summary

**The broad rule was never ruled on.** Every recorded justification — the archived plan, the commit
message, the code comment, the domain notes — argues one shape only: `=SUM(<stage columns>)`, where
storing the value would compare Σ etapów against Σ etapów and could never fire. The widening to
"starts with `=`" appears first in the implementation spec of the same plan, with no argument behind
it. The `=N{row}` shape (pomiar copied from Przedmiar) was folded in by analogy — and `=N{row}`
against Σ etapów is a real comparison, not a tautology.

**The blind spot was found within two days of shipping and accepted rather than fixed.** It is
recorded verbatim in `context/reference/kosztorys-sheet/formula-anomalies.md`, and it is the direct
cause of a dogfooding gap of 16 677,70 zł on investment 31 that was diagnosed and left standing.

**The change is cheap and contained.** `sheetMeasuredQty` has exactly one logic reader; no money
figure moves. The repo already owns the predicate the new rule needs. Two existing specs encode the
old rule with an `=N5` fixture and must be rewritten red-first, not supplemented.

## Detailed Findings

### The read path

`readMeasuredQty` — `src/lib/kosztorys/sheet-import/parse-labor-tab.ts:63-80`:

```ts
if (typeof formulaRow[column] === 'string' && formulaRow[column].startsWith('=')) return null
```

Any `=` at all, whatever the formula does. Sole caller `parse-labor-tab.ts:155`; `formulas` is the
third required positional param of `parseLaborTab` (`:82-88`) and nothing else in that file reads it.

Three production callers of `parseLaborTab`, all passing `grids.laborGridFormulas`:
`build-import-plan.ts:129`, `build-sheet-comparison.ts:186`, `build-measured-qty-refresh.ts:56`.

**Grid alignment** (`read-sheet.ts:79-110`): both renders use the same titles and the same
`'<tab>'!A:BZ` range in one `Promise.all`, so index `[row][col]` is the same cell in both — _when
present_. Google trims trailing empties per response independently, so the two grids are ragged and
may differ in length; every consumer already guards with `formulas[rowIndex] ?? []`. Out-of-range
reads yield `undefined`, which today falls through to "not a formula". That is why a new predicate
must keep the same defensive shape rather than assume a rectangular grid.

**Stage columns** come from `resolveLaborColumns` → `findStages` (`resolve-columns.ts:88-97`):
`{ firstColumn, count }`, the contiguous run of „wykonano" markers in the 3-row header block. They
are NOT fixed at `D:M` — `PRZEDPOLE_ROWS` is a live narrow layout with etapy `D–I`.
`columnLetter` (`src/lib/google/sheet-configs.ts:88-98`) converts an index to a letter and is already
imported by four sheet-import modules.

### The predicate already exists — twice, in two different strengths

1. **`referencesColumn`** — `src/lib/kosztorys/sheet-import/resolve-rates.ts:102-110`:

```ts
const referencesColumn = (column: number) => {
  const pattern = new RegExp(`(?<![A-Z])\\$?${columnLetter(column)}\\$?\\d`)
  return (formula: unknown): boolean =>
    typeof formula === 'string' && formula.startsWith('=') && pattern.test(formula.toUpperCase())
}
```

A general "does this formula mention column X anywhere" test, with a negative lookbehind so `R` does
not match inside `AR12`. Used at `resolve-rates.ts:252` and `:275`. **This is the primitive the new
rule wants** — per `primitive-reuse-scan`, lift it to a shared home rather than write a second one.

2. **`ownRowReference`** — `formula-health.ts:45-56`: matches only a whole-formula bare single-cell
   reference to the formula's OWN row (`=N5`, `=$N$5` on row 5). Deliberately narrow; cannot see
   `=SUM(D5:M5)`. Wrong strength for this change, but it is the function that already **classifies
   the `=N{row}` shape today** as `measuredCopiedFromPlanned` (`formula-health.ts:118-123`) — the
   repo has been counting these rows in a report while refusing to import them.

`formula-health.ts:71-73` already builds `stageLetters = new Set(columnLetter(stages.firstColumn + i))`
— the exact set the new predicate needs.

### Consumers of `sheetMeasuredQty` — no money path

Exhaustive reader set: `measureDiscrepancy` (`settlement-rows.ts:119`) is the **only** logic reader;
the rest is plumbing — parse (`parse-labor-tab.ts:155`), DB read (`kosztorys-tree.ts:144`), DB write
(`kosztorys-sheet-measured-qty.ts:23`), insert (`insert-rows.ts:123`), new-row default `null`
(`row-ops.ts:48`), preset serialize forced `null` (`serialize-preset.ts:17`), and the comparison
counter (`build-sheet-comparison.ts:234`, which reads the _parsed sheet row_, not the stored one).

`measureDiscrepancy` has three callers: the „Rozjazd" column
(`kosztorys-v2-columns.tsx:374`), sorting (`sort-value.ts:108`), the row condition
(`row-conditions.ts:273`). None is a total, footer, snapshot figure, reconciliation figure, or an
investments-listing figure. `diffRow`'s `ITEM_FIELDS` (`v2-rows.ts:6-18`) omits it, so it is not
editable. **Verdict: it feeds only the diagnostic, the „Rozjazd" column and its sort.**

Footer totals deliberately bypass the field — `footer-totals.ts:125-140` prices the Pomiar column
straight off the grid _because_ the stored figure is null on formula cells. That comment becomes
stale once the rule narrows, but the code stays correct (it never trusted the field).

The client/investor view is triple-gated away from it: `divergenceFilterEngaged` requires `!preview`
(`use-kosztorys-editor.ts:401`), column assembly requires `!opts.previewVisible`
(`kosztorys-v2-columns.tsx:368-379`), and `'divergence'` is absent from `PREVIEW_VISIBLE_COLUMNS`
(`column-config.ts:163-195`).

### Effects at scale (~750 rows gaining a value across ~20 investments)

- **`conditionCounts` is the real cost.** `use-kosztorys-editor.ts:360-365` runs `countMatching` over
  every row for every registry entry, memo keyed on `[preview, rows, stages, hasSettledMaterial]`, so
  it re-runs on every edit. Today `measure-diverged` short-circuits at `sheetQty == null`
  (`settlement-rows.ts:120`) on nearly every row; afterwards each such row costs `rowTotalQtyDone`
  (O(stages)) plus two `netForQtyForView` calls. This runs whether or not the filter is engaged.
- **The red „Problemy" button appears** on investments where it is absent today
  (`problems-menu-model.ts:43` filters to `count > 0`).
- **The row latch grows** — `use-condition-row-latch.ts:27-42` accumulates every row shown while the
  problem is engaged and never shrinks until the engaged set changes.
- Column render is `WeakMap`-memoised per row and the grid virtualizes (`kosztorys-v2-columns.tsx:328-338`) — low risk.
- Snapshot growth: ~750 numbers instead of nulls — negligible. Presets unaffected.

### Backfill path

„Zaciągnij pomiary z arkusza" is not a separate button — it rides on opening „Porównaj z arkuszem…"
(`sheet-compare-action.tsx:60-71` → `compareWithSheet`, `kosztorys-import.ts:170-251`):
`buildMeasuredQtyRefresh` (`:220`) → `setSheetMeasuredQty` (`:223`) → re-read tree when
`written > 0` (`:229`). The refresh emits only rows whose stored value differs
(`build-measured-qty-refresh.ts:27-30`), and guards the unresolved-column case so it can never wipe
the lot (`:49-53`). `onTreeReplaced?.()` fires only when something moved
(`sheet-compare-action.tsx:42-43`) — i.e. a grid remount. **No re-import of the rozpiska is needed.**

### Test coverage and what breaks

Two specs encode the OLD rule with an `=N5` fixture and MUST go red:

1. `src/__tests__/lib/kosztorys/sheet-import/build-sheet-comparison.test.ts:239-248` — asserts
   `referenceQty { matched: 3, withValue: 2 }`; becomes `withValue: 3`. Its comment („a copied offer,
   not a measurement") states the reversed semantics.
2. `src/__tests__/lib/actions/kosztorys-compare-with-sheet.test.ts:135-152` — **DB-backed**; asserts
   `refresh { updated: 2, cleared: 1 }` and a `null` on praca #1; becomes `updated: 3, cleared: 0`
   with the value `1`. Follow-on tests at `:154-209` read the state this one leaves behind, so their
   expectations need re-checking.

Survives: `parse-labor-tab.test.ts:151-163`, whose fixture is `=SUM(D3:M3)` — a stage reference —
**provided the new predicate is "mentions a stage column", not "own-row stage reference"**. Its
fixture writes the same row-3 formula into every row, so an own-row rule would break it.

Discovery: `scripts/test-integration.sh:41-44` picks up any spec containing `describe.skipIf(!ENV_READY)`;
only the compare-with-sheet spec above is DB-backed. `.husky/pre-push:47-61` runs typecheck → unit →
integration → parity, so both failing specs fire on every push. No Playwright spec touches the import
or compare dialogs at all.

Fixtures to reuse: `src/__tests__/fixtures/kosztorys-sheet/grid.ts` (`row({ O: '=SUM(D5:M5)' })`),
`rows.ts` (`BIALOSTOCKA_ROWS` etapy `D–M` / Przedmiar `N` / Pomiar `O`; `PRZEDPOLE_ROWS` etapy `D–I` /
Przedmiar `J` / Pomiar `K`). **`PRZEDPOLE_ROWS` is the fixture that catches a hardcoded `D:M`.**

### Live-sheet evidence (scanned 2026-08-20, all 56 linked spreadsheets)

- `=SUM(<stage columns>)` in the Pomiar cell: **2 rows in the entire base** (one investment).
- `=N{row}` / `=J{row}` — pomiar mirrors Przedmiar: **267–448 rows per sheet**, all discarded today.
- Other independent formulas (`=2,5+3`, `=1,2*4`): 3 rows base-wide.
- Rozjazd that would surface, Pomiar ≠ 0: **524 pozycje across 16 readable sheets**, plus ~240 on 7
  sheets that hit the Google daily read quota mid-scan — order of **750 across ~20 investments**;
  9 investments stay clean. **480 of the 524 have NOTHING in the stages** — whole pozycja never
  transcribed, not a partial gap.
- Pomiar = 0 while the stages are not: **3 rows base-wide**, so filtering on „pomiar ≠ 0" changes nothing.
- Out of scope but found: **23 of 56 sheets fail `resolveLaborColumns` outright** — 12 on the missing
  section column, 10 on „Wartość netto", 1 on „Przedmiar".

## Code References

- `src/lib/kosztorys/sheet-import/parse-labor-tab.ts:63-80` — `readMeasuredQty`, the rule to narrow
- `src/lib/kosztorys/sheet-import/resolve-rates.ts:102-110` — `referencesColumn`, the primitive to reuse
- `src/lib/kosztorys/sheet-import/formula-health.ts:45-56,71-73,118-123` — `ownRowReference`, `stageLetters`, the `=N{row}` classifier
- `src/lib/kosztorys/sheet-import/resolve-columns.ts:88-97` — `findStages`
- `src/lib/google/sheet-configs.ts:88-98` — `columnLetter`
- `src/lib/kosztorys/settlement-rows.ts:115-132` — `measureDiscrepancy`, `QTY_TOLERANCE = 0.005` at `:91`
- `src/lib/kosztorys/row-conditions.ts:264-274` — the „z pomiarem do rozpisania na etapy" entry
- `src/lib/kosztorys/sheet-import/footer-totals.ts:125-140` — the comment that goes stale
- `src/lib/actions/kosztorys-import.ts:170-251` — `compareWithSheet`, the backfill path
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:360-365` — `conditionCounts`, the per-edit pass

## Architecture Insights

- **The formula grid is evidence, not decoration.** `read-sheet.ts:96-100` fetches a second render
  purely so the parser can tell a typed number from a computed one. The change does not add a data
  source; it changes one predicate over a source that is already there.
- **Two strengths of formula matching already coexist** — a strict own-row single-cell parser for the
  health _report_, and a loose mentions-column matcher for rate _resolution_. Picking the loose one
  for the import keeps the existing `=SUM(D3:M3)` fixture honest and avoids a third parser.
- **`referenceQty` in the comparison result is dead** — computed at `build-sheet-comparison.ts:308`,
  asserted by one test, rendered nowhere. A cleanup candidate, not part of this change.

## Historical Context (from prior changes)

- `context/archive/2026-08-13-pomiar-bez-etapu/plan.md` (recoverable at `git show 5cc3173b:…`),
  Assumptions §2: „Cała wartość funkcji stoi na tym, że `=SUM(D:M)` znaczy „nie ma tu ręcznego
  pomiaru"." The only residual risk contemplated is a _mixed_ sheet — never a formula that is not
  `=SUM`. Yet §1c of the same plan specifies „albo formuła zaczyna się od `=`". **That is where the
  ruling and the code part ways.**
- Commit `5cc3173b` (2026-08-13, EX-686): „tylko formuła dowodzi, że „Pomiar z natury" NIE został
  wpisany ręcznie" — the broad claim stated as proven.
- `context/archive/2026-08-13-pomiar-bez-etapu/change.md:20-26` — the evidence table measured ONE
  column, „Pomiar jako formuła `=SUM(D:M)`", scoring investment 31 at `0/245`. That same investment
  in fact carries 241/336 rows of `=N{row}`. **The survey's instrument could not see the second
  shape** — cf. `feedback_validate_the_instrument_before_trusting_a_negative`.
- `context/reference/kosztorys-sheet/formula-anomalies.md` (2026-08-13), anomaly 2: „…te 241 wierszy
  nie dostaje liczby odniesienia i **kolumna „Rozjazd" jest na nich strukturalnie ślepa**. Na 26
  z nich (16 677 zł) arkusz liczy pracę jako wykonaną, choć etapy są puste albo niepełne."
- `context/archive/2026-08-13-sheet-live-compare/change.md:25-29` — the dogfooding gap: sheet
  508 196 zł vs app 491 519,25 zł, „różnica 16 677,70 zł siedzi w 26 pozycjach … **zero rozjazdów nie
  dowodzi zgodności**". The response was to build the formula-health _report_, not to import them.
- `context/reference/kosztorys-editor-domain-notes.md:740-745` — „**Odrzucenie `=N#` … idzie tą samą
  regułą, ale nie po cichu**." The only place `=N#` is folded in, and it is folded in by analogy.
- `context/reference/kosztorys-editor-domain-notes.md:109-118` (owner, 2026-08-15) — `=N{row}` is
  „**stan normalny, nie awaria arkusza i nie błąd odczytu**". The owner ruled that it is not a sheet
  defect; the conclusion „nie ma czego zapisać jako pomiar" was the agent's inference appended to it.
- `context/archive/2026-07-15-kosztorys-stages-source-of-truth/` (EX-489/EX-494) — pomiar IS Σ etapów;
  `measured_qty` dropped by `src/migrations/20260716_0_drop_kosztorys_measured_qty.ts`. **This change
  does not reverse it**: the stored figure computes nothing, it is only the sheet's claim held for
  comparison (domain notes:729-735).

**This change is an explicit reversal of the 2026-08-15 inference, on a fresh owner ruling
(2026-08-20): a cell the owner filled IS a pomiar whatever produced the number.** Recorded here so
nobody later "restores the rule" by deleting it — cf. `lessons.md:315`.

## Applicable lessons

- `lessons.md:350` — „A test that guards the OLD definition goes tautological when the definition
  changes." The two `=N5` specs get **rewritten red-first**, not supplemented.
- `lessons.md:301` — „The owner picks a formula on what the number MEANS." The narrowing is argued
  from meaning (a mirror of Przedmiar is a claim; Σ etapów is not), not from symmetry.
- `lessons.md:12` — sheet column positions are a frozen external contract: the predicate must be
  built from the resolved stage run, never from a literal `D:M`.

## Open Questions

1. **Whole-column ranges.** Both the code comment (`parse-labor-tab.ts:64`) and the domain notes
   spell the tautological shape `=SUM(D:M)` — with no row digits. `referencesColumn` requires
   `\$?LETTER\$?\d`, so lifted verbatim it would MISS `=SUM(D:M)` and store Σ etapów as the pomiar.
   Harmless in outcome (the diagnostic then compares equals and never fires) but it stores a
   redundant figure. The predicate should accept `D:` as well as `D5`. The live scan found only 2
   stage-sum rows base-wide, so this is correctness-of-rule, not scale.
2. **Should the backfill be driven for all ~20 investments, or left to the owner per investment?**
   The path exists and is one dialog open per investment; nothing forces a sweep.
3. **`referenceQty` is dead** — remove in this change or file it separately?
4. ~~Out of scope: 23 of 56 sheets cannot be imported at all.~~ **Closed by the owner (2026-08-20):
   both failures are self-service.** The missing section column is repaired in the sheet by inserting
   one empty column to the left of the etapy run (the fix already applied to investment 115 — the
   resolver wants opis, then the ordinal, then the section name, `resolve-columns.ts:196-197`), and
   „Wartość netto" is pointed at with the column picker, which `SheetProblemsBlock` already renders on
   a REFUSED read (`sheet-problems-block.tsx:36-48`) — a required field left unresolved is exactly
   what it offers. No change is owed here.
