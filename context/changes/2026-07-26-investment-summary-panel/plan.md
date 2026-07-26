# Investment Summary Panel Implementation Plan

## Overview

Replace the investment detail page's financial tile block with the kosztorys Podsumowanie panel
(Podsumowanie + Wydatki + Wpłaty views), keep the v1/v2 reading toggle by moving it inside the panel's
top bar, and lift the company-plane figures (Marża / Wypłaty / Strata / Rozliczone R+M) into a separate
owner-only strip above it.

This is a **reuse-and-strip** change. Every block, table, pie and money helper the panel needs already
exists and is already rendered on `/inwestycje/[id]/kosztorys_v2` and on the public client share route.
The work is: pull the panel's content out of its editor-glued overlay shell, let a host restrict which
views render, strip two tabs down, and mount the result. Almost no new components.

## Current State Analysis

**The investment page** (`src/app/(frontend)/inwestycje/[id]/page.tsx`) fetches `fetchReferenceData`,
`fetchFilteredByType`, `fetchCategoryBreakdowns`, derives `financials` (`:58`), and renders
`InvestmentStatsVersions` behind `<Suspense>` (`:96-113`) with the bare v1 tile block as fallback.
`InvestmentStatsVersions` (`src/components/investments/investment-stats-versions.tsx`) awaits the
kosztorys tree, computes `kosztorysClientTotals`, and pairs the two readings through
`StatsVersionToggle` (plain `useState`, deliberately unpersisted — `stats-version-toggle.tsx:29`).

**The panel** (`src/components/kosztorys/summary/kosztorys-totals-panel.tsx:102`) takes 21 plain props.
Its overlay contract is a single className at `:177`
(`absolute inset-x-0 bottom-0 … h-0 … data-[state=open]:h-full`), with `Collapsible.Content forceMount`
at `:179` as the shell/content seam. Everything from `:183` down — the pinned top bar (`:186-208`) and
`SummaryScrollRegion` (`:209-275`) — is portable.

**Data delta is one query.** Diffing the panel's props for the three views in scope against what the
investment page already computes:

| Panel prop                                                                                                                                   | Source on the investment page                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `materialsGrossBase`, `materialsNetBilled`                                                                                                   | `deriveFinancials` (`page.tsx:58`)                                                                                       |
| `materialyBreakdown`                                                                                                                         | `buildMaterialyBreakdown(financials, refData.expenseCategories, breakdowns.netCategoryCosts)`                            |
| `laborCostsNetFromKosztorys`, `rabatAmount`                                                                                                  | `kosztorysClientTotals(rows, tree.stages, tree.globalDiscount)` — already computed at `investment-stats-versions.tsx:48` |
| `reconciliation`                                                                                                                             | `buildKosztorysReconciliation` — pure, both inputs present                                                               |
| `vatRate`                                                                                                                                    | on the investment                                                                                                        |
| `wplatyNet`, `depositTransactions`                                                                                                           | **missing** — needs `fetchDepositTransactionsForInvestment`                                                              |
| `stages`, `stageTotals`, `totalNet`, `subcontractorDue`, `payoutsByWorker`, `payoutTransactions`, `materialTransactions`, `sectionSubtotals` | n/a — feed views not in scope                                                                                            |

**Editor-context coupling is one component.** `useKosztorysEditorContext` has exactly three consumers
under the panel: `summary-settings-bar.tsx:42-49`, `summary-stages-tab.tsx:38`,
`subcontractor-summary.tsx:107`. Robocizna and Podwykonawcy are out of scope, so only
`SummarySettingsBar` — rendered unconditionally for non-clients at `summary-overview-tab.tsx:109` —
must become opt-in, or it throws outside the provider.

**„Nie określono" already exists.** `deposits-table.tsx:53-57` builds all three Razem buckets
(`NET` / `GROSS` / `null`) and `:24-26` documents them as display-only — `bucketDepositsByPlane`
(`summary-economics.ts:201`) still folds unmarked into `paidNet` per the owner's 2026-07-23 ruling.

