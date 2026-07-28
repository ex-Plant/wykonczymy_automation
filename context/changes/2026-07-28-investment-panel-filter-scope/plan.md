# EX-600 — the v2 investment panel states which figures the URL filters can't reach

## Overview

On `/inwestycje/[id]` the v2 `InvestmentSummaryPanel` mixes figures that respond to the URL transfer
filters with figures that structurally cannot, and says nothing about it. This change makes wpłaty
join the filtered side, marks every figure that can't follow a filter with a `*` plus one footnote
shown only while a filter is active, and silences the two verdicts that would otherwise be computed
across the filter boundary.

## Current State Analysis

`src/app/(frontend)/inwestycje/[id]/page.tsx:42-66` builds `financials` from
`stripCancelledFilters(buildTransferFilters(sp) + investment scope)` and passes it into
`InvestmentSummaryPanel`. The panel then fetches the kosztorys tree and the deposit rows itself,
keyed on `investmentId` alone. Result — three classes of figure on one screen:

| Figure                                                 | Source                                                | Responds to filters today               |
| ------------------------------------------------------ | ----------------------------------------------------- | --------------------------------------- |
| Suma prac wykonanych, Rabat, Robocizna (po rabacie)    | kosztorys tree                                        | no — nothing to filter on               |
| Materiały (+ the Wydatki breakdowns)                   | `financials`                                          | yes                                     |
| Marża waterfall (robocizna / wypłaty / rabat / strata) | `financials`                                          | yes                                     |
| Wpłaty                                                 | `fetchDepositTransactionsForInvestment(investmentId)` | **no — the defect**                     |
| Łącznie, „Do zapłaty"                                  | kosztorys + `financials` + wpłaty                     | partially (incoherent)                  |
| Mismatch scream (`reconciliation`)                     | kosztorys vs `financials`                             | partially — reports the filter as a gap |
| Tryb-mieszany verdict (`settlementVerdict`)            | deposit VAT planes                                    | no (today)                              |

The wpłaty case is a straight regression against v1: `FinancialStats` reads
`financials.totalIncome`, which is filtered, so flipping the reading toggle silently changes that
figure's scope.

### Key Discoveries

- `stripCancelledFilters` (`src/lib/queries/transfer-filters.ts:189`) strips **only** `cancelled` —
  EX-574 deliberately kept the `type` condition. The ticket's description predates that and is stale.
- `buildTransferFilters` always emits a default `type` / `cancelled` condition, so **`statsWhere` is
  never empty** — "is a filter active" must be derived from the raw `searchParams`, not from the
  built `Where`.
- `CANCELLATION` carries `financialBucket: 'none'` (`src/lib/constants/transfers.ts:88`) and
  `deriveFinancials` only sums named buckets — so the type condition contributes nothing to any panel
  figure either way.
- The deposit query `getDepositTransactionsForInvestment` (`src/lib/db/sum-transfers.ts:301`) is
  hand-written SQL with a fixed `WHERE`. The seam is `buildSqlConditions(where)` +
  `isNoResultsSentinel`, exactly as `sumFilteredByType` (`sum-transfers.ts:401`) already does it.
- The same deposit fetcher is on the unauthenticated share path (`src/lib/queries/preview-kosztorys.ts`,
  `(share)/k/[token]`) via `kosztorys_v2`'s call — a caller-supplied `Where` must never be able to
  reach it.
- `SummaryRow` takes a `ReactNode` label (`summary-totals-table.tsx:32-43` already passes a `<Link>`),
  so marking a row is a label concern, not a table rewrite.
- The Podsumowanie renders through **two** blocks depending on settlement mode — `BruttoNettoSummary`
  and `MixedSummary` (`summary-overview-tab.tsx:91-116`). Both show the starred figures.
- `showTransactionLists={false}` (`investment-summary-panel.tsx:99`) is set on this host only, so the
  wpłaty _list_ never renders here — wpłaty exists purely as a sum feeding „Do zapłaty".

## Desired End State

With no filter in the URL, the panel renders exactly as today. With any filter active:

