---
change_id: kosztorys-section-inline-rename
title: Make the grid's Sekcja cell rename the whole section
status: archived
created: 2026-07-16
updated: 2026-07-24
archived_at: 2026-07-24T13:46:37Z
branch: dogfooding/kosztorys-editor-ux
worktree: null
---

## Notes

make the grid's Sekcja cell rename the whole section (route through handleRenameSection, commit on blur/Enter) instead of being read-only

**Accepted divergence:** the grid cell lets an explicit clear-and-commit persist an **empty** section
name; the section panel still rejects empty. Deliberate (user decision) — a blank Sekcja is a legal
state, not a bug. A stray grid Delete is a separate case and is a no-op (`deleteValue` returns the row
unchanged), so nothing can blank a section by accident.
