---
change_id: scalable-preset-section-picker
title: „Dodaj sekcję z szablonu" scales past a dozen szablony — two panes, not one long list
status: archived
created: 2026-07-28
updated: 2026-07-28
archived_at: 2026-07-28T14:37:02Z
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

**Reversed during planning (owner, 2026-07-28):** the cross-szablon sekcja search above was dropped —
sekcja names repeat across szablony, so the flat results would be a list of identical names, and a
szablon's contents are predictable from its name. The shipped picker searches szablon names only. See
plan.md → „What We're NOT Doing".

**Constraint carried over from the current implementation:** cmdk only filters over _mounted_ items,
and this repo's `Command` wrapper defaults its filter to `foldFilter` (diacritic-folding). Any design
that unmounts rows breaks search — hence the "hide, don't unmount" rule the folding sketch needed,
and hence the flat-results mode above rather than a search that reaches into collapsed groups.

Context: this is the tail of EX-615 (`context/archive/2026-07-28-drop-empty-kosztorys-scaffold/`),
which retired the empty-editor dialog and its „Wypełnij z szablonu" CTA. `7ff77041` restored the
one-click whole-szablon load that retirement cost; this change is about the picker holding up as the
szablon library grows.

## Kept from the plan (deleted 2026-08-08)

- **cmdk was dropped, not worked around.** It earned its place on one flat list; with a name-only
  search and no right-pane search, its mounted-items-only filtering is pure constraint. That also
  retires the "hide, don't unmount" rule noted above — it existed only to keep cmdk's search working.
- **Left-pane order stays `created_at DESC`** — the just-saved szablon stays on top, and reordering
  solves nothing a name search doesn't.
- **Both panes always render; below the breakpoint Tailwind classes gated on a `pane` state hide one.**
  Chosen over a `useMediaQuery` hook to match the repo's pure-Tailwind responsive style, and so the
  narrow-screen phase adds classes rather than restructuring the desktop markup.
- **The assumption the sekcja search was cut on** — that users know which szablon holds the sekcja they
  want (owner: „these sections would almost never change", „the names would be repeated"). **If it
  turns out wrong, the cheap fix is a szablon row that lights up when one of its sekcje matches the
  name query** — right pane unchanged, no second search mode. Don't rebuild a cross-szablon flat
  results view.
- Diacritic folding landed in the shared `useSearchFilter`, which six tables use — the fold must only
  ever widen what matches.