- Materiały, marża, **and wpłaty** narrow to the filtered set.
- Suma prac wykonanych, Rabat, Robocizna, Łącznie and „Do zapłaty" carry a `*`.
- One footnote line sits at the foot of the Podsumowanie content explaining the `*`.
- The mismatch scream and the tryb-mieszany warning do not render.
- v1 „Finanse", the transfers table, its sum tile, the print/export header and `kosztorys_v2` are
  byte-identical to today.

## What We're NOT Doing

- Not touching v1 `FinancialStats` — it keeps responding to filters, by the owner's explicit call.
- Not changing `kosztorys_v2` or the client share read — neither route has URL filters.
- Not making the kosztorys tree filterable (impossible — kosztorys rows have no date/type/register).
- Not widening the payout or materiały transaction fetchers: on this host the panel drops the
  „Podwykonawcy" view entirely (`INVESTMENT_PANEL_VIEWS`) and the materiały list, so those unfiltered
  fetchers never run here.
- Not authoring the Playwright spec in this change (filed to the E2E backlog instead).
- Not rewriting the transfers table's own sum tile — EX-574 already gave it independent scope.

## Implementation Approach

Two orthogonal moves. First, close the one real scope hole (wpłaty) by giving the deposit query a
`Where` seam, exposed as a **separate** fetcher so the share path keeps its `investmentId`-only entry
point. Second, thread a single `filtersActive` boolean from the page into the panel and use it for
three things: the `*` markers, the footnote, and the two verdict suppressions. No figure is
recomputed twice, and nothing changes when no filter is set.

## Critical Implementation Details

**Do not derive `filtersActive` from `statsWhere`.** `buildTransferFilters` unconditionally writes
`type` and `cancelled` into the object, so it is never empty and the footnote would show permanently.
The predicate reads the raw `searchParams` keys.

**Cache-key collision.** The new filtered deposit fetcher must not reuse the existing
`['deposit-transactions', String(investmentId)]` key — a filtered result cached under an
investment-only key would poison `kosztorys_v2` and the share route.

---

## Phase 1: Filter-activity predicate

### Overview

A pure reader of `searchParams` answering "has the user set any transfer filter", living beside the
two existing readers of the same params.

### Changes Required:

#### 1. Predicate

**File**: `src/lib/queries/transfer-filters.ts`

**Intent**: Export `hasActiveTransferFilters(searchParams)` so any surface can ask whether the
current view is scoped, without re-deriving it from a built `Where`.

**Contract**: `(searchParams: SearchParamsT) => boolean`. True when any user-settable filter key
carries a value: `type`, `from`, `to`, `sourceRegister`, `investment`, `createdBy`, `paymentMethod`,
`expenseCategory`, `otherCategory`, `worker`, `amount`, `id`,
`cancelledTransactionAudit`. Pagination (`page`, `limit`) and the reading toggle
(`statsVersion`) are not filters — and neither is `showCancelled` (dropped at the review gate: the
condition is stripped before any stats query and a `CANCELLATION` carries no financial bucket, so
the toggle moves no panel figure). The key list is derived from the params `buildTransferFilters`
actually reads — keep the two in step, and add a comment saying so.

#### 2. Spec

**File**: `src/__tests__/lib/queries/transfer-filters.test.ts`

**Intent**: Guard the trap that makes this predicate exist.

**Contract**: Cases — empty params → false; `page`/`limit`/`statsVersion` only → false; a single
`type` → true; `from` alone → true; and the anchor case: `hasActiveTransferFilters({})` is false
while `buildTransferFilters({}, user)` is non-empty.

### Success Criteria:

#### Automated Verification:

- Unit spec passes: `pnpm exec vitest run src/__tests__/lib/queries/transfer-filters.test.ts`
- Type checking passes: `pnpm typecheck`

#### Manual Verification:

- None — pure function, fully covered by the spec.

---

## Phase 2: Wpłaty follow the filters

### Overview

Give the deposit query a `Where` seam and route the investment panel through it, while the
share/`kosztorys_v2` path keeps an entry point no caller filter can reach.

### Changes Required:

#### 1. Data-access layer

