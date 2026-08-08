# EX-600 — investment panel filter scope — Plan Brief

> Full plan: `context/changes/2026-07-28-investment-panel-filter-scope/plan.md`
> Decisions: `context/changes/2026-07-28-investment-panel-filter-scope/change.md`

## What & Why

The v2 summary panel on `/inwestycje/[id]` renders figures from two planes side by side — some follow
the URL transfer filters, some structurally cannot — and never says which is which. Filtering the
transfers table silently turns the panel into a partial ledger, and makes the reconciliation verdict
report the filter itself as a gap between the kosztorys and the transactions.

## Starting Point

`page.tsx` builds `financials` from the filtered `statsWhere` and hands it to the panel, which then
fetches the kosztorys tree and the deposit rows on its own, keyed by `investmentId`. So materiały and
marża narrow under a filter; wpłaty, robocizna, rabat and every kosztorys figure don't. Wpłaty is a
straight regression against v1, where the same figure (`financials.totalIncome`) does follow filters —
flipping the reading toggle changes its scope with no visible cause.

## Desired End State

Filtering the page narrows every transaction-plane figure in the panel, wpłaty included. Figures that
cannot follow a filter carry a `*`, explained by one footnote in the panel's top bar that appears only
while a filter is set. The two verdicts that compare across the two planes go quiet rather than
raising a false alarm. With no filter set, the panel is identical to today.

## Key Decisions Made

| Decision              | Choice                                                   | Why                                                                                            | Source |
| --------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------ |
| v1 „Finanse"          | Untouched — keeps following filters                      | That is the point of the filters on that section                                               | Owner  |
| v2 panel rule         | Transaction-plane follows filters; kosztorys-plane can't | Kosztorys rows carry no date/type/register — there is nothing to filter on                     | Owner  |
| Wpłaty                | Become filterable                                        | They are transaction rows; only a fetcher signature stopped them                               | Owner  |
| Unfilterable figures  | `*` + one footnote, shown only under an active filter    | A permanent asterisk on the common (unfiltered) case trains people to ignore it                | Owner  |
| Mismatch scream       | Suppressed under any filter                              | A verdict computed across the filter boundary is a false alarm, not a scoped figure            | Plan   |
| Tryb-mieszany verdict | Suppressed under any filter                              | Same class — a data-integrity warning, not a figure                                            | Plan   |
| Footnote placement    | Pinned top bar, beside the view toggle                   | A scope warning is worthless after the reader has already read the number                      | Plan   |
| Tests                 | Unit now, E2E filed to `e2e-backlog`                     | The silent-wrong-scope regression is catchable at the unit layer; the marker is presentational | Plan   |

## Scope

**In scope:** the deposit query's `Where` seam; the filter-activity predicate; `*` markers on Suma
prac / Rabat / Robocizna / Łącznie / „Do zapłaty" in both settlement-mode blocks; the footnote;
suppression of the two verdicts.

**Out of scope:** v1 `FinancialStats`; `kosztorys_v2` and the client share read (neither has filters);
the payout/materiały fetchers (their views don't render on this host); making the kosztorys tree
filterable; authoring the Playwright spec.

## Architecture / Approach

Two orthogonal moves. **(1)** `getDepositTransactions(payload, where)` becomes the single SQL builder,
with the existing `…ForInvestment` function delegating to it — and a _separate_ cached fetcher
`fetchFilteredDepositTransactions(where)` for the filtered read, so the unauthenticated share path
keeps an entry point with no filter parameter to abuse. **(2)** One `filtersActive` boolean, computed
at the page from the raw `searchParams`, threaded into `SummaryPanelContent` and used for all three
UI effects. No figure is computed twice; nothing changes when no filter is set.

## Phases at a Glance

| Phase                        | What it delivers                                 | Key risk                                                                                                   |
| ---------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 1. Filter-activity predicate | `hasActiveTransferFilters(searchParams)` + spec  | Deriving it from `statsWhere` instead — that object is never empty, so the footnote would show permanently |
| 2. Wpłaty follow the filters | `Where` seam on the deposit query, panel rewired | A filtered result cached under the investment-only key would poison `kosztorys_v2` and the share route     |
| 3. Scope marking             | Stars, footnote, verdict suppression             | Marking the wrong row — a `*` on a figure that _does_ follow the filter is a fresh lie                     |
| 4. Guards & close-out        | Full suite, `e2e-backlog` issue, docs, ticket    | The deferred E2E quietly never being filed                                                                 |

**Prerequisites:** local dev DB with an investment that has both kosztorys rows and wpłaty (`INV=6`
seed); the 5435 `db-test` container for the integration spec.
**Estimated effort:** ~1-2 sessions across 4 phases.

## Open Risks & Assumptions

- Assumes the footnote fits one line in the pinned top bar at the narrowest supported width — that
  bar's fixed height is load-bearing; the plan names the fallback placement if it doesn't.
- Cache entries for the filtered deposit read are now per filter-combination rather than per
  investment. Same shape `fetchFilteredByType` already has, so no new class of problem.
- Nothing guards which rows carry the `*` until the backlogged E2E lands.

## Success Criteria (Summary)

- Filtering the page narrows wpłaty along with materiały and marża, and the figure matches the wpłaty
  rows in the table below it.
- Every figure that can't narrow says so, once, where the reader sees it before the numbers.
- No mismatch scream or plane warning fires because of a filter.
