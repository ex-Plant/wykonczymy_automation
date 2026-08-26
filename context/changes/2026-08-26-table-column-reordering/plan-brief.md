# Column reordering on the shared DataTable — Plan Brief

> Full plan: `context/changes/2026-08-26-table-column-reordering/plan.md`

## What & Why

The kosztorys grid already lets the owner drag columns into whatever order they want. The primitive
behind it is domain-free but lives inside `kosztorys/`, so none of the app's other tables can reach
it. This change promotes it into shared homes and turns it on for the six TanStack tables that
already persist column preferences.

## Starting Point

`src/components/ui/data-table/data-table.tsx` holds `sorting` and `columnVisibility` state but never
sets `columnOrder`, so every table renders in declaration order. Everything else needed already
exists and is tested: the rank algebra (`lib/kosztorys/column-order.ts`), the drag dialog
(`kosztorys/editor/dialogs/column-order-dialog.tsx`), the shared picker (`ui/column-toggle-menu.tsx`)
and its TanStack adapter (`filters/column-toggle.tsx`).

## Desired End State

The „Kolumny" dropdown on transfers, investments, fleet, users, leads and cash-registers carries a
„Ustaw kolejność kolumn…" row opening the same drag dialog the kosztorys grid uses. A dropped column
persists per table, survives reload, and a column added to the code later still appears where it is
declared rather than at the far right.

## Key Decisions Made

| Decision       | Choice                                  | Why                                                                                                                                   | Source       |
| -------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Which tables   | The 6 with a `storageKey`               | The other 4 have no picker either; joining in would cost a key plus a toolbar                                                         | Conversation |
| `canHide`      | Removed entirely                        | Owner call — anything may be hidden; also collapses picker and reorder into one list                                                  | Conversation |
| Persisted form | Sparse rank map, not a dense `string[]` | TanStack appends unknown ids at the end (`ColumnOrdering.ts:152`), so an array freezes today's column set for anyone who ever dragged | Plan         |
| Toolbar seam   | `toolbar` takes one object              | Explicit; `tsc` catches every miss, and a `ColumnToggle` outside a `DataTable` fails to compile rather than silently doing nothing    | Plan         |
| Trigger        | Item inside the picker dropdown         | Matches `kosztorys-view-menu`, whose portal/focus trap is already solved; costs no toolbar width                                      | Plan         |
| Reset          | Order only                              | Matches the kosztorys dialog; clearing visibility as a side effect of fixing order is destructive                                     | Plan         |
| E2E            | Filed to `e2e-backlog`                  | The algebra is where bugs live and is already covered; pointer-drag specs against framer are the flakiest kind                        | Plan         |

## Scope

**In scope:** promote `column-order.ts` → `lib/table/` and the dialog → `ui/`; delete `canHide`;
rank state + `columnOrder` in `DataTable`; per-table `localStorage` persistence; widen the `toolbar`
signature; picker entry + dialog; collapse the hand-rolled visible-cell filter onto `getVisibleCells()`.

**Out of scope:** the 4 keyless `<DataTable>` call sites; the positional footer in
`materials-transactions-table`; column resizing, pinning, server-side per-user persistence; a
Playwright spec.

## Architecture / Approach

The rank map is the persisted form, not the order. `DataTable` derives a dense
`columnOrder: string[]` from `orderColumnKeys(leafIds, ranks)` each render; the dialog writes one
rank per drop via `rankForMove`. Sparseness is the whole point — an unranked key sorts at its
declared index, which is why a future column lands where the code puts it instead of at the end.
Persistence mirrors the visibility block already in `column-visibility-storage.ts` (hydrate after
mount, so server and first client render agree) rather than importing the kosztorys store, which
keys a module-level singleton and can't vary per `storageKey` prop.

## Phases at a Glance

| Phase                    | What it delivers                                      | Key risk                                                                          |
| ------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1. Promote the primitive | Algebra + dialog in shared homes, kosztorys unchanged | A missed importer; grep-verified                                                  |
| 2. Retire `canHide`      | One unfiltered column list                            | Touches `sheets.tsx`, out of scope for reordering but forced by the type deletion |
| 3. Ranks in `DataTable`  | Persistence, `columnOrder`, widened toolbar           | The 8-call-site signature change collides with in-flight fleet work               |
| 4. Wire the UI           | Picker entry + dialog on all six tables               | Reading `getAllColumns()` instead of `getAllLeafColumns()` shows a stale order    |
| 5. Cleanup & close       | `getVisibleCells()`, E2E filed                        | Touches all 10 tables including the 4 out of scope                                |

**Prerequisites:** none — no migration, no prod step, no new dependency (framer-motion and
`@tanstack/react-table` are both already in `package.json`).
**Estimated effort:** ~3–4 hours, one session. Roughly 40 minutes of it is the feature; the rest is
paying off the primitive having been built inside `kosztorys/`.

## Open Risks & Assumptions

- `fleet-data-table.tsx` and `tables/fleet.tsx` are already modified in the working tree by the
  fleet-sheet-parity work. Phase 3 edits the first — expect to rebase around it.
- An earlier read claimed `getAllCells()` ignores `columnOrder`, making Phase 5 a correctness
  blocker. Verified against `table-core@8.21.3` (`core/table.ts:499` → `core/row.ts:170`): cells are
  already ordered. Phase 5 is a simplification and can be dropped without breaking the feature.
- Accepted: a user can now hide every column and land on an empty table. Recoverable from the picker.
- `transfers` shares one storage key across pages with different `excludeColumns`. Sparse ranks
  handle it; a rank on an absent key just doesn't apply. Worth confirming in the manual pass.

## Success Criteria (Summary)

- A column dragged in the picker moves in the table and stays moved after a reload.
- Each of the six tables remembers its own order; none bleeds into another.
- A column added to a table's code later still appears at its declared position for a user who has
  already reordered that table.
