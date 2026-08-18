---
change_id: kosztorys-filters-visible-and-extended
title: Kosztorys filters made visible and extended — active-filter chips + more registry conditions
status: planned
created: 2026-08-18
updated: 2026-08-18
archived_at: null
branch: null
worktree: null
---

## Notes

Replaces the cancelled EX-693 (sheet-style per-column funnel). That scope split into two halves and
both lost: the "filter by condition" half duplicated the condition registry, broken into pieces and
hidden across 30 headers; the "filter by value" half is the only part the registry cannot express,
but only where the value domain is open and per-investment.

Two parts, one theme — they share the editor's filter state and the same menu:

1. **EX-713 — active-filter chips.** A chip row under the toolbar showing every source that hides
   rows (registry conditions, the engaged problem, collapsed sections, search), each removable in one
   click without opening a menu. Showing only some sources would be worse than nothing: the bar would
   claim "no filters" while the grid still hides rows.
2. **EX-714 — extend the condition registry.** Complementary pairs for discount, subcontractor-rate
   source (per plane), and note. Rule that came out of EX-693: a closed, hard-coded value domain is a
   registry condition, never a value picker.

**Dropped during planning: value filters (subcontractor / stage).** The third part died on its own
merits, not on cost. A stage carries exactly one `workerId` (grain owner-confirmed, EX-565), so the
stage column already IS the crew's column — a row filter adds a second axis to something that is
already an axis. Worse, for the commonest job on that screen — typing this week's progress for a crew
— "rows where crew X has qty > 0" hides precisely the rows where the new quantity goes. The one
scenario that survives, sending a crew its scope, is a saved, exported view, which is the offer-view
path and a different feature. Nothing to persist, so the persistence question died with it.

Standing rules carried over from the first instalment
(`context/archive/2026-08-14-kosztorys-filter-conditions/`): totals never follow the filter; counts
are computed over the whole kosztorys, not over the survivors; an active item filter suppresses
section folding.

Out of scope and still unfiled: **saved filter views** (named filter combinations).
