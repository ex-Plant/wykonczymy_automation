---
change_id: netto-expenses-own-tab
title: Netto expenses get their own tab in the wydatki list, and the row links stop lying
status: archived
created: 2026-07-26
updated: 2026-07-26
archived_at: 2026-07-26T11:41:30Z
branch: konradantonik/netto-expenses-own-tab
worktree: null
---

## Notes

Dogfooding EX-567 surfaced two problems in the kosztorys v2 Podsumowanie → „Wydatki" view
(`src/components/kosztorys/summary/tables/materials-transactions-table.tsx`).

**1. Netto expenses have no tab of their own.** The per-category breakdown above the list already
splits them (`buildMaterialyBreakdown`, `src/lib/db/map-category-costs.ts:47-51` → a „‹kategoria›
netto" row, visible as its own pie slice). The transactions list below does not: `DATASET_OPTIONS`
offers only `unsettled` („Wydatki inwestycyjne") and `settled` („Materiały wliczone w robociznę"),
so a netto row sits among the brutto expenses marked only by a grey `netto ‹kwota›` sub-line.

**Owner ruling (2026-07-26): three mutually exclusive sets.** Netto rows _leave_ „Wydatki
inwestycyjne" for their own tab — not a filtered view that shows them under two tabs. Consequence,
accepted: Σ`billed` over the `unsettled` set no longer equals the breakdown's „Razem", so EX-567's
B5 („list == summary") has to be restated per tab rather than over one set. That is a guard edit,
not a design compromise.

**2. The row link is wrong for netto rows.** `getRowHref` hardcodes the type:

```
/inwestycje/${investmentId}?type=INVESTMENT_EXPENSE&id=${row.id}
```

`buildTransferFilters` turns that into `where.type = { in: ['INVESTMENT_EXPENSE'] }`, so clicking a
netto row lands on a list that filters that very row out. Same for the `CORRECTION` rows this list
also carries (`src/types/reference-data.ts:72`) — that half is pre-existing, the netto half is new
from EX-567. Root cause: `MaterialTransactionRowT` never carries the transfer type, so the href has
to guess it. Fix is to carry the type on the row and build the href from it — which is also what the
tab split needs, so the two changes share one data-layer edit.

The owner also called the link affordance „not obvious enough" — a bare whole-row href with no
visual cue. In scope.

**Owner ruling (2026-07-26, during the review gate): the netto tab gets two amount columns**,
„Brutto" then „Netto" — not one cell stacking both figures. Netto sits last so the tab's „Razem",
which sums `billed`, lands under the column it totals. Supersedes the plan's „netto leads, brutto
beneath it as a grey sub-line" (plan.md:56, :137-139) and the taller netto row height it needed.

**Owner ruling (2026-07-26, during implementation): the tab labels are „Materiały" / „Materiały
rozliczane netto" / „Materiały wliczone w robociznę"**, and both amount columns are headed plain
„Kwota" (`79669e58`). The plan's „Wydatki inwestycyjne" / „Wydatki netto" wording is superseded.

**Owner ruling (2026-07-26, during implementation): no chevron.** The trailing chevron column was
built in phase 3 and then removed on the owner's call — the affordance stays the shipped hover cue
(`data-table-row.tsx`). Phase 3's plan text still describes the chevron; the code is the authority.