**No skeleton primitive exists** anywhere in `src/` (no `Skeleton` component, no `animate-pulse`).

## Desired End State

On `/inwestycje/[id]`, below the info list:

1. An owner-only strip of `StatButton` tiles — Marża, Wypłaty, Strata (only when non-zero), and one
   tile per settled R+M category.
2. The summary panel in a `CollapsibleSection`, with a top bar carrying the view toggle
   (Podsumowanie / Wydatki / Wpłaty), the v1/v2 reading toggle, and `ZeroVatWarning`.
   - **Podsumowanie** — the settlement table (+ waterfall) and the „Struktura kosztów" pie. No
     `SummarySettingsBar`: VAT and rabat globalny stay editable in the editor only.
   - **Wydatki** — the per-expense-category `MaterialsBreakdownTable` and „Struktura wydatków" pie.
     No transaction list.
   - **Wpłaty** — the three Razem buckets (netto / brutto / nie określono) and the udział pie. No
     per-deposit list.
3. The transfers table below, unchanged.

`FinancialStats` / `ToggleStatButtons` are no longer rendered on this page but remain intact for
`/raporty`. The editor and the public client share route render exactly as they do today.

Verify by loading `/inwestycje/<id>` and the editor side by side: for the same investment on the same
axis, every figure in Podsumowanie matches between the two surfaces, and `/k/<token>` still renders all
five views.

### Key Discoveries

- Shell/content seam is `kosztorys-totals-panel.tsx:179` (`Collapsible.Content forceMount`); the whole
  overlay contract is the className at `:177`.
- `financialsFromKosztorys` (`kosztorys-driven-financials.ts:15`) swaps exactly two figures —
  `totalLaborCosts` and `totalRabat` — and has one call site.
- The panel already remaps a persisted-but-hidden view back to a visible one
  (`kosztorys-totals-panel.tsx:133-136`); the `views` allowlist generalizes that existing logic.
- `brutto-netto-summary.tsx:95` gates the reconciliation scream on
  `clientView ? false : priceView === 'client'`. `priceView="client"` is already hardcoded at
  `kosztorys-totals-panel.tsx:229`, so a host gets the scream for free by passing `reconciliation`.
- `print-button.tsx:24-36` passes all `headerFields` through when the visibility store is empty, so
  removing the tiles degrades the printout to a static bilans rather than breaking it.
- `/raporty/page.tsx:62-69` renders `FinancialStats` with the identical prop set — the component and
  `header-fields-store` both survive this change.

## What We're NOT Doing

- No new panel views: Robocizna (etapy) and Podwykonawcy stay editor-only. The mnożnik ceny control
  does not come along.
- No `MaterialsTransactionsTable` and no `DepositsTable` row list on the investment page — the
  transfers table below already lists every transaction.
- No VAT / rabat globalny editing from the investment page.
- No change to the settlement math: „nie określono" stays display-only, `bucketDepositsByPlane`
  untouched.
- No namespacing of the panel's `localStorage` keys — the two surfaces share view and
  materials-pricing state deliberately.
- No carry-over of the „odznacz kafelek → wypada z bilansu i z wydruku" behaviour, and no PDF work.
- No change to `FinancialStats`, `ToggleStatButtons`, or `header-fields-store` — `/raporty` keeps them.
- No E2E in this change.

## Implementation Approach

Split the shell from the content so one component tree serves three hosts (editor overlay, client
share, investment page), driven by a `views` allowlist plus the existing `clientView` flag. Make the
two editor-only behaviours opt-in props rather than implicit. Then mount, wire the one missing query,
and move the v1/v2 toggle into the panel's top bar as a slot whose state lives in a thin client wrapper
on the investment page.

## Critical Implementation Details

**Prerequisite ordering.** This plan assumes `2026-07-26-investment-settlement-mode` has merged to
`staging`: `investment.settlementMode` exists and `use-summary-axis.ts` is deleted. Without it the
panel's axis is still a shared `localStorage` key and mounting a second surface makes both pages share
it. Do not start Phase 3 before that branch lands.

