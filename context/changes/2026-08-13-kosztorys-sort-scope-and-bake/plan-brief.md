# Zakres sortowania + utrwalanie całego kosztorysu — Plan Brief

> Full plan: `context/changes/2026-08-13-kosztorys-sort-scope-and-bake/plan.md`

## What & Why

EX-682 replaced the editor's flat sort with a within-sections one, because a flat sort scatters a
section's rows and the section bands presume contiguity. That was the right default but it removed a
real capability: seeing every praca in the kosztorys ordered as one list. This change brings the flat
sort back as a **named scope** you choose, and adds a whole-kosztorys variant of the „Utrwal
kolejność" write so one click bakes every section instead of one at a time.

## Starting Point

`V2SortStateT` is `{ field, dir } | null`, set in one place and read in one. Both sorting functions
already exist — `sortRows` (flat) survives as the per-group helper inside `sortRowsWithinSections`.
The bake path (planner → action → single `UPDATE … FROM (VALUES …)`) shipped in EX-683 and is
section-scoped by a guard that refuses the write if any submitted id belongs elsewhere.

## Desired End State

A column's header menu offers four sort commands with the scope in the label, plus clear. Within
sections keeps the bands; whole-kosztorys drops them and gives one flat list. Neither writes anything.
The row menu keeps „Utrwal kolejność" under „Sekcja" and gains „Utrwal kolejność w całym kosztorysie"
under a new „Kosztorys" group — one write, one undo. Under a whole-kosztorys sort both bake commands
are disabled and say why.

## Key Decisions Made

| Decision                           | Choice                                         | Why (1 sentence)                                                                                                                                          |
| ---------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persist the sort itself?           | No — nowhere, browser or DB                    | A stored sort rule is a live second authority over order: after ▲▼ and a reload it re-sorts the row back and the move silently evaporates.                |
| Auto-write a within-sections sort? | No — the write stays an explicit command       | The stored order can be a default the owner deliberately arranged, and a glance at „Pozostało" must not overwrite it.                                     |
| Persist a global sort?             | Impossible, so never offered                   | Its order interleaves sections, and `display_order` only expresses position within a section — baking it would mean re-filing prace under other sections. |
| Where the scope lives              | In the sort state, as `{ field, dir, scope }`  | Scope is a property of the active sort, so clearing the sort cannot leave a stale scope behind.                                                           |
| Menu shape                         | Four items with scope in the label, no submenu | Direction and scope in one gesture, and no mode you can forget you're in.                                                                                 |
| Placement of the new bake          | Its own „Kosztorys" group in the row menu      | The menu already uses labelled groups („Praca" / „Sekcja") as the only thing saying what a command's scope is.                                            |
| Whole-kosztorys write shape        | One action, one statement                      | A half-applied renumber leaves rows sharing an index — there is no unique constraint to catch it.                                                         |
| Section-scoped bake                | Kept, untouched                                | Useful when tidying one section without renumbering the rest.                                                                                             |

## Scope

**In scope:** sort scope in state + header menu; global scope suppresses the section bands; restored
`enabled` switch on `buildSectionBandRows`; whole-kosztorys planner, action and DB spec; new menu
group with undo; scope-dependent disabling of both bake commands.

**Out of scope:** persisting sort state anywhere; auto-writing a sort; any change to the section-scoped
bake; any change to what ▲▼ / „Wstaw" do under a sort (still disabled); schema changes.

## Architecture / Approach

The scope rides inside the sort state, so `reconcileSort` and every consumer flow through unchanged.
`viewRows` picks `sortRows` or `sortRowsWithinSections` off it; `buildSectionBandRows` gets its
pre-EX-682 kill switch back, keyed on `scope === 'global'` rather than on "any sort". The whole-
kosztorys bake reuses the EX-683 machinery end to end — `planSectionRenumber` run per section with the
refs concatenated, then `renumberDisplayOrder`, which already accepts an arbitrary id→index list under
the EX-632 lock discipline.

## Phases at a Glance

| Phase                      | What it delivers                                                | Key risk                                                                                                                                     |
| -------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Zakres sortowania       | Scope in state, four menu items, bands stand down under global  | The band kill-switch and its test were deleted in EX-682 — restoring them cleanly, not re-deriving them                                      |
| 2. Zapis całego kosztorysu | Planner + action + DB spec, no UI yet                           | `renumberDisplayOrderSchema` rejects duplicate indices, but a multi-section plan repeats 0 per section — must be relaxed or every bake fails |
| 3. Menu + undo             | „Kosztorys" group, single undo entry, scope-dependent disabling | Planning from `viewRows` instead of the full row set would renumber only filtered rows                                                       |

**Prerequisites:** branch `konradantonik/ex-682-sort-within-sections` (EX-682/EX-683) — this builds
directly on it and should branch from it, not from the integration branch.
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- The duplicate-`displayOrder` refinement in `renumberDisplayOrderSchema` is the one thing that fails
  the whole feature if read wrongly; phase 2 checks it before writing the action.
- Assumes a global sort's loss of section bands is acceptable rather than confusing — it is the same
  behaviour sorting had before EX-682, so it is a return to a known state, not a new one.
- Browser-level E2E is not authored for the predecessor slice either; the obligation carries.

## Success Criteria (Summary)

- Choosing a scope in the header menu visibly changes whether sections survive the sort.
- One click bakes every section's order, survives a reload, and undoes in one step.
- Nothing about a sort survives a reload — only a deliberate „Utrwal kolejność" does.
