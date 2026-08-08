# Filter-Blind Summary Panel Implementation Plan

## Overview

The v2 investment summary panel currently reads the page's filtered transaction scope, so Wpłaty,
Materiały and the whole Marża tab narrow with the transfers table's URL filters while the kosztorys
plane stays whole. An asterisk apparatus (`scope-marker.ts`, `scopeMarked`, `filtersActive`, a red
footnote) exists solely to explain that seam. This plan removes the seam: the panel fetches its own
unfiltered figures, and the apparatus — plus the filter plumbing it was the last consumer of — is
deleted.

## Current State Analysis

Filtered data reaches the panel by two routes, both originating at
`src/app/(frontend)/inwestycje/[id]/page.tsx:46-51`:

- `statsWhere` (URL filters + this investment, cancelled stripped) → `InvestmentSummaryPanel` →
  `fetchFilteredDepositTransactions(statsWhere)` → **Wpłaty** and, through it, „Do zapłaty" and the
  VAT-plane buckets.
- `financials` — derived at `page.tsx:65` from `fetchFilteredByType(statsWhere)` +
  `fetchCategoryBreakdowns(statsWhere)` — → **Materiały**, the **Marża** tab, the
  **Materiały/Wydatki** tab breakdowns, and the transaction-plane fallback reading.

`filtersActive` (`hasActiveTransferFilters(sp)`, `page.tsx:51`) then threads through five components
to do two jobs: draw the `<sup>*</sup>` on kosztorys-sourced rows, and mute two cross-plane verdicts
whose comparison a filter would invalidate.

A third state complicates it: with no kosztorys rows, `clientTotals === null` and the reading falls
back to `readingFromTransactions(financials)` — every figure becomes filter-reactive, so
`investment-summary-panel.tsx:113` suppresses the marker entirely via `filtersActive && clientTotals !== null`.

Meanwhile „Suma wybranych transakcji" (`transfer-filters.tsx:223-231`), rendered directly under the
panel whenever a filter is active, is computed independently in `transfer-table-server.tsx:54` from
its own `fetchFilteredByType(stripCancelledFilters(config.query.where))`. It already owns the
filtered question and shares none of this wiring.

## Desired End State

Every figure in the v2 panel — Podsumowanie, Materiały/Wydatki, Marża — reports the whole
investment, unaffected by any URL transaction filter. No asterisks, no footnote, no `filtersActive`
prop anywhere. „Suma wybranych transakcji" remains the one surface that answers the filtered
question. Both cross-plane verdicts render whenever they fire.

Verify: open an investment with a kosztorys, note the Podsumowanie / Materiały / Marża figures, apply
any transfers filter, confirm every figure is unchanged and no red footnote appears.

### Key Discoveries:

- `InvestmentSummaryPanel` already declares it owns its own fetches and derivations
  (`src/components/investments/investment-summary-panel.tsx:42-44`) — self-fetching is the shape the
  file was written for, not a new pattern.
- `tree.settlementMode` / `tree.materialsNetRate` come from the same investment record as the page's
  (`src/lib/queries/kosztorys.ts:74-76`), so `deriveFinancials`' last two arguments are already in
  hand. `materialsNetRate` is `?? null` on both paths, matching the parameter default.
- `fetchFilteredByType` and `fetchCategoryBreakdowns` are both `unstable_cache`-wrapped and keyed by
  `JSON.stringify(where)` (`src/lib/queries/transfer-totals.ts:19,30`) — a second call with a
  different `where` is a separate cache entry, not a duplicate query per render.
- `fetchDepositTransactionsForInvestment` already exists and is already the call
  `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:41` makes — no new query needed.
- `kosztorys_v2/page.tsx` is the only other host of `SummaryPanelContent` and never passes
  `filtersActive`, so removing the prop cannot regress it.
- `hasActiveTransferFilters` has exactly one caller (`page.tsx:51`) plus its own test block.
- No unit or E2E spec references `scopeMarked`, `filtersActive`, or any summary block.