**The reconciliation scream is a prop, not panel logic.** It is computed in the editor body
(`kosztorys-editor-body.tsx:211-219`) and passed down, so the investment page must build its own
verdict with `buildKosztorysReconciliation`. That is the host's whole obligation — `priceView="client"`
is already a hardcoded literal inside the panel (`kosztorys-totals-panel.tsx:229`), not a prop, so
there is nothing for a host to pass. What suppresses the scream downstream is `clientView`
(`brutto-netto-summary.tsx:95`).

**No skeleton exists.** The Suspense fallback reuses the pattern already at `page.tsx:96-105`: the same
panel content rendered on the v1 (transaction) reading with the reading toggle omitted, swapped for the
toggle-enabled version once the tree resolves.

---

## Phase 1: Split the shell from the content

### Overview

Carve the portable content out of `KosztorysTotalsPanel` and let a host restrict which views render,
without changing what the editor or the client share route display.

### Changes Required

#### 1. New portable content component

**File**: `src/components/kosztorys/summary/summary-panel-content.tsx`

**Intent**: Hold everything below the shell seam — the pinned top bar, `SummaryScrollRegion`, the tab
dispatch, and the derivations currently inlined in the panel (`bucketDepositsByPlane`,
`computeDoZaplatyRM`, the materials pair, `useSummaryView`, `useMaterialsNetPricing`). This is a move,
not a rewrite.

**Contract**: Takes the current `PropsT` of `KosztorysTotalsPanel` minus `open`/toggle concerns, plus:

- `views?: SummaryViewT[]` — allowlist, default all five.
- `topBarSlot?: ReactNode` — rendered in the pinned top bar beside the view toggle (Phase 4 uses it).
- `showSettingsBar?: boolean` — default `false`; the editor passes `true`.

Every prop that feeds only a non-default view (`stages`, `stageTotals`, `totalNet`, `subcontractorDue`,
`payoutsByWorker`, `payoutTransactions`, `materialTransactions`, `sectionSubtotals`) becomes optional.

The persisted-view fallback at `kosztorys-totals-panel.tsx:133-136` generalizes: a persisted view
outside the effective allowlist (`views` minus `podwykonawcy` when `clientView`) falls back to the
first allowed view rather than hardcoding `summary`.

#### 2. The shell keeps only the overlay

**File**: `src/components/kosztorys/summary/kosztorys-totals-panel.tsx`

**Intent**: Reduce to `useTotalsPanelOpen` + `Collapsible.Root` + `Collapsible.Content forceMount`
wrapping `<SummaryPanelContent />`. The className at `:177` stays here and nowhere else.

**Contract**: Public props unchanged, so `kosztorys-editor-body.tsx:282-303` and the client share route
need no edit beyond `showSettingsBar`.

#### 3. Settings bar becomes opt-in

**File**: `src/components/kosztorys/summary/tabs/summary-overview-tab.tsx`

**Intent**: `SummarySettingsBar` is the only editor-context consumer reachable from the in-scope views;
rendering it outside `KosztorysEditorProvider` throws. Make it explicit instead of implicit.

**Contract**: Replace `{!clientView && <SummarySettingsBar />}` at `:109` with a `showSettingsBar`
prop threaded from the content component. `clientView` keeps forcing it off.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit tests pass: `pnpm exec vitest run`

#### Manual Verification

- The editor panel at `/inwestycje/<id>/kosztorys_v2` opens, collapses, and renders all five views exactly as before, including the settings bar.
- The public share route `/k/<token>` renders four views, no settings bar, no reconciliation scream.

**Implementation Note**: After completing this phase and all automated verification passes, pause for
manual confirmation before proceeding.

---

## Phase 2: Strip the two reused tabs

### Overview

Let Wydatki render without its transaction list and Wpłaty without its per-deposit rows, keeping the
existing totals, captions and pies.

### Changes Required

