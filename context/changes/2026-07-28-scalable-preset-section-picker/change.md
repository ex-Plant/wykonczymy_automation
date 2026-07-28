---
change_id: scalable-preset-section-picker
title: „Dodaj sekcję z szablonu" scales past a dozen szablony — two panes, not one long list
status: implemented
created: 2026-07-28
updated: 2026-07-28
archived_at: null
branch: staging
worktree: null
---

## Notes

The picker is one flat cmdk list: every szablon's sekcje rendered inline, one `CommandGroup` per
szablon. Readable at two or three szablony; unreadable well before the library reaches the size the
owner expects ("I can easily imagine this going beyond 10 szablony", 2026-07-28). Folding the groups
only delays the wall — with 10+ collapsed groups you are still scrolling a list to find one name.

Target shape, two panes:

- **Left** — the szablony, with their own search. Row = name, sekcja count, and (when some are
  taken) a `3/10` progress figure. That count is also the answer to the partial-selection problem a
  single tick can't express: a half-selected szablon reads honestly as a number, so no tri-state
  control is needed.
- **Right** — the sekcje of the highlighted szablon, each tickable, with the per-szablon
  „Zaznacz wszystkie" row (shipped in `7ff77041`) moving here from the flat list.
- **Selection stays cumulative across szablony** — take three from one szablon and two from another,
  confirm once. The existing „Dodaj (N)" counter already works that way.

**The capability that must not be lost.** Two panes push you to pick a szablon first, which would
quietly kill what the flat list is actually good at: finding a sekcja when you don't remember which
szablon holds it. So the search box stays cross-szablon — typing switches the right pane to flat
results spanning every szablon, ignoring the left selection; clearing returns to browsing. Dropping
an existing capability is the more expensive mistake.

Two known consequences to plan for:

- the dialog has to grow past its current `sm:max-w-md`;
- a narrow screen can't render two panes — it becomes szablon list → drill in → back. This is the
  fiddly part of the work, not the two-pane layout itself.

**Constraint carried over from the current implementation:** cmdk only filters over _mounted_ items,
and this repo's `Command` wrapper defaults its filter to `foldFilter` (diacritic-folding). Any design
that unmounts rows breaks search — hence the "hide, don't unmount" rule the folding sketch needed,
and hence the flat-results mode above rather than a search that reaches into collapsed groups.

Context: this is the tail of EX-615 (`context/archive/2026-07-28-drop-empty-kosztorys-scaffold/`),
which retired the empty-editor dialog and its „Wypełnij z szablonu" CTA. `7ff77041` restored the
one-click whole-szablon load that retirement cost; this change is about the picker holding up as the
szablon library grows.