**File**: `src/lib/db/sum-transfers.ts`

**Intent**: One SQL builder for deposit rows, parameterized by `Where`, with the existing
investment-scoped function becoming a thin caller so the two can't drift.

**Contract**: `getDepositTransactions(payload, where: Where): Promise<DepositTransactionRowT[]>` —
same `SELECT`/`ORDER BY` and the same fixed `cancelled IS NOT TRUE` + `type = 'INVESTOR_DEPOSIT'`
guards, with `buildSqlConditions(where)` appended and an `isNoResultsSentinel(where)` early return of
`[]`. `getDepositTransactionsForInvestment(payload, investmentId)` keeps its signature and delegates
with `{ investment: { equals: investmentId } }`.

Note the intended interaction: a user filter of `type=PAYOUT` combined with the hardcoded
`type = 'INVESTOR_DEPOSIT'` yields zero rows — wpłaty correctly reads 0 under that filter.

#### 2. Query layer

**File**: `src/lib/queries/investment-transactions.ts`

**Intent**: A second cached fetcher for the filtered read, deliberately separate from the
investment-only one so the unauthenticated share path has no parameter to abuse.

**Contract**: `fetchFilteredDepositTransactions(where: Where)`, cached under
`['deposit-transactions-filtered', JSON.stringify(where)]` with `tags: [CACHE_TAGS.transfers]` —
a distinct key prefix from the existing `['deposit-transactions', String(investmentId)]`.
`fetchDepositTransactionsForInvestment` is unchanged.

#### 3. Panel wiring

**File**: `src/components/investments/investment-summary-panel.tsx`

**Intent**: The investment page's panel reads deposits at the page's scope instead of the whole
investment.

**Contract**: New required prop carrying the page's `statsWhere`; the `fetchDepositTransactionsForInvestment`
call becomes `fetchFilteredDepositTransactions(where)`. The header comment at lines 14-18 explaining
the dropped views is updated to name the new scope rule.

#### 4. Page wiring

**File**: `src/app/(frontend)/inwestycje/[id]/page.tsx`

**Intent**: Hand the panel the same `Where` the rest of the page's stats already use.

**Contract**: Pass `statsWhere` to `InvestmentSummaryPanel`. No change to `financials`, `headerFields`,
`totalPayouts`, or the v1 branch.

#### 5. Spec

**File**: `src/__tests__/lib/db/deposit-transactions.test.ts`

**Intent**: Prove the `Where` reaches the SQL and that the fixed guards survive it.

**Contract**: DB-backed spec (runs under `pnpm test:integration` against the 5435 container). Cases —
an investment-only `Where` returns the same rows as `getDepositTransactionsForInvestment`; a date
range narrows the set; a `type` filter excluding `INVESTOR_DEPOSIT` returns `[]`; a NO_RESULTS
sentinel returns `[]` without hitting the DB.

### Success Criteria:

#### Automated Verification:

- New DB spec passes: `pnpm exec vitest run src/__tests__/lib/db/deposit-transactions.test.ts`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- On `/inwestycje/<id>?from=<a date after the first wpłata>`, the panel's „Wpłaty" figure drops to
  the filtered subset and matches the wpłaty rows listed in the transfers table below it.
- `/inwestycje/<id>/kosztorys_v2` and the client share link still show the full wpłaty total.

---

## Phase 3: Scope marking

### Overview

Thread one boolean into the panel; use it to star the unfilterable figures, render the footnote, and
silence the two verdicts.

### Changes Required:

#### 1. Page → panel

**File**: `src/app/(frontend)/inwestycje/[id]/page.tsx`

**Intent**: Compute the scope flag once, at the only layer that can see the raw params.

**Contract**: `const filtersActive = hasActiveTransferFilters(sp)`, passed to
`InvestmentSummaryPanel` and forwarded to `SummaryPanelContent`. Not passed to the v1 branch.

#### 2. Panel content

**File**: `src/components/kosztorys/summary/summary-panel-content.tsx`

**Intent**: One optional prop that means "this host's transaction figures are scoped", defaulting off
so `kosztorys_v2` and the share read are untouched.