#### 1. Wydatki without the transaction list

**File**: `src/components/kosztorys/summary/tabs/summary-expenses-tab.tsx`

**Intent**: The transfers table on the investment page already lists every materiały transaction, so
the in-panel list is redundant there.

**Contract**: `showTransactions?: boolean` (default `true`) gating the `MaterialsTransactionsTable`
block at `:108-113`. When `false`, `materialTransactions` and `investmentName` are unused.

#### 2. Wpłaty as totals only

**File**: `src/components/kosztorys/summary/tables/deposits-table.tsx`

**Intent**: Keep the three Razem buckets that already exist at `:53-57` / `:83-94`; drop the per-row
grid.

**Contract**: `totalsOnly?: boolean` (default `false`) skipping the list `SummaryTable` at `:67-81`.
The bucket computation and the display-only semantics documented at `:24-26` are untouched.

**File**: `src/components/kosztorys/summary/tabs/summary-deposits-tab.tsx`

**Intent**: Thread the flag through; the empty state, the „traktowane jako netto" caption and the
udział pie all stay.

**Contract**: `totalsOnly?: boolean` passed to `DepositsTable`.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm typecheck`
- Unit test: `DepositsTable` with `totalsOnly` renders three Razem buckets and no date rows — `pnpm exec vitest run src/__tests__/components/kosztorys/summary/deposits-table.test.tsx`

#### Manual Verification

- In the editor, Wydatki and Wpłaty are unchanged (both flags default to the current behaviour).

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 3: Mount the panel on the investment page

### Overview

Fetch the one missing query, build the panel's inputs from data the page already has, and render the
three-view panel where the tiles are today. The tiles stay in place until Phase 5 so the two readings
can be compared side by side during implementation.

### Changes Required

#### 1. The one new query

**File**: `src/app/(frontend)/inwestycje/[id]/page.tsx`

**Intent**: `wplatyNet` and the plane buckets both derive from the deposit rows, which this page does
not fetch. Add the same cached fetcher the kosztorys page uses so both surfaces read one source.

**Contract**: `fetchDepositTransactionsForInvestment(investmentId)` joins the existing `Promise.all`
at `:48-52`. `wplatyNet` = Σ `amount`, mirroring `kosztorys_v2/page.tsx:81`.

#### 2. The panel host replaces the stats-versions host

**File**: `src/components/investments/investment-summary-panel.tsx` (replaces
`src/components/investments/investment-stats-versions.tsx`)

**Intent**: The existing async server component already awaits the tree, runs `treeToRows` and
`kosztorysClientTotals`, and owns the no-rows case. Keep that spine; swap what it renders.

**Contract**: Same props plus `depositTransactions`, `wplatyNet`, `materialyBreakdown`,
`investmentName`, `vatRate`. Builds the reconciliation verdict with `buildKosztorysReconciliation` and
renders the client wrapper from Phase 4 with both readings. The `rows.length === 0` guard at
`investment-stats-versions.tsx:46` survives: no kosztorys rows ⇒ the panel renders on the v1 reading
with no toggle.

#### 3. Container and fallback

**File**: `src/app/(frontend)/inwestycje/[id]/page.tsx`

**Intent**: Reuse the page's existing section idiom rather than inventing chrome, and keep the tree
fetch off the critical path as it is today.

**Contract**: `CollapsibleSection` (the same primitive `TransfersSection` uses) wraps the panel. The
`<Suspense>` fallback renders `SummaryPanelContent` with the v1 figures and no `topBarSlot`. The
reconciliation scream needs only the `reconciliation` prop — `priceView` is hardcoded inside the panel
and must stay that way, so do not lift it into the content component's contract.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit tests pass: `pnpm exec vitest run`
- Build succeeds: `pnpm build`

#### Manual Verification

- For an investment with kosztorys rows, every Podsumowanie figure on `/inwestycje/<id>` matches the same figure in the editor panel on the same settlement mode.
- Wydatki shows the per-category breakdown and the pie, with no transaction list.
- Wpłaty shows exactly three Razem buckets and the udział pie, with no per-deposit rows.
- An investment with no kosztorys rows renders the panel on transaction figures with no reading toggle, not an all-zero panel.
- The panel appears without blocking first paint; the transfers table below still filters and paginates.

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 4: Move the v1/v2 reading toggle into the panel

### Overview

The reading toggle stops wrapping two rendered blocks and starts selecting two figures inside one
panel.

### Changes Required

#### 1. Thin client wrapper owning the reading state

**File**: `src/components/investments/investment-summary-panel-client.tsx`

**Intent**: The substitution is two numbers, so the toggle only needs to pick between two prop values
rather than swap two component trees.

**Contract**: `'use client'`, holds `useState<VersionT>('v1')`, renders `SummaryPanelContent` with
`laborCostsNetFromKosztorys` / `rabatAmount` taken from either `financials.totalLaborCosts` /
`financials.totalRabat` (v1) or `clientTotals.sumaPracNet` / `clientTotals.rabatClientNet` (v2) — the
same pair `financialsFromKosztorys` swaps. The `ToggleGroup` + `InfoTooltip` markup moves here from
`stats-version-toggle.tsx:34-40` and is passed down as `topBarSlot`.

#### 2. Retire the old toggle

**File**: `src/components/investments/stats-version-toggle.tsx` — delete once no importer remains.

**Intent**: Its only consumer was `investment-stats-versions.tsx`, which Phase 3 replaced.

**Contract**: Deletion gated on `pnpm typecheck`, not on grep.

**File**: `src/lib/kosztorys/kosztorys-driven-financials.ts`

**Intent**: Its single call site is gone. Keep it only if the wrapper still uses it to build the v2
figure pair; otherwise delete it in the same typecheck-gated pass.

**Contract**: Either one importer or none — no orphan.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm typecheck`
- Unit test: the reading toggle projects v1/v2 to the right robocizna + rabat pair — `pnpm exec vitest run src/__tests__/components/investments/investment-summary-panel-client.test.tsx`
- Linting passes: `pnpm lint`

