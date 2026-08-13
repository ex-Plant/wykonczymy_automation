---
date: 2026-08-13T15:57:12+0200
researcher: Claude
git_commit: 81d2a569d0452dabe8f6cdc82fa593a46dd733d3
branch: pomiar-bez-etapu
repository: wykonczymy
topic: 'Porównanie z arkuszem na żywo zamiast raportu z importu'
tags: [research, codebase, kosztorys, sheet-import, divergence, google-sheets]
status: complete
last_updated: 2026-08-13
last_updated_by: Claude
---

# Research: Porównanie z arkuszem na żywo zamiast raportu z importu

**Date**: 2026-08-13T15:57:12+0200
**Researcher**: Claude
**Git Commit**: 81d2a569d0452dabe8f6cdc82fa593a46dd733d3
**Branch**: pomiar-bez-etapu
**Repository**: wykonczymy

## Research Question

Can the app show, on demand, a live comparison against the owner's sheet — both sides' totals plus the
health of the sheet's own formulas — instead of a one-shot report that only exists during an import?
And can a second, non-destructive action refresh the stored reference quantities without the full
wipe-and-reinsert import?

## Summary

**Yes, and the pieces are almost all already built.** Nothing in the read path blocks it: the sheet is
already read live on demand, with **formulas fetched alongside values in the same call**, under a
`spreadsheets.readonly` credential that physically cannot write. What is missing is small and specific:

1. **A diff.** `buildImportPlan` returns a _merged tree_, not a comparison. The one place that knows
   "matched / new / retained" — `matchedCurrentIds` — is a local variable, and the keying helpers
   `itemKey` / `keyItems` are module-private (`build-import-plan.ts:49,65,181`). They must be exported,
   never reimplemented; the occurrence-indexed key is subtle and a second copy will drift.
2. **A join to live DB ids.** `currentByKey` (`build-import-plan.ts:177-180`) already holds the real
   `kosztorys_items.id` under the same key. That is exactly the join „zaciągnij pomiary z arkusza"
   needs to write onto existing rows without renumbering anything — it simply is never used for a write today.
3. **A formula-health pass.** The formula grids are fetched (`read-sheet.ts:69-78`) and then **thrown
   away** once the plan is built. Nothing in `ImportPlanT` carries a formula string. The scan method is
   already specified in prose in `context/reference/kosztorys-sheet/formula-anomalies.md:88-97`.
4. **A read-only refusal to bypass.** `buildImportPlan` returns `{ok:false}` when zero rate tabs parse
   (`build-import-plan.ts:142-150`). That refusal exists purely to stop 0 zł being written — on an
   inspector it would blank the whole comparison on a sheet whose cennik is broken.

**Framing that must be stated explicitly, or a later reader will misread this as re-opening a closed
decision:** bidirectional sheet↔app sync is a parked non-goal (`roadmap.md` § Parked, `prd.md:298-299`),
and the importer (S-15) is the named exception — _read only, on demand, per investment, never writing
back_. This change lands **inside** that exception. Likewise, the „Rozjazd" column is not being replaced:
`change.md:32` reframes the stored figure from „a photo taken on import day" into „a refreshable cache",
which **refines** the EX-686 decision rather than reversing it.

## Detailed Findings

### The read path — nothing blocks a live re-read

`readImportGrids(sheets, spreadsheetId)` (`src/lib/kosztorys/sheet-import/read-sheet.ts:43`) is the single
live-read entry point for kosztorys, and it is unusually well-shaped for reuse:

- It **takes the client as a parameter** rather than constructing one (`read-sheet.ts:39-46`), so the module
  carries no `server-only` and is already called from a standalone script
  (`src/scripts/check-column-resolution.ts:25-51`) — a working precedent for read-only, out-of-flow use.
- Credential is `spreadsheets.readonly` (`src/lib/google/readonly-sheets-client.ts:6-9`). A bug on this path
  cannot write a cell — which is why the frozen-column lesson (`lessons.md:12-17`, scoped to _written_ tabs)
  does not bind this change.