**Contract**: New optional prop (default `false`). When set: render the footnote line at the foot of
the scroll region, gated to the Podsumowanie view (the only view carrying stars); pass a scope flag
down to `SummaryOverviewTab`; suppress the tryb-mieszany warning (`summary-overview-tab.tsx:86`) and
the mismatch screams. Footnote copy is Polish UI, one line: „Pola oznaczone gwiazdką nie reagują na
filtry transakcji", in red with a `TriangleAlert` icon.

**Shipped deviation from the drafted contract**: the footnote was drafted for the pinned top bar
(whose fixed height would have constrained it to one non-wrapping line). It moved to the foot of the
content on the owner's call — a footnote reads as one _after_ the figures it qualifies, and the foot
has no height constraint.

#### 3. Starred rows

**Files**: `src/components/kosztorys/summary/grid/summary-row.tsx`,
`src/components/kosztorys/summary/tables/summary-breakdown-table.tsx`,
`src/components/kosztorys/summary/tables/summary-totals-table.tsx`,
`src/components/kosztorys/summary/blocks/brutto-netto-summary.tsx`,
`src/components/kosztorys/summary/blocks/mixed-summary.tsx`

**Intent**: Mark the rows that can't follow a filter, in both settlement-mode blocks.

**Contract**: `SummaryRow` gains an optional marker flag that renders a `*` after the label — one
implementation, so the marker can't be styled two ways. Marked rows: Suma prac wykonanych, Rabat,
Robocizna, Łącznie, „Do zapłaty". **Not** marked: Materiały, Wpłaty, and every row in the Marża and
Wydatki tabs. `MixedSummary` marks the same figures it renders.

#### 4. Verdict suppression

**Files**: `src/components/kosztorys/summary/tabs/summary-overview-tab.tsx`,
`src/components/kosztorys/summary/blocks/brutto-netto-summary.tsx`

**Intent**: A verdict computed across the filter boundary is a false alarm, not a scoped figure — so
it is withheld rather than starred.

**Contract**: Extend the existing gates rather than inventing a second mechanism — the
`!preview && settlementVerdict.mismatch` render condition and `BruttoNettoSummary`'s `reconVisible`
(`brutto-netto-summary.tsx:92`) each gain the scope flag. The verdict object itself is still computed
and passed; only its display is gated, matching how `preview` already works.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Existing panel specs still pass: `pnpm exec vitest run src/__tests__/components/kosztorys`

#### Manual Verification:

- `/inwestycje/<id>` with no filters: no `*`, no footnote, screams behave exactly as before.
- `/inwestycje/<id>?type=PAYOUT`: footnote visible in the top bar; Suma prac / Rabat / Robocizna /
  Łącznie / „Do zapłaty" starred; Materiały and Wpłaty unstarred and narrowed; no mismatch scream;
  no tryb-mieszany warning.
- Same URL with an investment in `MIXED` settlement mode — `MixedSummary` shows the same stars.
- `/inwestycje/<id>/kosztorys_v2` and the client share link show no stars and no footnote.
- Switching to the v1 reading with a filter active behaves exactly as before this change.

---

## Phase 4: Guards & close-out

### Overview

Full verification, the deferred browser coverage filed rather than dropped, and the docs that this
change makes factually wrong.

### Changes Required:

#### 1. E2E backlog issue

**Intent**: The cross-layer risk — a future refactor re-threading a filtered figure into the panel —
is only catchable in a browser, and this change deliberately doesn't author that spec.

**Contract**: Linear issue in project "Wykonczymy", label `e2e-backlog`: load `/inwestycje/<id>`
filtered and unfiltered, assert which panel figures move, that the footnote and stars appear, and
that the screams stay hidden. Record its id here and in `manual-checks.md`.

**Filed**: **EX-634** — https://linear.app/ex-plant/issue/EX-634

#### 2. Living docs

**Files**: `context/foundation/manual-checks.md`, `context/reference/kosztorys-editor-domain-notes.md`

**Intent**: Register the manual checks from Phases 2-3 and record the scope rule where the next
person will look for it.

