---
change_id: client-preview-settings
title: Client preview settings — per-investment columns, firm-wide defaults, empty-row filter
status: archived
created: 2026-08-15
updated: 2026-08-17
archived_at: 2026-08-17T10:57:38Z
branch: client-preview-settings
worktree: null
---

## Notes

EX-695. The owner decides what the client sees and the choice is stored per investment, so the
token link renders it. Today the client view pins its columns in code (`PREVIEW_VISIBLE_COLUMNS`)
and clears the engaged row conditions under `preview`, while the owner's own preferences live in
`localStorage` — a different browser than the client's, so they could never travel.

Scope: client column visibility per investment (server-side), firm-wide defaults overridable per
investment, one „ukryj puste pozycje" filter (przedmiar = 0 **and** Σ etapów = 0, default on), and
the client view reading all of it. `PREVIEW_VISIBLE_COLUMNS` stays a ceiling — the owner may hide
more, never reveal subcontractor prices / marża / „komentarz".

Two entrances, one settings surface, one storage: „Widok klienta" (panel beside the preview render)
and „Udostępnij" (settings first, link after — **every** time, not a first-run wizard). Controls
render only on the authed entrance; `/k/<token>` gets the result.

One combined filter rather than the two that exist, because each existing one is safe for only one
of the two figures the client reads — a row empty on both axes contributes zero to both totals, so
no warning is needed. Full rationale on EX-695; don't re-derive it.

Out: hiding a section that has przedmiar; hand-hiding a single row (EX-549, cancelled). P13 (does
the client read Przedmiar or Pomiar z natury) stays open in
`context/reference/kosztorys-editor-domain-notes.md`.

**Archive note (2026-08-17):** `plan.md` was deleted at archive — its phase choreography is now the
shipped code, and its durable rationale (store the deviation, not a snapshot of the defaults; the
allowlist as a ceiling that fails closed) moved into `context/foundation/lessons.md`. `plan-brief.md`
stays: its decision table is the record of what the owner ruled and why. `git show <sha>^:<path>`
still reaches the deleted plan.
