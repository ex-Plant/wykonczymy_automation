# Section group header rows in the kosztorys v2 grid — Plan Brief

> Full plan: `context/changes/2026-07-26-kosztorys-section-header-rows/plan.md`
> Linear: EX-580

## What & Why

The grid repeats every section's name on every one of its rows (325 rows, 14 values) while the
sections themselves are only hinted at by a colour rail. Replace the repetition with one **group
header row per section** — colour dot, name, item count, and the section's executed net — that also
collapses the block and owns the section's actions.

## Starting Point

The grid already renders two synthetic rows (a spacer and „Razem") through a single module-level
cell wrapper that short-circuits on a negative row id, and the hook already computes per-section
subtotals for the active price view. A precursor change gave each section a colour rail in the
sticky gutter plus a 2px divider above its first row, and fixed the palette order so neighbouring
sections never share a hue.

## Desired End State

Each section opens with a coloured band: `▸ ● Nazwa · 12 poz.` on the left, its wartość netto under
the money columns. The chevron collapses the block; double-click renames; the band's „…" menu holds
colour, insert, reorder and delete, and the per-row menu holds only „Prace". Item numbering runs
1…N continuously with unnumbered bands. Under a column sort the bands vanish and the table is flat.
The client-facing offer view shows the same bands, read-only.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Band content | Name + section's wartość netto | Reads the existing `subtotals`, so it can't drift from „Razem" or Podsumowanie |
| Band mechanism | A synthetic grid row, per-column content | Column alignment and horizontal scroll come free; no spanning hacks against dsg's absolute cells |
| „Sekcja" column | Kept, hidden by default | Owner's call — redundant beside the band, but still reachable in „Kolumny" |
| Under a sort | Bands disappear entirely | Grouping presumes section-contiguous rows; a sort breaks that, so a half-correct band is worse than none |
| Numbering | Continuous item numbers, bands unnumbered | The gutter answers "which position is this"; a band is not a position — needs a custom gutter column |
| Collapse | Yes, in this change | Owner's call; 14 bands make a 325-row kosztorys a readable table of contents |
| Collapse persistence | None (per mount) | A reading posture, not a setting; avoids a store and a restore-remount edge case |
| Section actions | Move onto the band | Two routes to one action is exactly the confusion being removed |
| Client view | Bands included | This is the layout the owner composes by hand in the sheet before sending an offer |
| Figure scope | Whole section, even when a search narrows the rows | Matches „Razem", which is full-dataset too |

## Scope

**In scope:** row-model module + unit spec; a third branch in the synthetic-row wrapper; the band
cell and its CSS; custom gutter numbering; collapse state; extracted section menu + inline rename;
`sectionName` default-hidden; client view; one Playwright spec.

**Out of scope:** deleting the „Sekcja" column; persisting collapse; any change to the figure math,
Podsumowanie, the pie chart or the export; drag-to-reorder; grouped sorting.

## Architecture / Approach

A band **is a totals row scoped to one section**. `buildSectionHeaderRows(viewRows, {collapsed,
enabled})` (pure, tested) returns the grid's row list plus the item ordinals; band rows take ids
`-1000 - sectionId`, keeping `id < 0` as the single "synthetic" test that `onChange` already filters
on. `withSyntheticRows` gains a third branch and passes per-section figures down `columnData` (never
a closure — a fresh component identity remounts a focused cell and drops keystrokes). The band's
cells paint per column: label under `description`, figure under `net`/`gross`, menu under `actions`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Row model | Pure assembly fn + unit spec | Ordinal/boundary rules subtler than they look |
| 2. Rendering the band | Bands visible with name + netto | dsg cell-identity trap; unlayered CSS |
| 3. Numbering & collapse | Continuous numbers, collapsible blocks | Custom gutter column must keep the rail's CSS hook |
| 4. Section actions | Menu + rename on the band, column hidden | Removing the row menu's section group must leave no orphan path |
| 5. Client view & E2E | Bands in the offer view, Playwright guard | E2E fixture must have multiple sections |

**Prerequisites:** none — no schema, no server action, no migration. Local dev DB + investment 42
(14 sections) and 7 (~1000 rows) for the visual passes.
**Estimated effort:** ~2 sessions across 5 phases.

## Open Risks & Assumptions

- Assumes rows stay section-contiguous outside an active sort (true today: `treeToRows` emits
  section blocks and `filterRows` preserves order). A future feature that reorders rows globally
  would need the same "no bands" treatment as sort.
- Collapse resets on reload and on a version restore (the body remounts). Accepted; revisit only if
  the owner asks for it to stick.
- A paste landing on a band is silently dropped by the existing `onChange` filter rather than
  blocked with a message — same behaviour „Razem" has today.

## Success Criteria (Summary)

- Every section reads as one block with its own total, without the name repeating on every row.
- A 325-row kosztorys collapses to 14 lines and back with no row loss and unbroken numbering.
- Section totals sum to „Razem" in every price view, and the offer view shows the same bands.
