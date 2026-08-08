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

## Kept from the plan (deleted 2026-08-08)

- **Why the `*` appears only under an active filter**: a permanent asterisk on the common (unfiltered)
  case trains people to ignore it, so the marker would stop carrying information exactly when it
  finally mattered.
- **Footnote placement is the pinned top bar, beside the view toggle** — a scope warning is worthless
  after the reader has already read the number. Its one-line fit at the narrowest supported width is an
  assumption; that bar's fixed height is load-bearing.
- **Two fetchers, not one parameterised one.** `getDepositTransactions(payload, where)` is the single
  SQL builder and `…ForInvestment` delegates to it, but the filtered read gets its own cached entry
  point (`fetchFilteredDepositTransactions`) so the unauthenticated share path keeps a function with no
  filter parameter to abuse — and so a filtered result can never land under the investment-only cache
  key and poison `kosztorys_v2` or the share route. Cache entries for the filtered read are now per
  filter-combination, the same shape `fetchFilteredByType` already has.
- **Both verdicts are suppressed rather than starred** — the mismatch scream and the tryb-mieszany
  plane warning are data-integrity claims, not figures, and a starred false alarm is still a false
  alarm.
- **Nothing guards which rows carry the `*`** until the backlogged E2E lands — a `*` on a figure that
  _does_ follow the filter would be a fresh lie.