- Cost is **1 × `spreadsheets.get`** (tab-title discovery — titles carry trailing spaces, `read-sheet.ts:47-49`)
  **+ 2 × `values.batchGet`** run in `Promise.all`, one `UNFORMATTED_VALUE` and one `FORMULA`
  (`read-sheet.ts:69-78`). This is the only batched read in the codebase.
- Rationale for the double fetch, verbatim (`read-sheet.ts:73-77`): _"a formula is the only evidence that a
  figure was NOT typed by a human."_

**No caching, no retry, no backoff anywhere** in `src/lib/google/**` or the import path. Preview + apply
today therefore costs 6 Google calls plus 2 full tree reads. Latency is proven acceptable for a single
investment (the 429 seen during the 45-sheet analysis was a bulk-scan artefact, `importer plan.md:492-494`),
but an on-demand comparison button multiplies this linearly and deserves either an explicit cache or a
deliberate "one read per click" contract.

Sheet id resolution: `getInvestmentSheetId(payload, investmentId)` (`src/lib/google/sheet-lookup.ts:11-23`)
reads `kosztoryses.googleSheetId`; the relation is nullable, so „brak arkusza" is a real, first-class case
(`kosztorys-import.ts:35`, `MISSING_SHEET = 'Inwestycja nie ma kosztorysu.'`).

### What the import plan gives — and the four things it doesn't

`buildImportPlan(grids, currentTree): ImportPlanT` (`build-import-plan.ts:86`) is pure, synchronous, no I/O.
`ImportReportT` (`:29-40`) already carries `columns`, `counts`, `rateDecisions`, `retained`, `totals`, `warnings`.

`FooterComparisonT` (`src/lib/kosztorys/sheet-import/footer-totals.ts:9-22`) is literally a sheet-vs-app row —
`{ label, sheetValue, appValue, delta, matches, matchedAgainst }` — and is the **closest existing "both sides'
totals" record in the codebase**. Its docblock (`:41-50`) states why the app side goes through `calc.ts`
rather than a local sum: _"a reimplementation would agree with the parser's mistakes."_ Tolerance `0.005`
(`:25`); each footer row is checked against **both** app figures via `matchedAgainst` (`:17-21`) because the
owner's labels don't reliably say which figure a row holds; a disagreement is reported, never thrown.

What it does **not** give:

| Missing                            | Where the gap is                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| A diff (new / matched / changed)   | `matchedCurrentIds` `:181`, `:204` never leaves the function; only `retained` escapes                       |
| Live DB item ids                   | `currentByKey` `:177-180` holds them; the emitted tree renumbers everything (`nextItemId++`, `:208`/`:259`) |
| Any formula string                 | grids are dropped after the plan is built                                                                   |
| A result at all on a broken cennik | zero readable rate tabs ⇒ `{ok:false}` `:142-150`                                                           |

### Row identity — the machinery to reuse, and how fragile it is

There is **no stable key**. Identity is reconstructed from content on every import:

```ts
// build-import-plan.ts:49-50
const itemKey = (section, description, occurrence) =>
  `${fold(section)}|${fold(description)}#${occurrence}`