#### Manual Verification

- Switching v1 ↔ v2 in the panel top bar changes only Robocizna and Rabat; Materiały and Wpłaty stay identical.
- The reconciliation scream still fires when the two readings disagree.

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 5: Owner strip, and retire the tiles from this page

### Overview

Move the company-plane figures out of the client settlement view and stop rendering the tile block on
the investment page.

### Changes Required

#### 1. Owner-only figure strip

**File**: `src/components/investments/investment-owner-figures.tsx`

**Intent**: Marża, Wypłaty, Strata and Rozliczone R+M belong to company profitability, not the client
settlement. Keeping them outside the panel means a gating mistake inside the panel can never leak
marża to a client.

**Contract**: Reuses `StatButton` (`src/components/ui/stat-button.tsx:15`) in a plain row — no
deselect, no summary. Renders Marża (`calculateMargin`), Wypłaty (`financials.totalPayouts`), Strata
only when non-zero (mirroring `financial-stats.tsx:111`), and one tile per `settledFields` entry under
the `SETTLED_TYPE` label. Role gating follows `financial-stats.tsx:138`. Tooltip copy is lifted from
`financial-stats.tsx:21-47` rather than rewritten.

#### 2. Tiles off the investment page

**File**: `src/app/(frontend)/inwestycje/[id]/page.tsx`

**Intent**: The panel now carries the client-facing figures and the strip carries the rest.

**Contract**: Drop the `FinancialStats` import and the tile fallback at `:96-105`; keep
`buildFinancialFields` — `headerFields` at `:69-72` still feeds the transfers table's export/print
config. `FinancialStats`, `ToggleStatButtons` and `header-fields-store` are untouched; `/raporty`
keeps them.

#### 3. Record the print degradation

