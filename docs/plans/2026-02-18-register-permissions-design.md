# M26: Cash Register Permissions — Design

## Problem

All cash registers are visible to all management roles. The business needs MAIN registers (e.g. "Kasa główna") hidden from MANAGER role — only ADMIN/OWNER should see them. MANAGER should see all AUXILIARY registers (not just their own).

## Design Decisions

| Question                         | Decision                                                        |
| -------------------------------- | --------------------------------------------------------------- |
| How many MAIN registers?         | Potentially multiple — use `type` enum, not boolean             |
| MANAGER visibility of AUXILIARY? | All AUXILIARY registers, not just owned                         |
| MANAGER transfer source?         | Own registers only (existing `getUserCashRegisterIds` behavior) |
| Register deletion?               | Blocked for all roles — finance data must not be deleted        |

## Approach: Collection-level `type` field + query filtering

Payload access control is bypassed by raw SQL queries, so enforcement happens at query/component level. A `type` field on the collection + filtering in queries and components is the right level of complexity.

## Data Model

Add `type` select field to `CashRegisters` collection:

- Values: `MAIN` | `AUXILIARY`
- Default: `AUXILIARY`
- Admin visibility: ADMIN/OWNER only (hidden from MANAGER via `admin.condition`)
- Migration: add `type` column, set existing "Kasa główna" to `MAIN`, all others to `AUXILIARY`

## Access Control

| Operation | ADMIN       | OWNER       | MANAGER       | EMPLOYEE    |
| --------- | ----------- | ----------- | ------------- | ----------- |
| read      | all         | all         | all AUXILIARY | none        |
| create    | yes         | yes         | no            | no          |
| update    | yes         | yes         | no            | no          |
| delete    | **blocked** | **blocked** | **blocked**   | **blocked** |

## Query Layer Changes

### `fetchReferenceData()` (`src/lib/queries/reference-data.ts`)

- Add `type` column to `cash_registers` SQL select
- `ReferenceDataT.cashRegisters` items get a `type: 'MAIN' | 'AUXILIARY'` field

### `findAllCashRegistersRaw()` (`src/lib/queries/cash-registers.ts`)

- Unchanged — returns all registers
- Filtering happens in consuming components

### `getUserCashRegisterIds()` (`src/lib/auth/get-user-cash-registers.ts`)

- Unchanged — already scopes MANAGER to owned registers for form pre-selection

## Dashboard Changes

### Manager Dashboard (`src/components/dashboard/manager-dashboard.tsx`)

- "Saldo kas" stat card: sum of AUXILIARY balances only
- `DashboardTables`: filter to AUXILIARY registers only
- Filter dropdowns: AUXILIARY registers only
- ADMIN/OWNER: unchanged, sees everything

## Form Changes

### Transfer form (`src/components/forms/transfer-form/transfer-form.tsx`)

- Cash register dropdown: MANAGER sees only AUXILIARY registers
- ADMIN/OWNER: sees all registers (unchanged)
- Filtering done by passing filtered `cashRegisters` prop from parent pages/dialogs

### Settlement form

- No cash register field (removed in M24) — no changes needed

## Payload Admin

- `read` access: `isAdminOrOwnerOrManager` (MANAGER needs read for AUXILIARY detail pages)
- `create`/`update` access: `isAdminOrOwner` (unchanged)
- `delete` access: `() => false` for all roles
- `type` field: `admin.condition` hides from MANAGER in admin panel

## Files to Change

| File                                                   | Change                                             |
| ------------------------------------------------------ | -------------------------------------------------- |
| `src/collections/cash-registers.ts`                    | Add `type` field, block delete, update read access |
| `src/migrations/YYYYMMDD_add_cash_register_type.ts`    | New — add column + data migration                  |
| `src/lib/queries/reference-data.ts`                    | Add `type` to SQL + `ReferenceDataT`               |
| `src/lib/queries/cash-registers.ts`                    | Add `type` to `mapCashRegisterRows` output         |
| `src/lib/tables/cash-registers.tsx`                    | Add `type` to `CashRegisterRowT`                   |
| `src/components/dashboard/manager-dashboard.tsx`       | Filter AUXILIARY for MANAGER                       |
| `src/components/forms/transfer-form/transfer-form.tsx` | Filter register dropdown by role                   |
| `src/app/(frontend)/kasa/page.tsx`                     | Filter register list by role                       |

## Success Criteria

1. MANAGER cannot see MAIN registers anywhere (dashboard, dropdowns, detail pages, list page)
2. ADMIN/OWNER sees all registers as before
3. MANAGER can still create transfers from own AUXILIARY registers
4. No register can be deleted by any role
5. New registers default to AUXILIARY