## What We're NOT Doing

- Not touching the filter machinery the transfers table depends on: `buildTransferFilters`,
  `stripCancelledFilters`, `where-to-sql`, the filter UI, `transferWhere` → `TransfersSection`.
- Not changing „Suma wybranych transakcji" — it stays the filtered answer.
- Not touching the v1 `FinancialStats` block or `headerFields`; the page keeps its filtered
  `financials` for the CSV/print export header, which should describe the filtered table.
- Not adding automated tests for the panel (see Testing Strategy).
- Not touching the kosztorys editor's own summary panel host.

## Implementation Approach

Cut the data seam first, then delete the apparatus that described it, then the plumbing that fed it.
Each phase compiles on its own: after Phase 1 the downstream `filtersActive` props are still declared
but can no longer be true, so the marker is dead-but-valid code that Phase 2 removes.

## Phase 1: Panel goes filter-blind

### Overview

`InvestmentSummaryPanel` stops receiving the page's filtered scope and derives every transaction-plane
figure itself from an unfiltered, investment-scoped `Where`.

### Changes Required:

#### 1. The panel

**File**: `src/components/investments/investment-summary-panel.tsx`

**Intent**: Drop the `statsWhere`, `filtersActive`, `financials` and `netCategoryCosts` props. Build
`{ investment: { equals: investmentId } }` locally and fetch `fetchFilteredByType` +
`fetchCategoryBreakdowns` against it alongside the existing tree fetch, then `deriveFinancials` with
`tree.materialsNetRate` / `tree.settlementMode`. Swap `fetchFilteredDepositTransactions(statsWhere)`
for `fetchDepositTransactionsForInvestment(investmentId)`. Pass `filtersActive={false}` nowhere — stop
passing it. Update the EX-600 scope-rule comment block (lines 16-24, 30-31, 111-112) to state the new
rule: this panel reports the whole investment; the transfers table's own „Suma wybranych transakcji"
owns the filtered reading.

**Contract**: Props become `{ investmentId, investmentName, canSeeMargin, expenseCategories }`. All
four fetches join the existing `Promise.all`. `canSeeMargin` still gates whether the locally derived
`financials` crosses into the client component at all — that is a role boundary, not a filter one, and
must survive intact.

#### 2. The page

**File**: `src/app/(frontend)/inwestycje/[id]/page.tsx`

**Intent**: Stop passing the four removed props at the `<InvestmentSummaryPanel>` call site
(lines 124-129). Delete `const filtersActive = hasActiveTransferFilters(sp)` (line 51) and its import
(line 15). Leave `statsWhere`, `financials`, `financialFields`, `headerFields` and the v1 block
untouched — they still serve the export header and the v1 reading.

**Contract**: The panel call site keeps only `investmentId`, `investmentName`, `canSeeMargin`,
`expenseCategories`.

### Success Criteria:

#### Automated Verification:

- No reference to `statsWhere` or `filtersActive` survives in `src/components/investments/investment-summary-panel.tsx` or at the panel call site in `page.tsx`: `rg 'statsWhere|filtersActive' src/components/investments/investment-summary-panel.tsx src/app/\(frontend\)/inwestycje/\[id\]/page.tsx`
- The panel no longer imports `fetchFilteredDepositTransactions`: `rg 'fetchFilteredDepositTransactions' src/components/investments/`

#### Manual Verification:

- On an investment with a kosztorys, the Podsumowanie figures are identical before and after applying a transfers filter.
- The Materiały/Wydatki tab totals are identical before and after applying a filter.
- The Marża tab figures are identical before and after applying a filter, and remain hidden for a MANAGER.
- Wpłaty on the investment page matches Wpłaty on the same investment's `kosztorys_v2` page.
- An investment with **no** kosztorys rows still renders the transaction-plane fallback reading without error.

**Implementation Note**: When this phase's automated verification passes, commit and continue — do not
pause for per-phase manual confirmation.

---

## Phase 2: Strip the scope-marker apparatus

### Overview