**Contract**: Manual checks land in the registry per the project's convention. The domain notes gain
a short statement of the rule: on the investment page, transaction-plane figures follow the URL
filters, kosztorys-plane figures cannot, and cross-seam figures are marked.

#### 3. Ticket

**Intent**: EX-600's text is wrong on three counts and would mislead anyone reading it after this
lands.

**Contract**: Update EX-600 with the decisions taken (v1 unchanged; wpłaty filterable; star +
footnote; verdicts suppressed), correct the stale `stripCancelledFilters` mechanism, and note the two
defects it missed — the wpłaty scope regression and the false reconciliation verdict. Move to Done at
close-out.

### Success Criteria:

#### Automated Verification:

- Full unit suite passes: `pnpm test`
- Integration suite passes: `pnpm test:integration`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- The `e2e-backlog` issue exists and its id is recorded in the plan and the manual-checks registry — **EX-634**.

---

## Testing Strategy

### Unit Tests

- `hasActiveTransferFilters` — the empty-params-vs-non-empty-`Where` trap is the whole point.
- The filtered deposit query — `Where` reaches the SQL, the fixed `type`/`cancelled` guards survive,
  the NO_RESULTS sentinel short-circuits.

### Integration Tests

The deposit spec is DB-backed and runs against the isolated 5435 container via
`pnpm test:integration` (the pre-push gate), following the existing `src/__tests__/lib/db/` specs.

### Manual Testing Steps

1. `/inwestycje/<id>` unfiltered — panel identical to before the change.
2. Add `?type=PAYOUT` — stars + footnote appear, Wpłaty reads 0, screams gone.
3. Add a `from`/`to` range instead — Wpłaty narrows to deposits in range and matches the table below.
4. Flip to the v1 reading — unchanged behaviour.
5. Open `/inwestycje/<id>/kosztorys_v2` and the client share link — no stars, no footnote, full totals.

### Deferred to the E2E backlog

The browser-level assertion that the right figures move and the right ones don't — filed in Phase 4.

## Performance Considerations

No added queries. The filtered deposit fetch replaces the investment-scoped one at the same cache
tag; on an unfiltered visit its `Where` is the page's `statsWhere`, so it is one cache entry per
distinct filter combination rather than per investment. Acceptable — the same shape
`fetchFilteredByType` already has.

## References

- Ticket: EX-600 (`https://linear.app/ex-plant/issue/EX-600`)
- Decisions: `context/changes/2026-07-28-investment-panel-filter-scope/change.md`
- Prior art for scope-labelling a figure whose scope differs from the rows beside it: commit
  `27444def` (EX-574, the transfers sum tile)
- Prior art for a `Where`-parameterized cached aggregate: `src/lib/queries/transfer-totals.ts:13`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Filter-activity predicate

#### Automated

- [x] 1.1 Unit spec passes: `pnpm exec vitest run src/__tests__/lib/queries/transfer-filters.test.ts` — 7d69f875
- [x] 1.2 Type checking passes: `pnpm typecheck` — 7d69f875

### Phase 2: Wpłaty follow the filters

#### Automated

- [x] 2.1 New DB spec passes: `pnpm exec vitest run src/__tests__/lib/db/deposit-transactions.test.ts` — 325bacec
- [x] 2.2 Type checking passes: `pnpm typecheck` — 325bacec
- [x] 2.3 Linting passes: `pnpm lint` — 325bacec

### Phase 3: Scope marking

#### Automated

- [x] 3.1 Type checking passes: `pnpm typecheck` — 7225e90c
- [x] 3.2 Linting passes: `pnpm lint` — 7225e90c
- [x] 3.3 Existing panel specs still pass: `pnpm exec vitest run src/__tests__/components/kosztorys` — 7225e90c

### Phase 4: Guards & close-out

#### Automated

- [x] 4.1 Full unit suite passes: `pnpm test` — 33164e42
- [x] 4.2 Integration suite passes: `pnpm test:integration` — 33164e42
- [x] 4.3 Type checking passes: `pnpm typecheck` — 33164e42
- [x] 4.4 Linting passes: `pnpm lint` — 33164e42
