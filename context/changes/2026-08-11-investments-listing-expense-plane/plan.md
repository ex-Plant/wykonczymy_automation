# Wydatki w liście inwestycji na płaszczyźnie rozliczenia materiałów — Implementation Plan

## Overview

The investments listing prices „Wydatki inwestycyjne" and the per-category columns by summing raw
`categoryCosts`. That sum does not know which plane each amount stands on — it adds a brutto receipt
to an amount recorded netto — and it drops the uncategorised correction entirely. The summary panel
computes the same figures correctly. This change moves the listing onto the panel's arithmetic, adds
the missing correction column so the columns sum to the total, and adds three new columns
(`totalSettled`, „Bilans netto" relabel, „Bilans brutto").

## Current State Analysis

Verified in this worktree against investment 31 (`materials_net_rate = 0,25`, mode `NET`):

- `shapeInvestments` (`src/lib/queries/investments.ts:38`) computes
  `totalInvestmentExpense = Σ categoryCosts.total` = **191 080,57**. The panel's „Razem" is
  **152 648,46** netto / **190 810,57** brutto. The 270,00 gap is the missing correction (+300)
  minus the two netto-recorded expenses being counted at brutto face value.
- The category cell „Materiały budowlane" 132 115,13 is **132 015,13 brutto + 100,00 netto inside one
  number** — two planes in one cell. „Pozostałe koszty" 20,00 is a pure netto amount sitting in a row
  of brutto amounts.
- **The correct arithmetic already exists** and reconciles to the grosz:
  `billedMaterials({ grossBase, netBilled }, rate)` (`src/lib/kosztorys/summary-economics.ts:78`).
  132 015,13/1,25 + 100 = **105 712,10**; 58 945,44/1,25 = **47 156,35**; netto kat. 3 = **20,00**;
  −300/1,25 = **−240,00**. Σ = 152 648,46 = the panel's total.
- **The one missing cable**: `deriveCategoryBreakdowns` produces `netCategoryCosts`
  (`src/lib/db/investment-financials.ts:54`), but `sum-transfers.ts:230` destructures only
  `{ categoryCosts, settledCategoryCosts }` and `InvestmentFinancialsT` has no field for it. Without
  it, no listing cell can separate the brutto part of a category from the netto part.
- **The GROSS-mode gate lives inline in a component** (`summary-panel-content.tsx:209`,
  `settlementMode === 'GROSS' ? null : materialsNetRate`). Every new surface has to reproduce it from
  memory — which is exactly why the listing does not have it.
- `totalSettled` is already on `InvestmentFinancialsT`, just never copied onto the row.
  `uncategorisedRemainder` is computed (`map-category-costs.ts:27`) but private to its module.
- `vatRate` exists on the collection (`src/collections/investments.ts:105`, `defaultValue:
  DEFAULT_VAT = 0.08`) but is **not** in the `fetchReferenceData` SELECT (`reference-data.ts:63-68`)
  nor on `InvestmentRefT`.
- `calculateBalance` never touches `vatRate`, so the listing's bilans is VAT-free in every settlement
  mode — the „Bilans netto" label is true unconditionally.

### Why no guard caught it

- `src/__tests__/shape-rows.test.ts:107-133` **encodes the defect as the spec**:
  `expect(row.totalInvestmentExpense).toBe(1200) // correction not folded in`.
- `src/__tests__/investment-render-parity-db.test.ts:76-82` calls `deriveFinancials` with **three**
  arguments — no rate, no mode — while the listing side gets the real rate from
  `sum-transfers.ts:236`. On any investment with a rate this test would **falsely fail** on bilans.
  It is green only because the test DB has 0/109 investments with a rate.
- `src/scripts/audit-investment-parity.ts:51` computes `wydatkiInwestycyjne` as
  `f.categoryCosts.reduce(...)` inside `figuresOf`, and feeds **both** sides through it — its diff on
  that figure is structurally always zero. (Its `deriveFinancials` call at `:100` *does* pass rate
  and mode correctly; only `figuresOf` is the problem.)
- The listing's category columns (`investments.tsx:84-91`) have no test at all.

## Desired End State

On the investments listing, every money column stands on the plane the investor is actually billed
on, per row, matching the investment's own summary panel to the grosz. The category columns plus a
„Korekta" column sum to „Wydatki inwestycyjne". Three new columns exist: „Wydatki wliczone w
robociznę", „Bilans netto" (relabel), „Bilans brutto".