```

`fold` (`columns.ts:29-36`) absorbs case, Polish diacritics and whitespace runs — nothing else. Consequences
a comparison UI must survive:

- **Any description or section rename breaks the match** and produces a retained duplicate plus a fresh row.
- **Occurrence is positional** within (section, description). Reordering two identically-named prace silently
  swaps which DB row each maps to — no error, no warning.
- **Ids never survive an import** (`restore-kosztorys.ts:22-25`, `insert-kosztorys-tree.ts:58+`), so the
  comparison must key on section+description+occurrence, not on item id.

`keyItems` (`:65-79`) already keys objects that carry their real `id`, so `currentByKey.get(key)?.id` is the
join a write needs. Rows failing to match on either side are the „nie znalazłem w arkuszu / nie znalazłem
w aplikacji" report, mirroring `retained`.

### The stored reference figure — and why it is stored

`sheetMeasuredQty` (`src/collections/kosztorys-items.ts:40`, column `sheet_measured_qty` numeric, migration
`20260813_0_add_sheet_measured_qty_to_kosztorys_items.ts`) is deliberately **absent from `ItemPatchT`**
(`types.ts:57-72`) and from `itemPatchSchema` — read-only _by type_, so no future patch can quietly write one.
Its only mutation today is `clearSheetMeasuredQtyAction` (`src/lib/actions/kosztorys.ts:120-145`).

Three separate rulings explain why the sheet's claim is stored while the comparison is derived live
(`pomiar-bez-etapu/change.md:43-59`, `plan-brief.md:20-24`):

1. The figure must survive without the sheet and act as a working list that **shrinks by itself** as the owner
   fills etapy — _„ta lista powinna być dynamiczna, żeby nie krzyczała o rozjeździe, którego już nie ma"_.
2. The „two truths" objection (EX-494) doesn't apply because the stored number **computes nothing**.
3. **A formula means no reference.** On the canonical sheet Pomiar is `=SUM(D:M)` in 435/435 rows; storing its
   result would compare Σ etapów with Σ etapów.

`readMeasuredQty` (`parse-robocizna.ts:60-77`, unexported, one call site at `:149`) implements rule 3 as a flat
`startsWith('=')` test — **and that is precisely the blind spot this change exists to address**: on investment
31, `O = =N#` on 241/336 rows is refused by the same rule that correctly refuses `=SUM(D:M)`, even though it is
a copied offer, not a stage sum.

`null` in that column collapses four meanings: no such column, empty cell, a formula, or the owner's deliberate
dismissal via „etapy są prawdą" (`types.ts:43-45`). **A naive „baza pusta, arkusz ma liczbę" flag will
false-fire on dismissals.** The precedent for what to do already exists and is deliberate: a re-import
**overwrites** a dismissed row (`build-import-plan.ts:218-222`, pinned by `build-import-plan.test.ts:171-179`) —
so a refresh action following that same rule is consistent, not a new decision.

### The derivation the UI already renders

`measureDiscrepancy` (`src/lib/kosztorys/settlement-rows.ts:84-130`) → `{ sheetQty, stageQty, qtyDiff, net }`.
`QTY_TOLERANCE = 0.005` (`:88`) against float noise. `stageQty` is hard-coded to the **client** plane (`:119`,
rationale `:107-110`) because the sheet's pomiar has no plane. The money figure is the gap between **two whole-row
values**, never `qtyDiff` priced on its own (`:123-127`) — pricing the difference directly would subtract a
kwotowy rabat from a partial quantity and invert its sign on small differences.

`divergedRows` (`src/lib/kosztorys/row-view.ts:18-23`) is one function for both the badge and the filter, _"so
the number can never promise rows the filter then declines to show."_ Surfaces: `divergenceColumn` /
`DivergenceCell` (`grid/cells/divergence-cell.tsx:21,52`), the `divergedCount` counter
(`use-kosztorys-editor.ts:337-345`, counted over the whole dataset, not `viewRows`), the toolbar toggle
(`kosztorys-editor-toolbar.tsx:49-63`, absent rather than disabled at zero), the empty state
(`kosztorys-editor-body.tsx:255-274`), and the row action „Etapy są prawdą"
(`grid/menus/kosztorys-row-actions-menu.tsx:120-128`).

**So the app already has a static, last-import sheet-vs-etapy plane. „Porównaj z arkuszem" is its live twin.**

### Where the result view goes

Three candidate homes, in ascending cost:

**A — a new dialog beside „Pobierz z arkusza Google…"** (`toolbar/menus/kosztorys-actions-menu.tsx:156`).
Exact precedent exists in `handleOpenImport` (`:91-105`), including the documented Radix workaround: a
programmatically-opened dialog never fires `onOpenChange`, so **the parent fetches on the click** and passes
`preview` + `loaded` as props (`:89-90`). Dialogs must be siblings of `DropdownMenu`, not children — the menu
unmounts on close (`kosztorys-add-menu.tsx:27-29`, `kosztorys-actions-menu.tsx:48-49`). `SheetImportDialog` is
already ~80% of a comparison report and its decision logic is extracted into the pure `evaluateImportGate`
(`dialogs/sheet-import-gate.ts:16`). Cost: `DialogContent` maxes at `min(90vw,600px)` (`ui/dialog.tsx:55`), so
a wide table needs `sm:max-w-4xl` plus the edge-to-edge `p-0` + inner-scroll layout from
`add-sections-from-preset-dialog.tsx:111,122`. A modal also blocks the grid while reading.

**B — a sixth tab in the totals panel** (`summary/summary-panel-content.tsx:39-45`). Non-modal, and it is where
the _other_ two-plane reconciliation already lives. But every existing tab is **pure and prop-fed** — the panel
does zero fetching — and it is shared with the read-only client share view, so a new tab needs a visibility gate.
Biggest architectural change of the three.

**C — fold it into the „Rozjazdy" plane**: a toolbar action that refreshes `sheetMeasuredQty` in place. No new
result view at all, and the outcome is actionable on the row that needs editing. But it is a **write**, and it
has nowhere to put the sheet-level facts (columns, warnings, footer totals).

A and C are not rivals — they are the two halves the owner asked for. The natural split: **C is „zaciągnij
pomiary z arkusza", A is „Porównaj z arkuszem".**

Rendering caveat: nothing in `SheetImportDialog` is reusable today — warnings, the columns table, counts, rate
decisions, retained rows and the footer comparison are all inline JSX, and `Block` (`:180-187`) is file-local
and unexported. Sharing the report vocabulary between two dialogs is a real extraction, not an import.

### Where the server read belongs

`AGENTS.md:173-178`: an on-demand read a client component invokes is a `'use server'` function in
`src/lib/queries`, never in `src/lib/actions`. Reality check: **`register-saldo.ts` is the only surviving
example** — `subcontractor-roster.ts`, also cited there, no longer exists. Its convention: `perfStart()` first,
`Promise.all([requireAuth(MANAGEMENT_ROLES), getPayload()])`, **throw** on missing user, return a plain typed
object rather than `ActionResultT`. Client side, `use-saldo.ts:5-37` holds `value | null` + `isLoading` and uses
a monotonic `requestRef` to disown superseded responses.

Counter-precedent: `previewKosztorysImport` is a pure read that lives in `src/lib/actions` and returns
`ActionResultT` — which is the shape every editor dialog's error handling is already written against. This is a
genuine plan-time decision, not an oversight to inherit silently.

### The security rule both live-read features already follow

Stated twice, independently, in near-identical words:

- `kosztorys-import.ts:81-82` — _"Takes no plan from the client: it re-reads the sheet and rebuilds, so a forged
  preview payload cannot decide what gets written."_
- `sheets-sync.ts:234-237` — _"Re-derives what to append SERVER-SIDE — never trusts a client-supplied row set…
  an attacker round-tripping a forged toAppend would otherwise land in the sheet verbatim."_

Both apply actions take **only `investmentId`**. „Zaciągnij pomiary z arkusza" must do the same: re-read, re-derive,
write — never accept the comparison the browser is holding.

### Formula health — the spec already exists in prose

`context/reference/kosztorys-sheet/formula-anomalies.md` enumerates investment 31's four anomaly classes with
counts and states the importer conclusions (`:76-86`):

- `N = =M#` (Przedmiar read from an etap column, 7 rows) — explicitly _„kandydat na ostrzeżenie w podglądzie importu"_.
- `O = =N#` (241/336) vs `O = =SUM(D:M)` are **different cases treated identically today**, and `:80-84` leaves
  the ruling open — showing `=N` as a rozjazd would turn that column into a list of work not yet done, which is
  „Pozostało"'s job. **This is the one unresolved design question the plan must answer.**
