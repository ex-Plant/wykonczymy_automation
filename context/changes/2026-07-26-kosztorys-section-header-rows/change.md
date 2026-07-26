---
change_id: kosztorys-section-header-rows
title: Group header row per section in the kosztorys grid, replacing the repeated „Sekcja" column
status: implementing
created: 2026-07-26
updated: 2026-07-26
archived_at: null
branch: kosztorys-section-header-rows
worktree: ../wykonczymy-worktrees/kosztorys-section-header-rows
---

## Notes

Replace the repeated „Sekcja" column with a group header row per section (colour dot, name, item
count, section subtotal) in the kosztorys v2 grid.

Owner's ask, verbatim: "try the sections remake / divider with total for section wouldn't be bad".

Precursor (already landed, outside this change): sections are separated in the grid by a colour spine
in the gutter column + a 2px divider in the section's hue above its first row, and the auto-assigned
palette order now spreads hues so neighbouring sections never share one.
