# Kosztorys sheet import — Implementation Plan

## Overview

Add a **„Pobierz z arkusza Google…"** action to the kosztorys editor's „Opcje" menu. It reads the
investment's linked Google Sheet, builds a complete kosztorys tree from it, shows a preview of what
would change, and — on confirm — replaces the investment's kosztorys in one transaction behind an
automatic snapshot.

This resolves roadmap slice **S-15** and its long-open trigger question (PRD Q8): the importer is a
per-investment button, not a one-shot migration, so it stays useful after the first pass.

## Current State Analysis

**The write path already exists in the exact shape this needs.** `restoreSnapshotAction`
(`src/lib/actions/kosztorys-snapshots.ts:61`) runs, inside one `withPayloadTransaction`: a forced
`captureAutoSnapshot` → `restoreKosztorys` (wipe → `insertKosztorysTree` → rewrite settings) → a
single post-commit revalidation of five cache tags. Any throw rolls the whole thing back and the
live tree is untouched. Import is that same operation with a different tree source.

**The preview→apply pattern already exists too.** `previewMaterialSync` / `applyMaterialSync`
(`src/lib/actions/sheets-sync.ts:155,238`) share `buildSyncPlan` so the two can never disagree, and
apply re-derives everything server-side — the comment at `:234` states the rule verbatim: _"never
trusts a client-supplied row set."_ Direction is inverted (app→sheet) but the shape transfers.

**The existing header resolver cannot be reused.** `resolveHeaders` (`src/lib/google/sheets.ts:52`)
requires every mapped field on a _single_ row and **throws on any duplicate match** (`:73`). A
kosztorys header is a three-row block with deliberate duplicates (two „Cena jednostkowa" columns on
Ryżowa 66/127). A new resolver is required.

**The existing importer is a blueprint, not a tool.** `src/scripts/seed-investment-from-sheet.ts`
still typechecks and its shapes still match `SnapshotPayloadT`, but its column map is hardcoded
offsets (`:52-68`) valid only for Białostocka, and it reads rates from one tab only — so a row
present only in the other tab imports at 0 zł (verified: 3 such rows on Białostocka, incl. prace
projektowe at 3500 zł). Its `deriveOverride` (`:79`) is the one piece worth lifting verbatim.

**Investigation across all 45 real sheets in the DB (2026-08-11):**

- „Przedmiar" occupies six different columns across sheets (I, J, K, L, M, N).
- Stage counts run 3–10; the first stage column is C, D, or E.
- **Stage headers get renamed to crew names** — „parkieciarze", „Michal Kulas", „kamil", „Andriej".
  So stage columns must be located by **row 2 == „wykonano"**, never by a „N etap ilość" label. This
  works on all 45.
- 43/45 resolve with a synonym dictionary. Two do not and cannot be guessed: **Dąbrowskiego 86**
  (the „Przedmiar" header cell was overwritten with „Przesyłam wstępny kosztorys.") and **Ryżowa
  66/127** (duplicate „Cena jednostkowa" and „Wartość netto" columns, no rabat column at all).
- Rates: with per-row tab selection, Białostocka collapses from 13 disagreements to
  312 agreeing / 3 single-tab / 8 auto-resolved / 1 real conflict.
- Identity by description alone matched **324/324** items on Białostocka.

## Desired End State

An OWNER or ADMIN opens an investment's kosztorys, picks „Pobierz z arkusza Google…" from „Opcje",
and sees a dialog reporting: which columns were recognised in which tab, how many sections / prace /
etapy were read, every rate auto-resolution, every praca present in the app but absent from the
sheet, and a comparison of the app's computed net total against the sheet's own footer total. On
confirm the kosztorys is replaced; a snapshot taken immediately before is restorable from „Wczytaj".

When a required column cannot be resolved, the dialog says which column in which tab and offers no
confirm.

**Verification:** run it against Białostocka (investment 42) on the local DB. 13 sections, 324
prace, 10 etapy land; the footer comparison agrees; the resolution list shows the known 8
auto-resolutions and 1 conflict.

### Key Discoveries

- `restoreKosztorys` (`src/lib/kosztorys/restore-kosztorys.ts:12`) takes any `SnapshotPayloadT` —
  feeding it a sheet-derived tree needs no new write path.
- `restoreKosztorys` **always rewrites** `wToolsCoeff` / `ownToolsCoeff` / `vatRate` from
  `snapshot.settings` (`:28-38`). Import must not change those, so it passes the investment's
  **current** settings through — read from `serializeKosztorys`, not from constants.
