# Long-text cell overlay for the kosztorys grid — Plan Brief

> Full plan: `context/changes/kosztorys-note-cell-overlay/plan.md`

## What & Why

Long free text in the kosztorys grid can't be read. `textColumn` renders a single-line `<input>` in a
32px row, so a realistic opis — „szpachlowanie połaczeń ścian z gk i wklejanie taśmy wzmacniającej (
(łączenia pęknięć płyt, łączenia płyt gk etc.)" — shows about a quarter of itself and there is no way
to see the rest. Same for „komentarz".

## Starting Point

`DynamicDataSheetGrid` with a per-row `rowHeight` (32 for an item, 52 for a section band); heights are
never content-measured, so wrapping is impossible without an overlay. The two item text columns
`description` and `note` are stock `textColumn`, commit via `setRowData`, and are both already in
`ItemPatchT` — so persistence needs no change.

## Desired End State

Editing a text cell opens a textarea big enough to read and edit the whole value, sized so a realistic
opis fits without scrolling, committing through the column's existing path. Resting row height, grid
appearance, and copy-paste are unchanged.

## Key Decisions Made

| Decision                 | Choice                             | Why                                                                                           | Source  |
| ------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------- | ------- |
| Overlay mechanism        | In-cell absolute textarea          | Least machinery; `.dsg-cell` doesn't clip, and `disableKeys` is the library's sanctioned hook | Shaping |
| Rejected: Radix Popover  | No                                 | Portal + focus trap fights DSG's keyboard model                                               | Shaping |
| Rejected: per-row height | No                                 | Breaks uniform rows and grows every column in the row                                         | Shaping |
| Scope                    | „opis pracy" + „komentarz"         | Same pain in both; the Sekcja cell was cut on re-verification (see below)                     | Plan    |
| Enter semantics          | Enter commits, Shift+Enter newline | Matches Sheets and every other cell in the grid                                               | Plan    |
| Hover-to-read            | Deferred                           | Owner wants an eyeball test of the overlay alone first                                        | Shaping |
| E2E                      | File to `e2e-backlog`              | No kosztorys editor fixture exists; building one dwarfs the change                            | Plan    |

## Scope

**In scope:** a generic `src/components/ui/datasheet-grid/long-text-cell.tsx`; adoption by
`description` and `note`.

**Out of scope:** the `sectionName` cell (see below), hover-to-read, per-row expansion, any
persistence/autosave change, a new E2E fixture.

## Architecture / Approach

One presentational cell that knows nothing about the domain: it takes `value` and `onCommit(next)`.
Each column supplies its own `onCommit` — `setRowData` for the item columns, `onRenameSection` for the
section column — so the branching lives at two wiring sites rather than inside the component. Columns
are built by spreading `textColumn` (the existing `floatColumnLeft` idiom), which inherits
copy/paste/delete for free.

## Phases at a Glance

| Phase                          | What it delivers                          | Key risk                                                                                    |
| ------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1. Cell + `description`/`note` | Overlay editing on both item text columns | Overlay stacking — rows are absolutely positioned siblings, so it needs an explicit z-index |

Phase 2 (migrating `sectionName` onto the generic cell) was **dropped on re-verification 2026-08-10**:
`SectionNameCell` now has a second consumer — `section-header-cell.tsx` renders it inside the section
band row — so it can't just be deleted, and an overlay buys nothing for a short name in a 52px row.

**Prerequisites:** none — no migration, no env, no new dependency.
**Estimated effort:** one session.

## Open Risks & Assumptions

- Assumes an overlay on a row near the grid's bottom edge stays usable; `.dsg-container` is
  `overflow: auto`, so it may extend the scroll area slightly. Covered by a manual check.

## Success Criteria (Summary)

- A full-length opis is readable and editable without leaving the grid
- The grid looks and behaves exactly as before when no cell is being edited
