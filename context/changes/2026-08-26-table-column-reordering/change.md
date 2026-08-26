---
change_id: table-column-reordering
title: Column reordering on the shared DataTable, ported from the kosztorys grid
status: implemented
created: 2026-08-26
updated: 2026-08-26
archived_at: null
branch: table-column-reordering
worktree: null
---

## Notes

Port the kosztorys column-order primitive (rank algebra + drag dialog) onto the shared TanStack
DataTable for the 6 keyed tables (transfers, investments, fleet, users, leads, cashRegisters).

Scope decided in conversation (2026-08-26):

- **In:** the 6 tables that already pass `storageKey`.
- **Out:** the 4 keyless `<DataTable>` call sites — `sheets/kosztorys-data-table`,
  `sheets/investments-without-sheet-table`, `kosztorys/summary/tables/materials-transactions-table`,
  `kosztorys/summary/tables/subcontractor-payouts-table`. None has a column picker today; joining in
  would cost a `storageKey` plus a toolbar. Skipping them also drops the positional-footer fix in
  `materials-transactions-table` from scope.
- `canHide` is removed entirely (owner call): the `meta` field, the filter in
  `filters/column-toggle.tsx`, and the 7 `meta: { canHide: false }` sites. Consequence accepted — a
  user can hide every column and land on an empty table, recoverable from the picker.

Already-written pieces this rides on (all domain-free despite living under `kosztorys/`):
`lib/kosztorys/column-order.ts` (rank algebra, unit-tested), `kosztorys/editor/dialogs/column-order-dialog.tsx`
(framer `Reorder.Group`, draft-on-drag, commit-on-drop), `ui/column-toggle-menu.tsx`.

Analysis correction worth keeping: `data-table-row.tsx` renders `row.getAllCells()`, which looked
like it would desync body cells from the headers once ordering is on. It does not — `getAllCells()`
maps `table.getAllLeafColumns()` (`core/row.ts:170`), which itself runs through `_getOrderColumnsFn()`
(`core/table.ts:499`), so cells are already ordered. Switching to `getVisibleCells()` is a
simplification (Phase 5), not a correctness fix.