Verification: open `/inwestycje`, read the row for investment 31 — budowlane 105 712,10 ·
wykończeniowe 47 156,35 · pozostałe 20,00 · korekta −240,00 · wydatki inwestycyjne 152 648,46 ·
wliczone w robociznę 1 004 421,85 — and confirm each figure against that investment's Podsumowanie.

### Key Discoveries

- `billedMaterials({ grossBase, netBilled }, rate)` (`summary-economics.ts:78`) is the whole
  arithmetic — per category, for the correction, and for the total. No new formula is needed; a
  fourth hand-rolled copy is what this change exists to prevent.
- `netCategoryCosts` is a **subset** of `categoryCosts` (`investment-financials.ts:40-43`), so the
  brutto part of a category is `total − netPart` and Σ stays intact by construction.
- The uncategorised remainder is purely brutto (corrections are the brutto type), so it crosses the
  plane by division alone.
- `whole-investment-financials.ts:63-67` shows the established shape: rate + mode go in as
  `settings`, `netCategoryCosts` travels alongside.
- New column ids default to **visible** (`column-toggle.tsx:23` reads a missing entry as visible),
  so nothing needs migrating in `table-columns:investments` localStorage.

## What We're NOT Doing

- **Stats v1 tiles on the investment page and the transfers export header** (`page.tsx:67` →
  `mapCategoryCostsToFields`, `lib/export/header-fields.ts`). Not the same defect: there the sum of
  visible tiles **is** the bilans, the correction has its own tile and the concession has its own
  („Obniżka materiałów"). Repricing the category tiles to netto while keeping the concession tile
  would deduct the concession twice. Separate decision.
- `/raporty` (`raporty/page.tsx:42`) — deliberately rate-free, banner-marked (EX-598); a multi-
  investment aggregate has no single rate.
- The Google Sheets mirror (`lib/google/tab-rows.ts:56`) — a per-row convention, different by design.
- **No settlement-mode badge/column on the listing.** After the fix every column stands on the plane
  the client is billed on, so each row is correct in GROSS mode too (rate goes inert → the receipt).
- **No role gate on the new columns** — MANAGER sees „Korekta" and „Wydatki wliczone w robociznę".
- **No netto fixture in the test DB.** Chosen: synthetic unit tests. Consequence recorded in Open
  Risks — the real-data path stays uncovered except through the audit script.
- No CSV/print export for the listing (none exists).

## Implementation Approach

Four phases, sequenced so a wrong number is attributable. Phase 1 lays the cable and extracts the
gate while **changing no visible figure**. Phase 2 moves the definition of one existing figure and
nothing else. Phase 3 adds new figures. Phase 4 repairs the two detectors that were structurally
incapable of catching this.

Every plane crossing goes through `billedMaterials` from `summary-economics.ts` — the same function
the panel uses — so „Σ kolumn === total" holds by construction rather than by agreement.

## Critical Implementation Details

**Where the netto part sits.** `netCategoryCosts` is a subset of `categoryCosts`, not a sibling. A
category's brutto base is `categoryTotal − netPart`; feeding the raw `categoryTotal` as `grossBase`
would divide the netto part a second time and put the column below the panel.

**The type fanout is a compile-time cascade, not a runtime risk.** Adding a field to
`InvestmentFinancialsT` breaks `derive-financials-bucketing.test.ts` in two places that must move
together: the `Exclude<...>` at `:28` and the `.filter()` at `:97-99`. One without the other leaves
the "covers every bucket" test comparing a map against a mismatched key list.
`summary-reading.test.ts:13` uses `as InvestmentFinancialsT` (assertion, not annotation) and will
stay **silently green** — it needs updating by hand, `tsc` will not point at it.

## Phase 1: Bramka i brakujący kabel

### Overview

Extract the GROSS gate into one function, carry `netCategoryCosts` to the listing aggregate, and
export the uncategorised remainder. No visible figure changes in this phase.

### Changes Required:

#### 1. The settlement-mode gate

**File**: `src/lib/kosztorys/settlement-mode.ts`

**Intent**: Give the `settlementMode === 'GROSS' ? null : rate` rule one home, so the listing does not
become its third inline copy. Its comment should carry the reason (a brutto-settled client has VAT
added on top — there is nothing to strip) rather than restating the branch.

**Contract**: `effectiveMaterialsNetRate(mode: SettlementModeT, rate: number | null): number | null`.
Module is already reachable from the Payload collection config — keep it value-import-free of the
grid config, as the existing header comment requires.

**File**: `src/components/kosztorys/summary/summary-panel-content.tsx`

**Intent**: Replace the inline `effectiveNetRate` derivation with a call to the new function. Same
value, one definition.

**Contract**: `effectiveNetRate` keeps its name and type; only its right-hand side changes.

#### 2. The missing cable

**File**: `src/types/investment-financials.ts`

**Intent**: Add `netCategoryCosts` to `InvestmentFinancialsT` so `categoryCosts` never travels without
the information about which part of it is already netto. Document it as a subset, mirroring the
wording already on `CategoryBreakdownsT`.

**Contract**: `netCategoryCosts: CategoryCostT[]` on `InvestmentFinancialsT`.

**File**: `src/lib/db/investment-financials.ts`

**Intent**: `deriveFinancials` accepts and returns the third map, defaulting to `[]` like the other
two so the rate-free callers (reports, client share) are unaffected.

**Contract**: new optional parameter after `settledCategoryCosts` — placed so existing positional
calls (`materialsNetRate`, `settlementMode` at positions 4 and 5) keep working. Either append it last
or, if inserted, update **every** call site: `sum-transfers.ts:232`, `whole-investment-financials.ts:55`,
`audit-investment-parity.ts:100`, `raporty/page.tsx:42`, plus tests. Appending last is the smaller
diff and is preferred.

**File**: `src/lib/db/sum-transfers.ts`

**Intent**: Stop dropping `netCategoryCosts` at the destructure and pass it into `deriveFinancials`.

**Contract**: line 230's destructure gains `netCategoryCosts`; line 232's call gains the argument.

#### 3. The uncategorised remainder

**File**: `src/lib/db/map-category-costs.ts`

**Intent**: Export `uncategorisedRemainder` so the listing reads the same definition the panel's
„Korekta (bez kategorii)" row and the v1 header tile already read.

**Contract**: `export function uncategorisedRemainder(financials: InvestmentFinancialsT): number` —
signature unchanged, visibility only.

#### 4. Type-fanout repairs

**File**: `src/__tests__/derive-financials-bucketing.test.ts`

**Intent**: Keep the bucket-coverage assertion honest with the widened type — `netCategoryCosts` is a
breakdown map, not a bucket, so it joins the two already excluded.

**Contract**: add `'netCategoryCosts'` to the `Exclude<>` at `:28` **and** to the `.filter()` at
`:97-99`. Both, or the test compares mismatched key sets.

**File**: `src/__tests__/sum-transfers.test.ts`, `src/__tests__/shape-rows.test.ts`,
`src/__tests__/calculate-balance.test.ts`, `src/__tests__/map-category-costs.test.ts`,
`src/__tests__/calculate-margin.test.ts`, `src/__tests__/financial-golden-master-db.test.ts`,
`src/__tests__/summary-reading.test.ts`

**Intent**: Add the new field to typed `InvestmentFinancialsT` literals and to the whole-object
`toEqual` assertions. `summary-reading.test.ts:13` uses `as` and will not be flagged by `tsc` — fix it
by hand.

**Contract**: `netCategoryCosts: []` wherever a literal is built; `toEqual` objects gain the key.

### Success Criteria:

#### Automated Verification:

- Bucketing spec passes: `pnpm exec vitest run src/__tests__/derive-financials-bucketing.test.ts`
- Settlement-mode spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/settlement-mode.test.ts`
- New spec asserts `effectiveMaterialsNetRate` returns `null` for GROSS at any rate, and the rate
  unchanged for NET and MIXED
- Aggregate spec passes with the widened shape: `pnpm exec vitest run src/__tests__/sum-transfers.test.ts`

#### Manual Verification:

- The investment summary panel („Podsumowanie") shows unchanged figures for investment 31 in NET
  mode and unchanged behaviour after switching that investment to GROSS and back.

---

## Phase 2: Naprawa „Wydatków inwestycyjnych" i kolumn kategorii

### Overview

Move the listing onto the billed plane and add the correction column, so the columns sum to the
total. One definition moves in this phase and nothing else, so a wrong number is attributable.

### Changes Required:

#### 1. Per-category billed costs

**File**: `src/lib/kosztorys/summary-economics.ts`

**Intent**: Add one helper that prices a category on the plane the investor is billed on, built on the
existing `billedMaterials` so the listing cannot drift from the panel. The correction row uses the
same helper with a zero netto part.

**Contract**:
`billedCategoryCosts(categoryCosts: CategoryCostT[], netCategoryCosts: CategoryCostT[], rate: number | null): CategoryCostT[]`
— per entry, `billedMaterials({ grossBase: total − netPart, netBilled: netPart }, rate)`.

#### 2. The listing row

**File**: `src/lib/queries/investments.ts`

**Intent**: `shapeInvestments` prices the row on the plane the client is billed on: effective rate from
`effectiveMaterialsNetRate(inv.settlementMode, inv.materialsNetRate)`, `categoryCosts` replaced by
their billed values, `totalInvestmentExpense` computed as `billedMaterials` over the two material
buckets (not `Σ billedCategoryCosts` and not `totalMaterialCosts − materialsNetDiscount` — both are
equal, but the bucket form is the same call the panel makes), and a new `uncategorisedCorrection`
field. Delete the comment at `:35-37` that documents the old rule; replace it only if the new rule
needs a *why* the code does not carry.

**Contract**: `InvestmentRowT` gains `uncategorisedCorrection: number`. `categoryCosts` keeps its type
but now carries billed figures — say so at the field. The zeroed fallback literal at `:22-33` gains
`netCategoryCosts: []` (and `materialsGrossBase` / `materialsNetBilled`, which it is missing today).

**Invariant this phase must hold**: `Σ billedCategoryCosts + uncategorisedCorrection ===
totalInvestmentExpense` (to the grosz).

#### 3. The „Korekta" column

**File**: `src/components/tables/investments.tsx`

**Intent**: Add a „Korekta" column immediately after the category columns and before „Wydatki
inwestycyjne", so the reader can add the columns up left to right and land on the total. Always
rendered (owner's choice: a fixed column set beats a data-dependent one).

**Contract**: `col.accessor('uncategorisedCorrection', { id: 'uncategorisedCorrection', header:
'Korekta', meta: { align: 'right' } })`, `formatPLN` cell like its neighbours. No role gate.

#### 4. Rewrite the test that froze the defect

**File**: `src/__tests__/shape-rows.test.ts`

**Intent**: `:107-133` asserts `toBe(1200) // correction not folded in` — it is the old definition
written down. Per `lessons.md:342` it gets **rewritten red first**, not amended: change the assertion
to the new expectation, watch it fail, then make it pass. Add cases the old spec never had: a rate set
+ a netto category (mixed planes in one category), GROSS mode with a rate set (rate inert, figures
equal the raw receipts), and the Σ-columns-equals-total invariant.

**Contract**: new expectations reproduce investment 31's arithmetic at a scale that is checkable by
hand — e.g. `categoryCosts: [{1, 1250}]`, `netCategoryCosts: [{1, 100}]`, rate 0,25 → column 1 020,00.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/shape-rows.test.ts` — the rewritten spec passes, including the
  Σ-columns-equals-total invariant and the GROSS-inert case
- New spec for `billedCategoryCosts` passes:
  `pnpm exec vitest run src/__tests__/lib/kosztorys/summary-economics.test.ts`

#### Manual Verification:

- `/inwestycje`, row „11 Listopada 40": budowlane 105 712,10 · wykończeniowe 47 156,35 · pozostałe
  20,00 · korekta −240,00 · wydatki inwestycyjne 152 648,46
- The same row's figures match that investment's Podsumowanie „Razem" netto to the grosz
- An investment with no materials rate is unchanged from before the change
- Switching investment 31 to GROSS makes its columns show the raw receipts, and back to NET restores
  the netto figures

---

## Phase 3: Trzy nowe kolumny

### Overview

Add „Wydatki wliczone w robociznę", relabel „Bilans" → „Bilans netto", and add „Bilans brutto" — which
needs `vatRate` carried to the listing for the first time.

### Changes Required:

#### 1. Carry `vatRate` to the listing

**File**: `src/lib/queries/reference-data.ts`

**Intent**: Add `vat_rate` to the investments SELECT and map it, falling back to `DEFAULT_VAT` the way
`queries/kosztorys.ts:74` already does — the column is nullable, and a null must not turn „Bilans
brutto" into NaN.

**Contract**: `i.vat_rate::float8` in the SELECT; `vatRate: row.vat_rate == null ? DEFAULT_VAT :
Number(row.vat_rate)` in the mapper.

**File**: `src/types/reference-data.ts`

**Intent**: Add `vatRate` to `InvestmentRefT` next to `materialsNetRate` / `settlementMode`, and extend
that pair's existing comment to say why the third rate now rides along.

**Contract**: `vatRate: number` (non-nullable — the fallback is applied at the read).

#### 2. New row fields

**File**: `src/lib/queries/investments.ts`

**Intent**: Copy `totalSettled` onto the row and compute the gross balance. VAT rides the prace alone
— the same rule `summary-economics.ts` enforces — so the gross balance is the netto balance plus VAT
on `totalLaborCosts`, and nothing else.

**Contract**: `InvestmentRowT` gains `totalSettled: number` and `balanceGross: number`;
`balanceGross = balance + inv.vatRate * financials.totalLaborCosts`.

#### 3. Columns

**File**: `src/components/tables/investments.tsx`

**Intent**: „Bilans" header becomes „Bilans netto" (label only — the figure is unchanged, since
`calculateBalance` never touches VAT). „Bilans brutto" sits next to it: in NET the netto column is the
amount due, in GROSS the brutto one, and in MIXED both stand at once — the same rule
`settlementModeToGridAxis` already applies (`MIXED → 'both'`), which is why these are two fixed
columns rather than one switched by mode. „Wydatki wliczone w robociznę" goes after „Wydatki
inwestycyjne". All three always visible, no role gate.

**Contract**: `balance` column header string changes; new `col.accessor('balanceGross', { id:
'balanceGross', header: 'Bilans brutto' })` rendered with `BalanceCell` like its twin; new
`col.accessor('totalSettled', { id: 'totalSettled', header: 'Wydatki wliczone w robociznę' })` with
`formatPLN`. The label already exists as `SETTLED_TYPE.label = 'Materiały wliczone w robociznę'
(lib/constants/transfers.ts:256)` — this column's wording deliberately says „Wydatki", matching the
column it follows; do not reuse the constant unless the strings are made identical.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/shape-rows.test.ts` — covers `totalSettled` passthrough and
  `balanceGross = balance + vatRate × totalLaborCosts`, including the vatRate-null → `DEFAULT_VAT`
  fallback

#### Manual Verification:

- Investment 31 row: „Wydatki wliczone w robociznę" = 1 004 421,85
- „Bilans brutto" on a row with labour = „Bilans netto" + 8% of that row's robocizna
- Column toggle lists all three new columns and hiding/showing them survives a page reload
- A MANAGER account sees „Korekta" and „Wydatki wliczone w robociznę", and still does not see Marża
  or Wypłaty

---

## Phase 4: Detektory

### Overview

Repair the two guards that were structurally incapable of catching this defect. Neither adds
coverage on its own — they restore the ability to detect the next drift.

### Changes Required:

#### 1. The parity test's missing arguments

**File**: `src/__tests__/investment-render-parity-db.test.ts`

**Intent**: The detail side calls `deriveFinancials` with three arguments (`:76-82`) while the listing
side gets the real rate and mode from `sum-transfers.ts:236`. Pass the investment's rate and mode so
both sides compare like with like — today this test would falsely fail on any investment with a rate,
and is green only because the test DB has none.

**Contract**: the `investments` fetch must project `materialsNetRate` and `settlementMode` (the audit
script at `:81-86` already does exactly this — mirror it), and both go into the `deriveFinancials`
call as arguments 4 and 5.

#### 2. The audit script's self-fulfilling formula

**File**: `src/scripts/audit-investment-parity.ts`

**Intent**: `figuresOf` (`:47-54`) computes `wydatkiInwestycyjne` by re-deriving the listing's formula
and is applied to **both** sides, so that figure's diff is always zero by construction. The listing
side must go through `shapeInvestments` — the real assembly — which is `lessons.md:19` applied
literally. (The script's `deriveFinancials` call at `:100` already passes rate and mode correctly;
only `figuresOf` changes.)

**Contract**: split `figuresOf` into a detail-side reader and a listing-side reader that calls
`shapeInvestments([inv], { [id]: listingFin })` and reads `totalInvestmentExpense` off the row.
`shapeInvestments` needs an `InvestmentRefT`, so the script's investment projection grows to that
shape (it already carries id / name / rate / mode). Extend `FiguresT` with `korekta` and
`bilansBrutto` so the new columns are policed too.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/investment-render-parity-db.test.ts` passes against the test DB
- `node --env-file=.env --import tsx src/scripts/audit-investment-parity.ts post-fix` runs against the
  **local dev** DB (which has investment 31 with a rate) and reports zero mismatches across all
  figures, including `wydatkiInwestycyjne`

#### Manual Verification:

- `dumps/parity-post-fix.json` shows a non-zero `wydatkiInwestycyjne` on investment 31 and
  `match: true` — proving the figure is now compared rather than cancelled

---

## Testing Strategy

### Unit Tests:

- `shapeInvestments` (`src/__tests__/shape-rows.test.ts`) — rewritten red: mixed planes inside one
  category, GROSS mode with a rate set (rate inert), the uncategorised correction crossing the plane,
  the Σ-columns-equals-total invariant, `totalSettled` passthrough, `balanceGross` including the
  vatRate-null fallback
- `billedCategoryCosts` and `effectiveMaterialsNetRate` — their own specs, mirroring the source paths
  (`src/__tests__/lib/kosztorys/…`)

### Integration Tests:

- `investment-render-parity-db.test.ts` with rate and mode passed — will only exercise the netto plane
  once the test DB has such an investment, which this change deliberately does not create

### Manual Testing Steps:

1. `/inwestycje` — investment 31's six figures against the targets in `change.md`
2. The same figures against that investment's Podsumowanie „Razem"
3. An investment with no rate — unchanged from before
4. Investment 31 switched to GROSS — raw receipts; back to NET — netto figures restored
5. MANAGER account — new columns visible, Marża/Wypłaty still hidden
6. Column toggle + reload — visibility persists

## Performance Considerations

The listing already computes `deriveFinancials` per investment. This adds one map over
`categoryCosts` (≤ 3 entries) per row, over ~109 rows. Not measurable. `netCategoryCosts` is already
computed by `deriveCategoryBreakdowns` — the change carries it rather than deriving it again.

## Migration Notes

No schema change. `vat_rate` already exists on `investments`. Column visibility needs no migration:
`column-toggle.tsx:23` treats a missing localStorage entry as visible, so every user sees the new
columns without touching `table-columns:investments`.

Golden master: the snapshot contains neither the new field nor `totalInvestmentExpense`, so the data
stays green, but `ZERO_FINANCIALS` (`financial-golden-master-db.test.ts:65`) fails typecheck until the
new field is added. If regeneration turns out to be needed: `pnpm db:import:test` then
`pnpm test:golden:update`.

## Whole-tree Gate

Run **once**, after Phase 4.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit suite passes: `pnpm test`
- Integration suite passes: `pnpm test:integration`
- Build succeeds: `pnpm build`

## References

- Research: `context/changes/2026-08-11-investments-listing-expense-plane/research.md`
- Decisions: `context/changes/2026-08-11-investments-listing-expense-plane/change.md`
- The arithmetic to reuse: `src/lib/kosztorys/summary-economics.ts:25-80`
- The correct-by-construction precedent: `src/lib/queries/whole-investment-financials.ts:50-70`
- `context/foundation/lessons.md:19` (parity must run the real assembly), `:342` (a test guarding the
  old definition is tautological — rewrite red), `:323` (sequence definition-moving changes)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Bramka i brakujący kabel

#### Automated

- [x] 1.1 Bucketing spec passes with `netCategoryCosts` excluded in both places — 385228eb
- [x] 1.2 Settlement-mode spec passes — 385228eb
- [x] 1.3 New spec: `effectiveMaterialsNetRate` — null for GROSS, rate for NET/MIXED — 385228eb
- [x] 1.4 `sum-transfers.test.ts` passes with the widened shape — 385228eb

### Phase 2: Naprawa „Wydatków inwestycyjnych" i kolumn kategorii

#### Automated

- [x] 2.1 `shape-rows.test.ts` rewritten red then green — mixed planes, GROSS-inert, Σ-invariant
- [x] 2.2 New spec for `billedCategoryCosts` passes

### Phase 3: Trzy nowe kolumny

#### Automated

- [ ] 3.1 `shape-rows.test.ts` covers `totalSettled` and `balanceGross` incl. vatRate-null fallback

### Phase 4: Detektory

#### Automated

- [ ] 4.1 `investment-render-parity-db.test.ts` passes with rate and mode supplied
- [ ] 4.2 `audit-investment-parity.ts` reports zero mismatches on the dev DB with a non-zero, actually-compared `wydatkiInwestycyjne`
