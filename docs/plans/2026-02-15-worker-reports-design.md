# M17 Design: Worker Monthly Report

## Goal

Allow management (ADMIN/OWNER/MANAGER) to view per-worker expense summaries for a selected period and print a full transaction report for an employee.

## Decisions

- **Scope**: Worker expense overview only (no cross-worker report page for now)
- **Period**: Default current month, toggle to custom date range via from/to
- **Detail**: Summary stats + filtered transaction table on existing worker detail page
- **Print**: Dedicated server-rendered route showing ALL transactions (no pagination), opened in new tab
- **Filters**: Reuse the existing `TransactionFilters` component (extracted to shared location)

## Design

### 1. Extract TransactionFilters to shared location

The `TransactionFilters` component currently lives in `src/app/(frontend)/transakcje/_components/transaction-filters.tsx`. Move it to `src/components/transactions/transaction-filters.tsx` so both the transactions page and the worker detail page can use it.

Update the import in `src/app/(frontend)/transakcje/page.tsx`.

### 2. Add period filtering to worker detail page

**File**: `src/app/(frontend)/uzytkownicy/[id]/page.tsx`

- Render `TransactionFilters` with date range (from/to), type, and cash register filters
- Worker ID filter applied server-side (not exposed in UI) — same pattern as employee context filtering
- Pass date range params to `findTransactions` where clause
- URL example: `/uzytkownicy/5?from=2026-02-01&to=2026-02-28&type=ADVANCE`

### 3. Period summary stats

Show 3 `StatCard`s above the transaction table when a date range is active:

| Stat             | Description                                    |
| ---------------- | ---------------------------------------------- |
| Total advances   | SUM of ADVANCE transactions in period          |
| Total expenses   | SUM of EMPLOYEE_EXPENSE transactions in period |
| Period net saldo | Advances - expenses for the period             |

**New SQL query**: `sumWorkerPeriodBreakdown(workerId, dateRange)` in `src/lib/db/sum-worker-period.ts`

Single SQL query using `CASE WHEN type = 'ADVANCE' THEN amount ELSE 0 END` grouping to return all 3 values in one round-trip.

Wrapped with `'use cache'` + `cacheTag(CACHE_TAGS.transactions)` in a query function.

### 4. Print route

**Route**: `/uzytkownicy/[id]/raport`
**File**: `src/app/(frontend)/uzytkownicy/[id]/raport/page.tsx`

Server component that:

1. Accepts same URL params as the detail page (from, to, type, cashRegister)
2. Fetches ALL transactions for the worker + filters (no pagination — `pagination: false`)
3. Fetches period summary stats
4. Renders a print-optimized layout:
   - Worker name and period label at top
   - Summary stats (advances, expenses, net saldo)
   - Full transaction table (all rows)
   - Print button that triggers `window.print()`
   - `@media print` CSS hides: nav, sidebar, print button, browser chrome
5. Accessible from the worker detail page via a "Print report" button that opens this route in a new tab

### 5. Access control

Same as existing worker detail page — management roles only (ADMIN/OWNER/MANAGER). EMPLOYEEs cannot access.

## Files

| Action     | File                                                                                                     | Purpose                             |
| ---------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| MOVE       | `transakcje/_components/transaction-filters.tsx` → `src/components/transactions/transaction-filters.tsx` | Shared filter component             |
| MODIFY     | `src/app/(frontend)/transakcje/page.tsx`                                                                 | Update import path                  |
| MODIFY     | `src/app/(frontend)/uzytkownicy/[id]/page.tsx`                                                           | Add filters, stats, print link      |
| NEW        | `src/app/(frontend)/uzytkownicy/[id]/raport/page.tsx`                                                    | Print route                         |
| NEW        | `src/lib/db/sum-worker-period.ts`                                                                        | SQL aggregation query               |
| NEW/MODIFY | `src/lib/queries/users.ts`                                                                               | Cached wrapper for period breakdown |

## Not in scope

- Cross-worker summary report page
- Investment cost reports
- CSV/Excel export
- Charts or visualizations