- `S` and `AE` are unbroken on this sheet; the scan is worth repeating on every new client sheet.

The scan method (normalize own-row number → `#`, other numbers → `n`, majority bucket = the norm) is at `:88-97`
and is directly implementable against the already-fetched formula grids.

Two additions worth folding in:

- `#REF!` / `#DIV/0!` arrive from `UNFORMATTED_VALUE` as strings and are silently coerced to `0` by `number()`
  (`parse-robocizna.ts:41`) — a real, currently invisible failure mode.
- Column-level `ARRAYFORMULA` detection was already **dropped** in EX-686 (`review-gate.md:74-77`) because it
  _„zaszkodziłoby arkuszom mieszanym (część wierszy wpisana ręcznie w kolumnie z formułą) — czyli dokładnie temu,
  po co ta figura powstała."_ Per-cell classification is fine; per-column is a closed question.

## Code References

- `src/lib/kosztorys/sheet-import/read-sheet.ts:43` — `readImportGrids`, the only live-read entry point; values + formulas in one pass
- `src/lib/kosztorys/sheet-import/build-import-plan.ts:49,65` — `itemKey` / `keyItems`, module-private; export rather than reimplement
- `src/lib/kosztorys/sheet-import/build-import-plan.ts:177-180` — `currentByKey`, the map holding live DB item ids under the match key
- `src/lib/kosztorys/sheet-import/build-import-plan.ts:142-150` — the zero-rate-tabs refusal an inspector must bypass
- `src/lib/kosztorys/sheet-import/build-import-plan.ts:218-222` — the deliberate overwrite of a dismissed reference figure
- `src/lib/kosztorys/sheet-import/parse-robocizna.ts:60-77` — `readMeasuredQty`, the `startsWith('=')` rule that makes Rozjazd blind on `=N#`
- `src/lib/kosztorys/sheet-import/footer-totals.ts:9-22,41-50` — `FooterComparisonT`, the existing both-sides-totals record
- `src/lib/kosztorys/settlement-rows.ts:84-130` — `measureDiscrepancy`, the live derivation
- `src/lib/kosztorys/row-view.ts:18-23` — `divergedRows`, one source for badge and filter
- `src/lib/actions/kosztorys.ts:120-145` — `clearSheetMeasuredQtyAction`, the action shape a refresh should mirror
- `src/lib/actions/kosztorys-import.ts:28-33,48-66,81-119` — shared derivation, read-only preview, never-trust-the-payload apply
- `src/lib/actions/sheets-sync.ts:197-232,234-237` — `buildSyncPlan` + the same server-re-derive rule, stated independently
- `src/lib/queries/register-saldo.ts` — the only surviving `'use server'` on-demand read
- `src/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.tsx:91-105,156-162,182-217` — fetch-on-click, the menu item's neighbours, the dialog stack
- `src/components/kosztorys/editor/dialogs/sheet-import-dialog.tsx:69-161` — the report rendering to extract; `Block` at `:180-187` is file-local
- `src/components/kosztorys/editor/grid/cells/divergence-cell.tsx:21,52` — the existing per-row comparison cell
- `context/reference/kosztorys-sheet/formula-anomalies.md:76-97` — the anomaly classes and the scan method

## Architecture Insights

- **Preview and apply share one derivation, and apply never trusts the preview.** Stated in both live-sheet
  features in near-identical words. Any new pair must follow it.
- **`null` is a meaning, not an absence.** `sheet_measured_qty` has no default and no backfill _on purpose_
  (migration comment `:3-7`), and `numOrNull` rather than `num` on read (`db/kosztorys-tree.ts:142-143`). A
  comparison that treats null as zero re-introduces exactly the bug the column was shaped to avoid.
- **A count and its filter must come from one function**, or the badge promises rows the filter won't show
  (`row-view.ts:16-17`). The same discipline applies to whatever counter a comparison view exposes.
- **The comparison is derived, the sheet's claim is stored.** That split is the load-bearing decision of EX-686;
  this change moves the stored half from "snapshot" to "refreshable cache" without touching the split itself.
