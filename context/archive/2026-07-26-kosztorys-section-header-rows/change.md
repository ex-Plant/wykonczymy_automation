---
change_id: kosztorys-section-header-rows
title: Group header row per section in the kosztorys grid, replacing the repeated „Sekcja" column
status: archived
created: 2026-07-26
updated: 2026-07-26
archived_at: 2026-07-26T12:33:20Z
branch: kosztorys-section-header-rows
worktree: ../wykonczymy-worktrees/kosztorys-section-header-rows
---

## Notes

Replace the repeated „Sekcja" column with a group header row per section (colour dot, name, item
count, section subtotal) in the kosztorys v2 grid.

Owner's ask, verbatim: "try the sections remake / divider with total for section wouldn't be bad".

Precursor, authored first but shipping **on this branch** (commit `8e131593`, plus
`src/scripts/seed-kosztorys-bands.ts` as the E2E fixture): sections are separated in the grid by a
colour spine in the gutter column + a 2px divider in the section's hue above its first row, and the
auto-assigned palette order now spreads hues so neighbouring sections never share one. It belongs to
no phase in `plan.md` — the band inherits both cues, so the two land together or not at all.

## Drift from the plan (recorded at the review gate; `plan.md` deleted 2026-08-08)

The shipped shape is the truth — this is where it differs from what was planned.

- **Rename gesture** is focus-to-edit (`useInlineRename`), not the double-click the plan's end state
  described. The gate additionally gave `useInlineRename` an untouched-draft guard, so focusing a
  name and leaving no longer writes.
- **Collapse click target is the chevron only**, not the whole label block: in editor mode the rename
  input owns the rest of the block, and a click that both focuses the input and folds the section
  reads as a bug.
- **`ordinalGutterColumn`** landed in `grid/kosztorys-synthetic-rows.tsx` beside the other
  synthetic-row cells, not behind `buildV2Grid` opts.
- **One band class, not two** — `kosztorys-section-header` and `kosztorys-section-start` were always
  applied together and were merged into the former; `globals.css` carries the merged rule.
- **The negative-id namespace moved to `src/lib/kosztorys/synthetic-rows.ts`**, so the module that
  asserts `id < 0` owns every id in the set; `section-band-rows.ts` keeps only the grouping algorithm
  (and was renamed from the planned `section-header-rows.ts`).
