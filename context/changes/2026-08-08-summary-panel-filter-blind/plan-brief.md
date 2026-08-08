# Filter-Blind Summary Panel — Plan Brief

> Full plan: `context/changes/2026-08-08-summary-panel-filter-blind/plan.md`

## What & Why

The v2 investment summary panel half-reacts to the transfers table's URL filters: Wpłaty, Materiały
and the Marża tab narrow with the filter, the kosztorys-sourced rows don't. An asterisk apparatus —
a marker component, a prop threaded through five components, and a red footnote — exists only to
explain that seam to the reader. The seam itself is the problem, not its labelling: „Suma wybranych
transakcji" directly under the panel already answers the filtered question and depends on none of
this. So the panel becomes wholly filter-blind and the apparatus goes.

## Starting Point

`page.tsx` builds `statsWhere` (URL filters + investment) and hands it to the panel twice over: once
directly for the deposit fetch behind Wpłaty, once through `financials` for Materiały and Marża.
`hasActiveTransferFilters(sp)` then threads `filtersActive` down five components to draw the asterisk
and to mute two cross-plane verdicts. A third state — no kosztorys rows, everything falls back to the
transaction plane — forces the marker off entirely, giving the current design three cases to keep
straight.

## Desired End State

Every figure in the panel reports the whole investment regardless of any URL filter. No asterisks, no
footnote, no `filtersActive` anywhere. Wpłaty finally agrees with the same investment's `kosztorys_v2`
page. The transfers table keeps its filters and its „Suma wybranych transakcji" tile untouched.

## Key Decisions Made

| Decision                    | Choice                                                                         | Why                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Scope of filter-blindness   | All three tabs — Podsumowanie, Materiały/Wydatki, Marża                        | Half-blind is what made the marker necessary; blinding one figure would have added asterisks, not removed them.                |
| Where unfiltered data lives | The panel self-fetches on a bare `{investment}` where                          | The file already declares it owns its fetches; drops four props, and `tree` already carries `deriveFinancials`' last two args. |
| The page's filtered fetch   | Stays                                                                          | `headerFields` feeds the CSV/print export header, which should describe the filtered table; v1 needs it too.                   |
| The two muted verdicts      | Render unconditionally                                                         | They were muted only because a filtered ledger made the comparison meaningless — that reason is gone.                          |
| Dead plumbing               | `hasActiveTransferFilters` + `TRANSFER_FILTER_PARAMS` deleted with their tests | This page was their only caller; an unused whitelist is a maintenance trap typecheck won't flag.                               |
| Regression guard            | None — typecheck is the gate                                                   | Pure deletion + a fetch swap; every removed prop is a compile error at each stale call site.                                   |

## Scope

**In scope:** `InvestmentSummaryPanel` self-fetching; Wpłaty on `fetchDepositTransactionsForInvestment`;
deletion of `scope-marker.ts`, all `scopeMarked` / `filtersActive` across six summary components, the
footnote, both verdict mutes, and `hasActiveTransferFilters` + its whitelist and tests.

**Out of scope:** the transfers table's filter machinery (`buildTransferFilters`, `where-to-sql`, the
filter UI, `transferWhere`); „Suma wybranych transakcji"; the v1 `FinancialStats` block and
`headerFields`; the kosztorys editor's own panel host; any new automated test.

## Architecture / Approach

Cut the data seam, then delete what described it, then what fed it. `InvestmentSummaryPanel` gains its
own `fetchFilteredByType` + `fetchCategoryBreakdowns` on `{investment:{equals:id}}` and calls
`deriveFinancials` with `tree.materialsNetRate` / `tree.settlementMode`, so the page hands it only
`investmentId`, `investmentName`, `canSeeMargin` and `expenseCategories`. Each phase compiles on its
own: after Phase 1 the downstream `filtersActive` props still exist but can no longer be true.

## Phases at a Glance

| Phase                       | What it delivers                                                      | Key risk                                                                                 |
| --------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1. Panel goes filter-blind  | Self-fetching panel; four props removed; Wpłaty unfiltered            | The no-kosztorys fallback reading now uses unfiltered `financials` — must still render.  |
| 2. Strip the scope-marker   | `scope-marker.ts` gone; six components cleaned; both verdicts unmuted | Verdicts that used to hide under a filter now appear — intended, but user-visible.       |
| 3. Delete the dead plumbing | `hasActiveTransferFilters` + whitelist + tests removed                | Shared query module — must not disturb `buildTransferFilters` / `stripCancelledFilters`. |

**Prerequisites:** none — all touched code is on `staging`.
**Estimated effort:** one session; ~10 files, overwhelmingly deletion.

## Open Risks & Assumptions

- A v2 render issues two extra cached queries, since the page still fetches the filtered pair for the
  export header. Accepted: both are `unstable_cache`d and the panel is behind `<Suspense>`.
- Unmuting the verdicts is a visible behavior change — a user who filtered for an unrelated reason may
  now see a mismatch warning that used to stay silent.
- No automated proof that the panel ignores filters; verified manually per the plan's steps.

## Success Criteria (Summary)

- Applying any transfers filter leaves every figure in all three panel tabs unchanged.
- No asterisk and no footnote appear anywhere in the panel.
- Wpłaty matches between the investment page and the `kosztorys_v2` page.