- **Naming collision:** `buildKosztorysReconciliation` (`src/lib/kosztorys/reconciliation.ts`) already means
  _kosztorys vs transactions_. Do not reuse „reconciliation" for the sheet comparison.

## Historical Context (from prior changes)

- `context/changes/2026-08-11-kosztorys-importer/plan.md:88-105` — explicitly rejected: writing to the sheet;
  a manual column mapper; scanning all 45 sheets; the exception-override file. And _"not reading Pomiar z natury"_ —
  since narrowly reversed by `pomiar-bez-etapu`, for hand-typed cells only.
- `context/changes/2026-08-11-kosztorys-importer/review-gate.md:187-190` — S-15 is **blocked from archive** on
  unrun manual checks; EX-671 (`e2e-backlog`) covers the browser path.
- `context/changes/2026-08-13-pomiar-bez-etapu/change.md:61-71` — rejected: a synthetic „Pomiar bez etapu" stage;
  restoring „Pomiar z natury" as a computing field; attaching the difference to the last non-empty etap; blocking
  the import until the sheet is fixed.
- `context/reference/kosztorys-sync.md:64-67` — **outbox, Sheets→app webhook and a cron reconciler were all
  rejected**: _"the manual Synchronizuj button covers the same gap with no extra schema, and sheets are low-traffic."_
  That reasoning applies verbatim here; an on-demand button is the house pattern.
- `context/foundation/lessons.md:12-17` — frozen sheet columns, scoped to _written_ tabs; does not bind a
  readonly path. `:314-328` — the sheet is the authority on what a figure _means_, not a spec for what to build;
  check whether a cell is _read_ by a formula before calling it a live figure.
- `context/foundation/lessons.md:1027-1046` — a guard on real data is blind if the real data predates the feature.
  Live now: the parity dataset carries **zero reference quantities**, so divergence is 0 rows by construction there.

## Related Research

- `context/changes/2026-08-13-pomiar-bez-etapu/research.md` — the divergence model and the wipe-and-reinsert analysis
- `context/changes/2026-08-11-kosztorys-importer/plan.md` — the import pipeline's own design of record

## Open Questions

1. ~~**Is `O = =N#` a rozjazd or not?**~~ **RESOLVED (owner, 2026-08-13): no.** Filling the stage columns to
   match makes the difference zero, so such a row is _work not yet done_, not two conflicting claims — and on
   inv. 31, 25 of those 26 rows have no stage quantities at all. That list already exists as „Pozostało"
   (honest since the brak-Przedmiaru fix). The rule: a **hand-typed** Pomiar that disagrees with Σ etapów is a
   rozjazd; a Pomiar copied from Przedmiar belongs in the comparison's **formula-health** section as a
   statement about the sheet — _"na 241 z 336 pozycji Pomiar jest kopią Przedmiaru, więc kolumna Rozjazd nic
   o nich nie powie"_. That sentence is the view's most important output: today zero rozjazdów reads as
   agreement when it actually means _nothing to compare against_.
2. **Does „zaciągnij pomiary z arkusza" preview before writing, or write directly?** The import's overwrite of a
   dismissed row is deliberate precedent for writing directly; the „never trust the payload" rule means a preview
   costs a second full read.
3. **`lib/queries` (throw, plain object) or `lib/actions` (`ActionResultT`)?** The rule says the former; every
   editor dialog's error handling is written against the latter.
4. **Does the comparison need its own cache?** No sheet read is cached anywhere today, and a click-to-read
   contract may be enough.
5. **Roadmap placement** — fold into S-15 as a follow-up (still `ready` / in review, and its `change.md:72-77`
   already anticipates one) or number a new slice adjacent to it. It is _not_ part of S-19's cutover gate.
6. **E2E gap inherited:** unlike S-15, EX-686 has **no `e2e-backlog` issue** (`review-gate.md:124`). A new
   browser-level surface here will owe one.
