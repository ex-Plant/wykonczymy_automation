---
change_id: fleet-costs-window
title: Per-vehicle date window on karta pojazdu, plus an Opony column on the listing
status: archived
created: 2026-08-26
updated: 2026-08-26
archived_at: 2026-08-26T08:57:02Z
branch: staging # same call as fleet-sheet-parity: no branch switch for this change
worktree: null
---

## Notes

per-vehicle date window on karta pojazdu (?from=&to=, applies to BOTH the Przeglądy history and the
Koszty tab, does NOT inherit the listing's window on click-through) plus an Opony column on the
/flota listing

Owner's calls, 2026-08-26:

1. **No inheritance on click-through.** Filtering `/flota` to a window and clicking a car opens the
   card unfiltered, with its own empty picker. This keeps the EX-729 rule intact in spirit — the card
   never silently borrows the listing's window — while giving the card a window of its own.
2. **The window is a window in time for the whole card**, not just the Koszty tab: the Przeglądy
   history tables narrow to it too.
3. **Same `?from=&to=` vocabulary as the listing**, reusing `parseDateRange` and
   `components/filters/date-filters.tsx`. The tab toggle stays local state.

Opony: already rendered on karta pojazdu (`flota/[id]/page.tsx`, row „Opony") and already populated
by the sheet import — the gap is only the column on the `/flota` listing.

**Call #3 reversed, same day, by the owner: the card gets NO URL.** The `?from=&to=` vocabulary was
proposed on the assumption that the card's window works like the listing's. It does not:
`fetchVehicleDetail` runs no per-vehicle query (it filters one whole-fleet cache entry in memory) and
the card already ships its full history to a client component — so a server round-trip buys nothing and
costs a `markSeen` DB write per pick. The window is local state, like the tab toggle beside it.
Accepted consequences: a filtered card is not a shareable link, and the window resets on refresh.