**File**: `context/foundation/lessons.md` (or the change's own notes)

**Intent**: `print-button.tsx:24-36` now always takes the all-fields branch on this page, so the
printed bilans is static. That is accepted, not a bug — write it down so it is not "fixed" later.

**Contract**: One short entry naming `print-button.tsx:24-36` and the owner's ruling.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm exec vitest run`
- Build succeeds: `pnpm build`

#### Manual Verification

- `/inwestycje/<id>` shows the owner strip above the panel and no tile block.
- A MANAGER (non-owner) sees the panel but not Marża or Wypłaty.
- `/raporty` renders its tiles exactly as before, deselect included.
- Printing from the transfers table produces a header with all fields and a static bilans.

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Testing Strategy

### Unit Tests

- `SummaryPanelContent` view allowlist: a persisted view outside the allowlist falls back to the first
  allowed view; `clientView` still removes `podwykonawcy`.
- `DepositsTable` with `totalsOnly`: three Razem buckets present, no date rows, totals equal to the
  non-stripped render.
- The reading-toggle projection: v1 → `financials.totalLaborCosts` / `totalRabat`, v2 →
  `clientTotals.sumaPracNet` / `rabatClientNet`, and nothing else differs.

Specs live under `src/__tests__/` mirroring the source path, per `AGENTS.md`.

### Integration Tests

None. No new DB access beyond one existing cached fetcher already covered on the kosztorys page.

### Manual Testing Steps

1. Open `/inwestycje/<id>` and `/inwestycje/<id>/kosztorys_v2` side by side for an investment with
   kosztorys rows; compare every Podsumowanie figure on the same settlement mode.
2. Toggle v1 ↔ v2 in the panel top bar; confirm only Robocizna and Rabat move.
3. Switch to Wydatki and Wpłaty; confirm no transaction lists and three Razem buckets.
4. Open an investment with no kosztorys rows; confirm the transaction reading and no toggle.
5. Open `/k/<token>`; confirm all four client views render and no marża is visible anywhere.
6. Log in as MANAGER; confirm the owner strip is absent.
7. Print from the transfers table; confirm the header renders with a static bilans.

## Performance Considerations

One added cached query (`fetchDepositTransactionsForInvestment`) on a page that already runs three in
parallel. The kosztorys tree stays behind `<Suspense>` exactly as today, so first paint is unchanged.
`MaterialsTransactionsTable` — the panel's only virtualized table — is not mounted here.

## Migration Notes

None. The settlement-mode field and its migration belong to
`2026-07-26-investment-settlement-mode`, which lands first.

## References

- Change identity: `context/changes/2026-07-26-investment-summary-panel/change.md`
- Prerequisite: `context/changes/2026-07-26-investment-settlement-mode/plan.md`
- Panel shell seam: `src/components/kosztorys/summary/kosztorys-totals-panel.tsx:177-183`
- Existing reading pairing: `src/components/investments/investment-stats-versions.tsx:46-51`
- Three-bucket wpłaty split: `src/components/kosztorys/summary/tables/deposits-table.tsx:53-57`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Split the shell from the content

#### Automated

- [x] 1.1 Type checking passes
- [x] 1.2 Linting passes
- [x] 1.3 Unit tests pass

### Phase 2: Strip the two reused tabs

#### Automated

- [ ] 2.1 Type checking passes
- [ ] 2.2 `DepositsTable` totals-only unit test passes

### Phase 3: Mount the panel on the investment page

#### Automated

- [ ] 3.1 Type checking passes
- [ ] 3.2 Linting passes
- [ ] 3.3 Unit tests pass
- [ ] 3.4 Build succeeds

### Phase 4: Move the v1/v2 reading toggle into the panel

#### Automated

- [ ] 4.1 Type checking passes
- [ ] 4.2 Reading-toggle projection unit test passes
- [ ] 4.3 Linting passes

### Phase 5: Owner strip, and retire the tiles from this page

#### Automated

- [ ] 5.1 Type checking passes
- [ ] 5.2 Linting passes
- [ ] 5.3 Full unit suite passes
- [ ] 5.4 Build succeeds
