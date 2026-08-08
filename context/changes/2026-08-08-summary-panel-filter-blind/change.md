---
change_id: summary-panel-filter-blind
title: Make the v2 investment summary panel wholly filter-blind and delete the scope-marker apparatus
status: implementing
created: 2026-08-08
updated: 2026-08-08
branch: summary-panel-filter-blind
---

## Notes

Owner's ask: the summary panel's figures should stop reacting to the transfers table's URL filters,
and the whole asterisk apparatus that explained the half-reactive seam should go with them.

Premise correction made during shaping: Wpłaty was **not** the only filter-reactive figure. Materiały
and the entire Marża tab already followed the URL filters too, via the page's `financials`
(`fetchFilteredByType` / `fetchCategoryBreakdowns` on `statsWhere`). The asterisk marked the
_kosztorys-sourced_, filter-blind rows; the unstarred ones were the reactive ones. So the seam had
four rows on the reactive side, not one — which is why marking it was never going to get simpler.

The decisive argument for deleting rather than relabelling: **„Suma wybranych transakcji"**
(`transfer-filters.tsx:223`, server-derived in `transfer-table-server.tsx:54` from its own
`fetchFilteredByType`) already answers the filtered question, directly under the panel, and depends
on none of this wiring. The panel answering it a second time — in four half-reactive rows with a
footnote explaining which half — was the redundancy.

Side benefit: Wpłaty on the investment page and on `kosztorys_v2` currently disagree whenever a filter
is active. Both surfaces end up on `fetchDepositTransactionsForInvestment`, so they become one number.