- `serializeKosztorys` (`src/lib/kosztorys/serialize-kosztorys.ts`) gives the current tree in exactly
  the shape the merge needs, settings included. One call covers both.
- `protectedAction` gates at `MANAGEMENT_ROLES` (`src/lib/actions/run-action.ts:43`), which includes
  MANAGER. OWNER/ADMIN-only needs an explicit `isAdminOrOwnerRole(user.role)` check in the handler.
- `getInvestmentSheetId` (`src/lib/google/sheet-lookup.ts`) already resolves the link and is
  importable from any context.
- `insertKosztorysTree` skips a child whose parent is absent rather than orphaning it
  (`:71,111`) — the merge must still produce a consistent tree; that tolerance is a backstop, not a
  contract to lean on.
- `sectionColorForIndex` (`src/lib/kosztorys/section-colors.ts`) assigns section colors by position,
  as the existing seeder does.
- Sheet row 1 is „Imię i nazwisko oraz adres inwestycji" — real client PII. The parser never reads
  it, and no test fixture may include it.

## What We're NOT Doing

- **Not writing to the sheet.** Read-only, in every phase.
- **Not importing** settlement mode, materials net rate, global discount, VAT, the global
  coefficients, per-etap tool plane or worker assignment (EX-613), section colors beyond
  position-derived defaults, or notes. None exist in any sheet; they stay hand-entered.
- **Not reading „Pomiar z natury".** It is a formula (`=SUM(D:M)`) and the app derives pomiar as the
  sum of etapy (EX-489). Reading it would import a second, conflicting truth.
- **Not deleting anything.** A praca present in the app but absent from the sheet is retained and
  reported.
- **Not building a manual column mapper.** An unresolvable header is a stop with a message; the fix
  is one cell in the sheet.
- **Not scanning all 45 sheets.** The owner lacks access to them right now; that is a follow-up whose
  output is a list of corrections (see `change.md`).
- **Not building the exception-override file.** Contingency only, and only if the eventual bulk
  rehearsal proves it necessary.
- **Not adding an E2E spec** in this change — see Testing Strategy.

## Implementation Approach

Four pure layers and one thin action layer, in dependency order. Everything that can be a pure
function of sheet grids is one, so it is testable without network or DB:

```
read three tabs (network)
      ↓  unknown[][] grids
resolve columns  ──→ stop with a named column if unresolvable
      ↓  a column map per tab
parse kosztorys_robocizny  →  sections + prace + etapy + wykonano
resolve rates from both „zakres pracy" tabs  →  rates + resolution list
      ↓
build import plan: merge with the current tree, retain vanished prace,
compare totals against the sheet footer
      ↓
preview (display)   |   apply (re-derives the plan, then snapshot + replace in one transaction)
```

The plan builder is the single source both actions call, mirroring `buildSyncPlan`.

## Critical Implementation Details

