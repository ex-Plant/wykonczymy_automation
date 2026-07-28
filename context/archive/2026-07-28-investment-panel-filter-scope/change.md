---
change_id: investment-panel-filter-scope
title: EX-600 — the v2 investment panel states which figures the URL filters can't reach
status: archived
created: 2026-07-28
updated: 2026-07-28
archived_at: 2026-07-28T20:26:14Z
branch: staging
worktree: null
---

## Notes

EX-600. On `/inwestycje/[id]` the v2 `InvestmentSummaryPanel` mixes filtered and unfilterable
figures without saying so. Decisions taken with the owner before planning:

- v1 „Finanse" (`FinancialStats`) is untouched — it keeps responding to the URL filters.
- v2 panel rule: transaction-plane figures follow the filters; kosztorys-plane figures cannot and
  won't.
- Wpłaty become filterable — the one figure the panel renders from an `investmentId`-keyed fetch
  instead of from `financials`. `fetchDepositTransactionsForInvestment` needs a `Where` seam, kept
  separate from the share-path call so no caller-supplied filter can reach the unauthenticated route.
- Wypłaty / materiały already respond here (they come off `financials`) — no work.
- Unfilterable fields get a `*`, with a single panel-level footnote rendered only while a filter is
  active. „Do zapłaty" inherits the star (one of its terms is kosztorys-plane). The reconciliation
  verdict was first meant to inherit it too; planning settled on suppressing it instead — a verdict
  is a claim, not a figure, and a starred false alarm is still a false alarm.
- "A filter is active" must read the raw `searchParams`, not `statsWhere` — `buildTransferFilters`
  always emits a default `type`/`cancelled` condition, so that object is never empty.

The ticket text itself is stale on three counts: its `stripCancelledFilters` mechanism predates
EX-574, its "needs the owner's call" blocker is resolved, and it misses both the wpłaty scope
regression (v1 filters it, v2 doesn't — same figure, same page) and the false reconciliation verdict
(kosztorys `sumaPracNet` compared against a filtered `financials.totalLaborCosts`).