With nothing able to set `filtersActive`, delete the marker, the footnote, the prop chain, and unmute
the two verdicts.

### Changes Required:

#### 1. The marker itself

**File**: `src/components/kosztorys/summary/scope-marker.ts` — delete the file.

**File**: `src/components/kosztorys/summary/grid/summary-row.tsx`

**Intent**: Remove the `scopeMarked` option (line 29 + its comment at line 28) and the `<sup>` block it
gates (lines 66-70), plus the `SCOPE_MARKER_HINT` import.

**Contract**: `SummaryRowOptsT` loses `scopeMarked`.

#### 2. The tables and blocks

**File**: `src/components/kosztorys/summary/tables/summary-breakdown-table.tsx`

**Intent**: Remove the `scopeMarked` prop (lines 29, 47) and its three pass-throughs (lines 60, 69, 84).
The comment at line 45 explaining why Materiały is deliberately unmarked describes a distinction that
no longer exists — delete it.

**File**: `src/components/kosztorys/summary/tables/summary-totals-table.tsx`

**Intent**: Remove the `scopeMarked` prop (lines 21, 30) and its pass-through (line 58).

**File**: `src/components/kosztorys/summary/blocks/mixed-summary.tsx`

**Intent**: Remove the `filtersActive` prop (lines 25, 41) and all seven `scopeMarked` pass-throughs.

**File**: `src/components/kosztorys/summary/blocks/brutto-netto-summary.tsx`

**Intent**: Remove the `filtersActive` prop (lines 61-63, 82) and both `scopeMarked` pass-throughs
(lines 139, 148). Reduce `reconVisible` (line 96) to `!preview && priceView === 'client'`.

**Contract**: `reconVisible = !preview && priceView === 'client'`. `showRabat` (lines 100-102) reads
`reconVisible` and so changes with it — that is intended: the force-show rule now applies whenever the
scream is visible, which is now filter-independent.

#### 3. The tab and the panel content

**File**: `src/components/kosztorys/summary/tabs/summary-overview-tab.tsx`

**Intent**: Remove the `filtersActive` prop (lines 52-54, 78) and both pass-throughs (lines 104, 120).
Reduce the `SettlementPlaneWarning` gate (line 90) to `!preview && settlementVerdict.mismatch`.

**File**: `src/components/kosztorys/summary/summary-panel-content.tsx`

**Intent**: Remove the `filtersActive` prop (lines 106-108, 159), its pass-through to the overview tab
(line 298), the footnote block (lines 331-339) and the `SCOPE_MARKER_FOOTNOTE` import (line 19).

**Contract**: `SummaryPanelContentPropsT` loses `filtersActive`. The `TriangleAlert` import stays only
if another block still uses it — otherwise remove it too.

### Success Criteria:

#### Automated Verification:

- The apparatus is gone tree-wide: `rg 'scopeMarked|filtersActive|SCOPE_MARKER' src` returns nothing
- `src/components/kosztorys/summary/scope-marker.ts` no longer exists

#### Manual Verification:

- No asterisk appears on any row of the Podsumowanie table, in any money axis (netto / brutto / mieszany).
- The red „Pola oznaczone gwiazdką…" footnote is gone.
- On an investment whose kosztorys robocizna disagrees with its LABOR_COST transfers, the mismatch scream renders even with a transfers filter applied.
- `SettlementPlaneWarning` renders on a mismatching investment with a filter applied.
- The client-share preview (`preview`) still suppresses both the scream and the plane warning.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Delete the dead filter plumbing

### Overview

`hasActiveTransferFilters` and its whitelist lost their only caller in Phase 1. Remove them so nothing
survives as untyped-dead surface.

### Changes Required:

#### 1. The query helper

**File**: `src/lib/queries/transfer-filters.ts`

**Intent**: Delete `TRANSFER_FILTER_PARAMS` (lines 189-203) and `hasActiveTransferFilters`
(lines 212-224), including the doc comments explaining the raw-searchParams contract. `buildTransferFilters`
and `stripCancelledFilters` stay — the transfers table depends on both.