**Header block, not header row.** Rows 1–3 are the header. Row 2 is what identifies stage columns
(the cell reads „wykonano"); row 3 carries the field labels for everything else. A resolver that
scans for one row containing all fields will never succeed on these sheets.

**Rate resolution picks a tab per praca, then takes BOTH rates from it.** Resolving the two rate
columns independently lets one row take its „z narzędziami" rate from one tab and its „bez
narzędzi" rate from the other — an incoherent pair. This was an actual defect in the throwaway
analysis script and is the reason the rule is stated here.

**The sanity guard on rate resolution is load-bearing.** A scoring heuristic without it picked the
arithmetically impossible variant on Białostocka row 104 („gruntowanie": 3 zł with tools vs 5,10 zł
without — cheaper _with_ tools). A candidate pair where the bez-narzędzi rate exceeds the
z-narzędziami rate is rejected before scoring.

**Ordering inside `applyKosztorysImport`.** The snapshot must be captured on the _transaction_ db
handle and before the wipe, exactly as `restoreSnapshotAction:80-82` does. Capturing outside the
transaction leaves a snapshot behind after a rollback; capturing after the wipe snapshots nothing.

---

## Phase 1: Sheet reading and column resolution

### Overview

Turn a spreadsheet id into resolved column maps for the three tabs, or a named failure. Pure logic
separated from the network call so the whole resolver is unit-testable against committed grid
fragments.

### Changes Required

#### 1. Column vocabulary

**File**: `src/lib/kosztorys/sheet-import/columns.ts`

**Intent**: The synonym dictionary that lets one resolver read 43 differently-laid-out sheets —
which labels count as „Przedmiar", „j.m.", „Cena j.m.", „rabat", „opis", „sekcja", and how a stage
column is recognised.

**Contract**: Exports the field set for each tab as normalized-label predicates, plus which fields
are required (a missing one is a stop) versus optional (rabat: Ryżowa 66/127 genuinely has none).
Reuses `normalize` from `@/lib/google/sheet-configs` rather than redefining it. Known synonyms that
must be covered, from the 45-sheet scan: `j.m.` / `j.m` / `jm` / `Jednostka` / `jednostka miary`;
`Cena j.m.` / `Cena jednostkowa` / `Cena jm.`; `rabat` matched as a prefix (Marszałkowska writes
„rabat 8%").

#### 2. Header-block resolver

**File**: `src/lib/kosztorys/sheet-import/resolve-columns.ts`

**Intent**: Given a tab's grid, locate the header block and map each field to a column index; locate
the contiguous stage columns by the row-2 „wykonano" marker; report every resolution so the preview
can display it.

**Contract**: `(grid, tabSpec) => ResolvedColumnsT | ResolveFailureT` — a total function, never
throws, because the failure is a display value the dialog renders, not an exception. `ResolvedColumnsT`
carries the field→index map, the stage column index range, and the header label actually found for
each field (so the preview can show „Przedmiar → kolumna L (»Przedmiar«)"). A duplicate match on a
required field is a failure naming the field and the count — **not** a leftmost-wins pick.

#### 3. Tab reader

**File**: `src/lib/kosztorys/sheet-import/read-sheet.ts`

**Intent**: Fetch the three tabs' grids in one batched call.

**Contract**: `(spreadsheetId) => { robocizna, wTools, ownTools }` as raw `unknown[][]`, values
unformatted so numbers arrive as numbers. Uses `createServiceAccountJWT` from `@/lib/google/auth`
with the **readonly** scope — not the read-write scope `sheets.ts` uses, since nothing here writes.
A missing „zakres pracy" tab is not fatal (rates fall back to the other tab); a missing
`kosztorys_robocizny` is.

### Success Criteria

#### Automated Verification:

- Resolver specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/resolve-columns.test.ts`
- Fixture grids contain no client PII: `pnpm exec vitest run src/__tests__/fixtures/kosztorys-sheet/no-pii.test.ts` (colocated with the fixtures it guards, since the fixture directory is its subject)

#### Manual Verification:

- Running the resolver against Białostocka's live sheet reports the same columns the existing seeder
  hardcodes.

---

## Phase 2: Parsing and rate resolution

### Overview

Turn resolved grids into a kosztorys tree plus an explicit list of every rate decision made.

### Changes Required

#### 1. kosztorys_robocizny parser

**File**: `src/lib/kosztorys/sheet-import/parse-robocizna.ts`

**Intent**: Walk the data rows, tracking the current section, emitting one item per praca with its
Przedmiar / j.m. / Cena j.m. / rabat, and one wykonano entry per non-zero stage cell.

**Contract**: `(grid, resolved) => { sections, items, progress, stageCount }` using
`KosztorysSectionT` / `KosztorysItemT` / `StageProgressT` with locally-minted sequential ids (the
same convention `insertKosztorysTree` remaps). Section headers are recognised by the existing
seeder's rule — the „x" marker in the Przedmiar/Pomiar columns with the name in the section column.
Rabat is stored as `discountType: 'percent'` with the sheet's fraction scaled to a percentage, per
`seed-investment-from-sheet.ts:153`. `stageCount` is the count of resolved stage columns, **not**
the highest column carrying data — an etap planned but not yet started is still an etap.

#### 2. Rate resolution across the two „zakres pracy" tabs

**File**: `src/lib/kosztorys/sheet-import/resolve-rates.ts`

**Intent**: For each praca, pick ONE tab and take both rates from it; record why; surface the ones
that could not be decided.

**Contract**: Candidates are built by **matching the praca's description across the tabs** — never by
row index. The existing seeder joins positionally (`rateRows[i]`, `seed-investment-from-sheet.ts:150`),
which silently misattributes every rate below the first row where the tabs diverge; nothing guarantees
the three tabs stay row-aligned. Then `(candidates) => { rate, source, decision }[]` where `decision` distinguishes
_agreeing_ / _single tab only_ / _auto-resolved_ / _conflict_. Rules, in order: a candidate whose
bez-narzędzi rate exceeds its z-narzędziami rate is rejected outright (the guard); a praca present
in one tab only takes that tab; where both tabs agree, either; where they disagree, the
hand-typed value wins over a formula-derived one and the outcome is marked _auto-resolved_; where
both are hand-typed and differ, it is a _conflict_ — the tab designated authoritative supplies the
value and the row is listed as needing the owner's eye.

#### 3. Rate → per-item override

**File**: `src/lib/kosztorys/sheet-import/derive-override.ts`

**Intent**: Lift `deriveOverride` out of the seeder unchanged — a positive rate over a positive
client price becomes a `'coeff'`, a rate without a client price freezes as an `'amount'`, a blank
rate freezes an explicit flat 0.

**Contract**: Same signature as `seed-investment-from-sheet.ts:79`. Carry its comment across
verbatim: a blank rate means 0, **not** „inherit the default coefficient" — the sheet has no
inherit concept, and a `null` override would invent a section/global-coeff cost the sheet never has.
Update the seeder to import from here rather than keeping its own copy.

### Success Criteria

#### Automated Verification:

- Parser specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/parse-robocizna.test.ts`
- Rate specs pass, including the guard: `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/resolve-rates.test.ts`
- The seeder still typechecks against the extracted helper: `pnpm exec tsc --noEmit`

#### Manual Verification:

- Parsing Białostocka yields 13 sections / 324 prace / 10 etapy, and the resolution list shows
  8 auto-resolutions and the 1 known conflict (r125 akrylowanie).

---

## Phase 3: Import plan

### Overview

Merge the sheet-derived tree with what the investment currently has, and compute everything the
preview displays. One function, called by both actions.

### Changes Required

#### 1. Plan builder

**File**: `src/lib/kosztorys/sheet-import/build-import-plan.ts`

**Intent**: Produce the tree that would be written plus the report describing it, from the sheet
grids and the investment's current serialized tree.

**Contract**: `(sheetTabs, currentTree) => ImportPlanT` where `ImportPlanT` carries `tree`
(a `SnapshotPayloadT` ready for `restoreKosztorys`) and `report`. The report holds: the resolved
column map per tab, the counts, the rate decision list, the retained-praca list, and the total
comparison. **`tree.settings` is copied from `currentTree.settings`** — import must not touch VAT
or the global coefficients, and `restoreKosztorys` rewrites whatever it is given.

Matching is by **(section name, description, nth occurrence within that section)**. A praca in the
current tree with no sheet counterpart is **retained**: it keeps its own values and lands at the end
of its section in the merged tree; if its section itself is gone from the sheet, the section is
retained too, after the sheet's sections. Etapy come from the sheet — count and labels — so
retained prace keep their wykonano only for etapy that still exist.

#### 2. Footer total comparison

**File**: `src/lib/kosztorys/sheet-import/footer-totals.ts`

**Intent**: Find the sheet's own summary rows and compare them against what the app computes from
the parsed tree — the strongest available evidence that the parse is correct, since the figure
depends on every price, rabat and quantity individually.

**Contract**: Locates the footer rows **by label**, not by row number (position varies per sheet):
„wartość netto" and „R netto - suma prac wykonannych". Compares each locatable one against the
corresponding app total computed with the existing `src/lib/kosztorys/calc.ts` helpers — never a
reimplementation, or the check proves nothing. Returns per-row `{ label, sheetValue, appValue, delta }`;
a row that cannot be located is reported as _not found_ rather than silently passing. A delta beyond
one grosz is a **warning**, not a block — sheets with broken footer formulas exist (AGENTS.md notes
this of the test sheet).

### Success Criteria

#### Automated Verification:

- Plan specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/build-import-plan.test.ts`
- Retention spec passes: a praca absent from the sheet survives the merge with its values intact
- Settings spec passes: `plan.tree.settings` equals the current tree's settings, never the defaults

#### Manual Verification:

- Against Białostocka, the footer comparison agrees to the grosz.

---

## Phase 4: Server actions

### Overview

Two actions sharing the plan builder: one displays, one writes.

### Changes Required

#### 1. Preview + apply

**File**: `src/lib/actions/kosztorys-import.ts`

**Intent**: `previewKosztorysImport(investmentId)` returns the report for the dialog;
`applyKosztorysImport(investmentId)` re-derives the plan server-side and replaces the kosztorys.

**Contract**: Both are `protectedAction` handlers with an added `isAdminOrOwnerRole(user.role)`
check — `protectedAction` alone admits MANAGER. Both resolve the sheet via `getInvestmentSheetId`
and return the Polish „Inwestycja nie ma kosztorysu." on a missing link, matching
`sheets-sync.ts:159`. Preview returns `report` only, never the tree — the browser has no use for it
and shipping it invites a round-trip.

Apply **takes no plan from the client**: it re-reads the sheet and rebuilds the plan, exactly as
`applyMaterialSync` re-derives its row set (`sheets-sync.ts:234`). It refuses when column resolution
fails. Then, inside one `withPayloadTransaction` with `skipRevalidation: true`:
`captureAutoSnapshot(txDb, …)` → `restoreKosztorys(payload, req, investmentId, plan.tree)`, and
revalidates the same five tags `restoreSnapshotAction` does (`kosztorysSections`, `kosztorysItems`,
`kosztorysStages`, `stageProgress`, `investments`). Returns the counts written plus
`droppedWorkerAssignments` from `insertKosztorysTree`.

### Success Criteria

#### Automated Verification:

- Action specs pass: `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-import.test.ts`
- A MANAGER session is refused by both actions
- Apply ignores a forged plan passed from the client and writes the server-derived one
- After apply, the pre-import snapshot exists and restores the previous tree — asserted against the
  **persisted** tree, not the action's return value

#### Manual Verification:

- Importing an investment whose sheet link was removed shows the Polish missing-kosztorys message.

---

## Phase 5: Menu item and preview dialog

### Overview

The user-facing surface: one menu entry and one dialog.

### Changes Required

#### 1. Menu entry

**File**: `src/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.tsx`

**Intent**: Add „Pobierz z arkusza Google…" between „Zapisz jako szablon…" and „Widok klienta", in
its own separator group.

**Contract**: Follows the file's existing shape — `DropdownMenuItem` + `MenuItemBody({label,
description})` + a lucide icon, with the dialog as a controlled sibling of the menu (never a child
of `DropdownMenuContent`), and the fetch fired on click rather than inside the dialog, exactly as
`handleOpenShare` (`:55`) does and for the same Radix reason. Description: „Wczytaj sekcje, prace,
stawki i etapy z arkusza podpiętego do tej inwestycji." The label must not collide with the existing
„Wczytaj" (restore a saved version) — hence „Pobierz".

#### 2. Preview dialog

**File**: `src/components/kosztorys/editor/dialogs/sheet-import-dialog.tsx`

**Intent**: Render the report and gate the confirm.

**Contract**: Uses the shared `Dialog` / `DialogHeader` / `DialogActions` shell (EX-519), mirroring
`src/components/sheets/sync-button.tsx:112-151`. Sections, in order: **rozpoznane kolumny** (which
column in which tab, with the header text found), **co wejdzie** (counts), **rozstrzygnięcia
stawek** (every auto-resolution and conflict, listed by praca — never collapsed to a count),
**prace, których nie ma w arkuszu** (retained, listed by name), **porównanie sum** (the sheet's
footer figure beside the app's, with the delta). Confirm is disabled when column resolution failed;
a total mismatch renders as a visible warning with confirm still enabled. On success, a toast with
the counts and `router.refresh()` per the project's optimistic-submit convention.

### Success Criteria

#### Automated Verification:

- Dialog specs pass: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/dialogs/sheet-import-gate.test.ts`
- Confirm is disabled when the report carries a column-resolution failure
- A total mismatch renders the warning **and** leaves confirm enabled

#### Manual Verification:

- The menu item sits in the right group and reads distinctly from „Wczytaj".
- Importing Białostocka end-to-end fills the editor; „Wczytaj" offers the pre-import snapshot.
- The dialog is usable at 768px — the resolution list is the long one.

---

## Inherited Caveats

`captureAutoSnapshot` reads the tree through the cached query layer, not the transaction handle it is
given — so the pre-import snapshot reflects what the query layer returns rather than a
transaction-consistent read (`research.md` §6). Pre-existing in restore, inherited here, **not fixed
in this change**. It is recorded because a stale pre-import snapshot would undo the whole safety
argument. Same section notes that the snapshot is `auto`-kind and therefore subject to the count cap;
promoting it to a labelled `manual` one is a one-line change deliberately not taken now.

## Testing Strategy

### Unit Tests

Test-first, per `/10x-tdd`, on the pure layers. Fixtures are **real header blocks and row samples
cut from the scanned sheets**, committed under `src/__tests__/fixtures/kosztorys-sheet/`. The four
layouts that actually broke the analysis pass, each its own fixture:

1. **Przedmiar shifted** — the column at L rather than N.
2. **Stage header renamed to a crew name** — proves stage location keys off row 2 „wykonano", not
   the label.
3. **Conflicting rates across the two „zakres pracy" tabs** — including the r104 pair that must be
   rejected by the guard.
4. **No rabat column** (Ryżowa 66/127) — optional field absent is not a failure; a duplicate
   required column is.

**Fixtures carry no client PII.** Sheet row 1 is „Imię i nazwisko oraz adres inwestycji" and is
never included; investment names in fixture filenames are replaced with the investment id. A spec
asserts the fixture directory contains no person-shaped strings, so a future fixture can't
reintroduce them.

### Integration Tests

The write path is already covered by the existing restore specs
(`src/__tests__/lib/kosztorys/restore-*.test.ts`) — import reuses `restoreKosztorys` rather than
adding a second write path, so the new DB-backed spec covers only what is new: apply takes a
snapshot before writing, and the snapshot restores the prior tree. Asserted against the **persisted**
tree.

### Manual Testing Steps

1. Import Białostocka (investment 42) on the local DB; confirm 13 / 324 / 10 and a matching footer.
2. Open „Wczytaj" and restore the pre-import snapshot; confirm the prior tree returns.
3. Point the action at Dąbrowskiego 86; confirm the dialog names the unresolvable column and offers
   no confirm.
4. Delete a praca from the app, re-import; confirm it is _not_ re-added as a duplicate and the sheet
   version lands once.
5. Add a praca in the app that the sheet lacks, re-import; confirm it survives and is listed.

## Performance Considerations

One import is 1 batched read of 3 tabs plus one bulk write — the same profile as a snapshot restore,
which handles ~1000 rows in well under a second via `insertKosztorysTree`'s one-INSERT-per-level
path. Nothing here needs batching work. (The 429 seen during the 45-sheet analysis was a bulk-scan
artefact and does not apply to a single-investment button.)

## Migration Notes

No schema change. No data migration: per AGENTS.md, kosztorys rows are throwaway until dogfooding
merges to `main`, so no backfill or compat shim is owed. Nothing ships to prod as data — prod gets
the button and reads its own sheets.

## Whole-tree Gate

- Type checking passes: `pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm exec vitest run`
- Build succeeds: `pnpm build`

## References

- Codebase research behind this plan: `context/changes/2026-08-11-kosztorys-importer/research.md`
- Change identity + shaping decisions: `context/changes/2026-08-11-kosztorys-importer/change.md`
- Roadmap slice: `context/foundation/roadmap.md` → S-15
- Linear: EX-417
- Write path to mirror: `src/lib/actions/kosztorys-snapshots.ts:61`
- Preview/apply pattern to mirror: `src/lib/actions/sheets-sync.ts:155,238`
- Blueprint being generalized: `src/scripts/seed-investment-from-sheet.ts`
- Domain background: `context/reference/kosztorys-editor-domain-notes.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Sheet reading and column resolution

#### Automated

- [x] 1.1 Resolver specs pass
- [x] 1.2 Fixture PII spec passes

### Phase 2: Parsing and rate resolution

#### Automated

- [x] 2.1 Parser specs pass
- [x] 2.2 Rate specs pass, including the guard
- [x] 2.3 Seeder typechecks against the extracted helper

### Phase 3: Import plan

#### Automated

- [x] 3.1 Plan specs pass
- [x] 3.2 Retention spec passes
- [x] 3.3 Settings spec passes

### Phase 4: Server actions

#### Automated

- [x] 4.1 Action specs pass
- [x] 4.2 MANAGER refused by both actions
- [x] 4.3 Apply ignores a client-forged plan
- [x] 4.4 Pre-import snapshot exists and restores the prior tree

### Phase 5: Menu item and preview dialog

#### Automated

- [x] 5.1 Dialog specs pass
- [x] 5.2 Confirm disabled on column-resolution failure
- [x] 5.3 Total mismatch warns and leaves confirm enabled