**Contract**: The module's exports reduce to `buildTransferFilters` and `stripCancelledFilters`.

#### 2. The spec

**File**: `src/__tests__/lib/queries/transfer-filters.test.ts`

**Intent**: Delete the `describe('hasActiveTransferFilters')` block (lines 77-100) and drop the symbol
from the import (line 4). The `buildTransferFilters` coverage in the same file stays.

**Contract**: The file's remaining suites pass unchanged.

### Success Criteria:

#### Automated Verification:

- The symbol is gone tree-wide: `rg 'hasActiveTransferFilters|TRANSFER_FILTER_PARAMS' src`
- The remaining spec passes: `pnpm exec vitest run src/__tests__/lib/queries/transfer-filters.test.ts`

#### Manual Verification:

- The transfers table's own filtering, pagination, „Suma wybranych transakcji" tile and CSV/print export are unaffected on the investment page.
- The same filters still work on `/pracownicy/[id]`, `/raporty` and `/kasa/[id]`, which share `buildTransferFilters`.

---

## Testing Strategy

**No new automated tests.** Decided during planning: this is a deletion plus a fetch-scope swap, no
spec exists today for any of the touched components, and a "no asterisk rendered" assertion would pin
the implementation rather than a behavior worth protecting. Typecheck is the gate — every removed prop
is a compile error at each stale call site, which is exactly the coverage this shape of change needs.

The only test change is subtractive: the `hasActiveTransferFilters` block goes with its subject.

### Manual Testing Steps:

1. Open an investment with a kosztorys and note the Podsumowanie, Materiały/Wydatki and Marża figures.
2. Apply a transfers filter (type, date range, category) and confirm every panel figure is byte-identical.
3. Confirm „Suma wybranych transakcji" appears under the table and reflects the filter.
4. Confirm no asterisks and no red footnote anywhere in the panel.
5. Compare Wpłaty here against the same investment's `kosztorys_v2` page — they must match.
6. Open an investment with no kosztorys rows; confirm the fallback reading renders.
7. On a mismatching investment, confirm the recon scream and `SettlementPlaneWarning` render with a filter applied.

## Performance Considerations

A v2 render now issues two extra queries (`fetchFilteredByType` + `fetchCategoryBreakdowns` on the
unfiltered `Where`) because the page still fetches the filtered pair for the export header. Both are
`unstable_cache`d under `CACHE_TAGS.transfers` and the panel is already behind `<Suspense>`, off the
critical path. When no filter is active the two `Where` objects differ only by the absence of filter
keys, so they occupy separate cache entries — accepted rather than optimized away.

## Whole-tree Gate

Run once, after Phase 3.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`
- Build succeeds: `pnpm build`

## References

- Prior EX-600 work this reverses: `325bacec` (wpłaty follow the filters), `7225e90c` (mark
  unfilterable figures), `5ca646a9` (stop starring transaction-plane figures)
- The filtered surface that survives: `src/components/transfers/transfer-table-server.tsx:54`,
  `src/components/transfers/transfer-filters.tsx:223`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Panel goes filter-blind

#### Automated

- [x] 1.1 No `statsWhere` / `filtersActive` reference survives in the panel or at its call site — 956f09d6
- [x] 1.2 The panel no longer imports `fetchFilteredDepositTransactions` — 956f09d6

### Phase 2: Strip the scope-marker apparatus

#### Automated

- [x] 2.1 `rg 'scopeMarked|filtersActive|SCOPE_MARKER' src` returns nothing — 5bc89a25
- [x] 2.2 `scope-marker.ts` no longer exists — 5bc89a25

### Phase 3: Delete the dead filter plumbing

#### Automated

- [x] 3.1 `rg 'hasActiveTransferFilters|TRANSFER_FILTER_PARAMS' src` returns nothing
- [x] 3.2 `pnpm exec vitest run src/__tests__/lib/queries/transfer-filters.test.ts` passes
