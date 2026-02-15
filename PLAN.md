# WYKONCZYMY - Technical Spec & Implementation Plan

## Stack

- **Next.js 16.1.6** (App Router, Turbopack) + **Payload CMS 3.73.0** (embedded)
- **Postgres 17** via `@payloadcms/db-vercel-postgres`
  - **Local dev**: Docker container (Postgres 17-alpine)
  - **Production**: Neon (serverless Postgres)
- **Shadcn UI** + **Tailwind 4** for custom views
- **TanStack Table** for data tables (transactions, ledgers, reports)
- **Vercel** deployment + **Vercel Blob** or **Uploadthing** for invoice uploads
- **Docker Compose** for local dev environment (Postgres only — app runs on host via `next dev`)

---

## Spec Analysis & Critique

### Ambiguities in the spec

1. **"INNE" (OTHER) categories** - spec says "rozdzielić na podkategorię" but doesn't define them. Solution: a configurable `OtherCategories` collection managed by OWNER.
2. **"ZALICZKA NA POCZET WYPŁATY"** - zeroing out ZIUTEK sub-accounts by converting leftover balance to salary advance. This is a special transaction subtype under OTHER. Needs explicit handling.
3. A "cash register" becomes a **wallet/account** (can hold cash, process BLIK, etc.). The payment method is per-transaction, not per-register.
4. **"Invoice calculator"** for MANAGER - interpreted as: a form where MANAGER enters multiple invoice line items, auto-sums them, and creates the corresponding EMPLOYEE_EXPENSE transaction(s).
5. **Sub-account balance** - not a separate entity. Computed from `SUM(ADVANCE) - SUM(EMPLOYEE_EXPENSE)` filtered by worker. Stored as virtual field, recalculated on each transaction.

### Design decisions

- **No separate SubAccounts collection.** EMPLOYEE balance = sum of their ADVANCE transactions minus sum of their EMPLOYEE_EXPENSE transactions. Simpler, no sync issues.
- **Investment totalCosts** = computed via hooks on transaction CRUD, stored on the Investment document for fast reads.
- **CashRegister balance** = computed via hooks on transaction CRUD, stored on the register document.
- **All money flows are transactions.** OWNER→MANAGER transfer = two transactions (withdrawal from OWNER register, deposit to MANAGER register). Keeps the ledger clean.

---

## Data Model (Payload Collections)

### 1. Users (auth collection)

| Field | Type   | Notes                                                 |
| ----- | ------ | ----------------------------------------------------- |
| name  | text   | required                                              |
| email | email  | required, unique                                      |
| role  | select | `ADMIN` / `OWNER` / `MANAGER` / `EMPLOYEE`, saveToJWT |

**Role semantics:**

- `ADMIN` — Full system access. Payload admin panel, all collections, user management, system config. Reserved for developers/sysadmins.
- `OWNER` — Business owner (SZEF). Full CRUD on all business data. Cannot access Payload admin panel system settings.
- `MANAGER` — Site manager (MAJSTER). Creates transactions, views all data, manages own cash register.
- `EMPLOYEE` — Worker (ZIUTEK). Read-only access to own sub-account and transactions.

### 2. CashRegisters

| Field   | Type         | Notes                                         |
| ------- | ------------ | --------------------------------------------- |
| name    | text         | e.g. "Kasa Adrian", "Kasa Bartek"             |
| owner   | relationship | → Users                                       |
| balance | number       | updated via hooks, default 0, admin read-only |

### 3. Investments

| Field         | Type     | Notes                        |
| ------------- | -------- | ---------------------------- |
| name          | text     | client/project name          |
| address       | text     |                              |
| phone         | text     |                              |
| email         | email    | optional                     |
| contactPerson | text     |                              |
| notes         | textarea |                              |
| totalCosts    | number   | updated via hooks, default 0 |
| status        | select   | `active` / `completed`       |

### 4. Transactions

| Field            | Type         | Notes                                                                     |
| ---------------- | ------------ | ------------------------------------------------------------------------- |
| description      | text         | what the money was spent on                                               |
| amount           | number       | always positive, direction determined by type                             |
| date             | date         | when the transaction occurred                                             |
| type             | select       | `INVESTMENT_EXPENSE` / `ADVANCE` / `EMPLOYEE_EXPENSE` / `OTHER`           |
| paymentMethod    | select       | `CASH` / `BLIK` / `TRANSFER` / `CARD`                                     |
| cashRegister     | relationship | → CashRegisters (source of funds)                                         |
| investment       | relationship | → Investments (required if type = INVESTMENT_EXPENSE or EMPLOYEE_EXPENSE) |
| worker           | relationship | → Users (required if type = ADVANCE or EMPLOYEE_EXPENSE)                  |
| invoice          | upload       | → Media                                                                   |
| invoiceNote      | textarea     | required if no invoice attached                                           |
| otherCategory    | relationship | → OtherCategories (required if type = OTHER)                              |
| otherDescription | textarea     | required if type = OTHER and category not in predefined list              |
| createdBy        | relationship | → Users, auto-set via hook                                                |

### 5. OtherCategories

| Field | Type | Notes                      |
| ----- | ---- | -------------------------- |
| name  | text | e.g. "Paliwo", "Narzędzia" |

### 6. Media (Payload built-in)

For invoice file uploads (PDF, images).

---

## Hooks (Business Logic)

### Transactions - beforeValidate

- `type = INVESTMENT_EXPENSE` → require `investment`
- `type = ADVANCE` → require `worker`
- `type = EMPLOYEE_EXPENSE` → require `worker` + `investment`
- `type = OTHER` → require `otherCategory`
- No `invoice` → require `invoiceNote`
- Auto-set `createdBy` from `req.user`

### Transactions - afterChange (create/update/delete)

- Recalculate `cashRegister.balance` (sum all transactions for that register)
- If `type = INVESTMENT_EXPENSE` or `EMPLOYEE_EXPENSE` → recalculate `investment.totalCosts`
- Worker sub-account balance is computed on-read (no stored field needed), but we could cache it for performance

### Transactions - beforeDelete

- Reverse all balance effects before allowing deletion (or disallow deletion, only allow corrections via new transactions — safer for accounting)

---

## Access Control

| Collection      | ADMIN       | OWNER       | MANAGER                          | EMPLOYEE                 |
| --------------- | ----------- | ----------- | -------------------------------- | ------------------------ |
| Users           | full CRUD   | full CRUD   | create (EMPLOYEE only), read all | read self only           |
| CashRegisters   | full CRUD   | full CRUD   | read all, update own balance     | no access                |
| Investments     | full CRUD   | full CRUD   | read all                         | no access                |
| Transactions    | full CRUD   | full CRUD   | create, read all, update own     | read own (worker = self) |
| OtherCategories | full CRUD   | full CRUD   | read                             | no access                |
| Media           | full CRUD   | full CRUD   | create, read                     | read own                 |
| Payload Admin   | full access | full access | full access                      | no access                |

---

## Custom Views (Next.js App Router pages, outside Payload admin)

1. **Dashboard** (`/`) — cash register balances, recent transactions, quick stats
2. **Investments** (`/investments`, `/investments/[id]`) — list + detail with transaction table
3. **Cash Registers** (`/cash-registers`, `/cash-registers/[id]`) — balance, transaction history
4. **Workers** (`/workers`, `/workers/[id]`) — sub-account balance, advance/expense history
5. **Settlement** (`/settlement`) — MANAGER enters EMPLOYEE invoices, calculator, creates EMPLOYEE_EXPENSE batch
6. **New Transaction** (`/transactions/new`) — form with conditional fields based on type
7. **Reports** (`/reports`) — filterable by date range, investment, worker, register
8. **Worker Portal** (`/my-account`) — read-only view of own sub-account for EMPLOYEE role

---

## Implementation Milestones

### M1: Project Scaffold ✅ DONE

- [x] Switch from npm to pnpm
- [x] Move to `src/` directory structure (`@/*` → `./src/*`)
- [x] Reorganize `app/` into route groups: `(frontend)` + `(payload)`
- [x] Merge root layout + slug layout into `(frontend)/layout.tsx`
- [x] Install Payload CMS 3.73.0 (compatible with Next.js 16.1.6 + Turbopack)
- [x] Create `payload.config.ts` with Users collection + Postgres adapter
- [x] Wire `next.config.ts` with `withPayload`
- [x] Create `(payload)` route files from blank template (layout, page, not-found, API routes)
- [x] Docker Compose for local Postgres 17
- [x] Update `.env` with `DATABASE_URL` + `PAYLOAD_SECRET`
- [x] Add `"type": "module"` to `package.json` (required for Payload CLI on Node 24)
- [x] Generate import map + types
- [x] Create initial migration + run it
- **Key files**: `src/payload.config.ts`, `next.config.ts`, `docker-compose.yml`, `src/app/(payload)/`, `src/app/(frontend)/layout.tsx`
- **Verified**: Frontend (200) + Admin panel (200) both working on Turbopack

#### Deferred from M1

- Email adapter (nodemailer) — console-only for now, add when needed
- Admin panel i18n (pl/en) — add in M2
- CORS config — add when frontend fetches from API

---

### M2: Auth & Users ✅ DONE

- [x] Extract Users collection to `src/collections/users.ts`
- [x] Add role field (`ADMIN` / `OWNER` / `MANAGER` / `EMPLOYEE`) with `saveToJWT`
- [x] Role-based access control helpers (`src/access/`)
- [x] ADMIN role: full Payload admin panel access, all collections unrestricted
- [x] Seed script for initial ADMIN account (`onInit` hook, skips if users exist)
- [x] Admin panel i18n (`@payloadcms/translations` — pl + en, fallback: pl)
- [x] Collection labels + field labels translated (pl/en)
- [x] Existing user (Konrad) promoted to ADMIN role
- **Key files**: `src/collections/users.ts`, `src/access/index.ts`, `src/seed.ts`, `src/payload.config.ts`
- **Migration**: `20260211_204911_add_user_role.ts`
- **Verified**: Admin panel (200), frontend (200), Polish translations active, access control blocking anonymous requests

### M3: Core Collections (CashRegisters, Investments, OtherCategories) ✅ DONE

- [x] CashRegisters with owner relationship and balance field
- [x] Investments with all client fields and totalCosts
- [x] OtherCategories for configurable expense categories
- [x] Media collection for invoice uploads (images + PDF, with createdBy auto-set)
- **Files**: `src/collections/cash-registers.ts`, `src/collections/investments.ts`, `src/collections/other-categories.ts`, `src/collections/media.ts`
- **Migration**: `20260211_212425.ts`
- **Verified**: All 4 tables created, types generated, frontend (200) + admin (200)

### M4: Transactions & Business Logic ✅ DONE

- [x] Transactions collection with all fields and conditional visibility (`admin.condition`)
- [x] Validation hooks (beforeValidate) — type-dependent required fields, auto-set createdBy
- [x] Balance update hooks (afterChange + afterDelete) — recalculate register balance and investment totalCosts
- [x] Invoice upload via Media collection (configured in M3)
- [x] Refactored access control — extracted `rolesOrSelfField` higher-order helper, eliminated all inline access logic across 4 collections
- **Files**: `src/collections/transactions.ts`, `src/hooks/transactions/validate.ts`, `src/hooks/transactions/recalculate-balances.ts`, `src/access/index.ts`
- **Migration**: `20260211_213603.ts`
- **Verified**: Types generated, frontend (200) + admin (200)

### M5: Dashboard & Sidebar Layout ✅ DONE

- [x] Sidebar layout with role-based navigation (EMPLOYEE sees Kokpit + Transakcje only)
- [x] Dashboard with overview cards (register balances, active investments, recent transactions)
- [x] Login/logout flow with session-based auth
- **Files**: `src/app/(frontend)/layout.tsx`, `src/app/(frontend)/page.tsx`, `src/components/layouts/sidebar/sidebar.tsx`, `src/app/(auth)/`
- **Verified**: Frontend (200), sidebar renders, auth redirect works

### M6: Frontend Business Features ✅ DONE

- [x] Shared constants (`src/lib/constants/transactions.ts`) — type/payment labels, conditional field helpers
- [x] Role permission helpers (`src/lib/auth/permissions.ts`) — `isManagementRole()`, `MANAGEMENT_ROLES`
- [x] Role-aware sidebar — EMPLOYEE sees 2 items, management sees 5 + "Nowa transakcja" button
- [x] Role-aware dashboard — management sees full stats, EMPLOYEE sees personal saldo + monthly transactions
- [x] Employee dashboard with month/year selector and server action data fetching
- [x] Transaction creation dialog (openable from sidebar/list page) with context provider pattern
- [x] Transaction form with conditional fields, Zod 4 validation, invoice upload, server action
- [x] Transaction list page (`/transakcje`) with URL-based filters (type, cash register, date range) + pagination
- [x] EMPLOYEE auto-filtered to own transactions on list page
- **New files**: `src/lib/constants/transactions.ts`, `src/lib/auth/permissions.ts`, `src/lib/transactions/actions.ts`, `src/lib/transactions/schema.ts`, `src/app/(frontend)/_components/manager-dashboard.tsx`, `src/app/(frontend)/_components/employee-dashboard.tsx`, `src/app/(frontend)/_components/layout-shell.tsx`, `src/components/transactions/transaction-dialog-provider.tsx`, `src/components/transactions/transaction-form.tsx`, `src/app/(frontend)/transakcje/page.tsx`, `src/app/(frontend)/transakcje/_components/`
- **Modified**: `src/components/layouts/sidebar/sidebar.tsx`, `src/app/(frontend)/page.tsx`, `src/app/(frontend)/layout.tsx`
- **Verified**: `pnpm typecheck` (0 errors), `pnpm lint` (0 errors), dev server running

### M7: Investment, Cash Register & Worker Views ✅

- [x] Investment list + detail page with transaction history
- [x] Cash register list + detail with balance and transaction history
- [x] Worker list + sub-account balance view
- **New files**: `src/app/(frontend)/inwestycje/page.tsx`, `src/app/(frontend)/inwestycje/[id]/page.tsx`, `src/app/(frontend)/kasa/page.tsx`, `src/app/(frontend)/kasa/[id]/page.tsx`, `src/app/(frontend)/uzytkownicy/page.tsx`, `src/app/(frontend)/uzytkownicy/[id]/page.tsx`
- **Verified**: `pnpm typecheck` (0 errors), `pnpm lint` (0 new errors)
- **Success**: All sidebar pages have functional views with real data

### M8: Settlement Flow ✅ DONE

- [x] Settlement server actions: `getEmployeeSaldo`, `createSettlement`, `zeroSaldoAction`
- [x] Settlement page (`/rozliczenia`) — management-only, fetches reference data
- [x] Settlement form with dynamic line items, auto-sum, employee saldo display, invoice upload
- [x] Each line item creates a separate EMPLOYEE_EXPENSE transaction (shared metadata: worker, investment, date, cash register, payment method, invoice)
- [x] Zero saldo dialog on `/uzytkownicy/[id]` — creates single EMPLOYEE_EXPENSE to zero out balance
- [x] Sidebar: "Rozliczenia" nav item (management only, Receipt icon)
- **New files**: `src/lib/settlements/actions.ts`, `src/app/(frontend)/rozliczenia/page.tsx`, `src/components/settlements/settlement-form.tsx`, `src/components/settlements/zero-saldo-dialog.tsx`
- **Modified**: `src/components/layouts/sidebar/sidebar.tsx`, `src/app/(frontend)/uzytkownicy/[id]/page.tsx`
- **Verified**: `pnpm typecheck` (0 errors), `pnpm lint` (0 new errors)

---

### M8.1: Form Defaults & Manager Cash Register Scoping ✅ DONE

- [x] Default payment method to CASH in settlement + zero-saldo forms
- [x] Manager's own cash register pre-selected and locked (disabled select) in transaction/settlement/zero-saldo forms
- [x] ADMIN/OWNER can freely choose any cash register
- [x] Server-side: `getUserCashRegisterIds()` resolves Manager's own register
- **Files**: `src/lib/auth/get-user-cash-registers.ts`, `src/components/settlements/settlement-form.tsx`, `src/components/settlements/zero-saldo-dialog.tsx`, `src/components/transactions/transaction-form.tsx`

#### Note: Adding workers & investments

Adding new workers (Users) and investments is handled exclusively via the **Payload admin panel** — no frontend forms needed. MANAGER can create EMPLOYEE users only (role field locked to default); ADMIN/OWNER can create users with any role.

### M8.2: Refactoring & Dashboard Improvements ✅ DONE

- [x] Login form — migrated to TanStack Form (`useAppForm`), removed redundant client-side Zod validation, added `autoComplete` support to form system
- [x] Employee dashboard — split saldo into overall (fetched once on server) + monthly (refetched on month/year change via server action)
- [x] Employee dashboard — extracted server component (`employee-dashboard-server.tsx`), cleaned up `page.tsx` to pure routing
- [x] Employee dashboard — optimized from 5 Payload queries to 2 (combined ADVANCE + EMPLOYEE_EXPENSE with `select` projection)
- [x] Employee dashboard — removed month/year from URL params, now client state with `useTransition` + server action
- [x] StatCard — extracted as shared reusable component used by both employee and manager dashboards
- [x] Admin panel access — ADMIN + OWNER + MANAGER can now access `/admin` (EMPLOYEE still locked out)
- **New files**: `src/components/ui/stat-card.tsx`, `src/app/(frontend)/_components/employee-dashboard-server.tsx`, `src/lib/transactions/get-employee-dashboard.ts`
- **Modified**: `src/app/(auth)/zaloguj/login-form.tsx`, `src/app/(frontend)/page.tsx`, `src/app/(frontend)/_components/employee-dashboard.tsx`, `src/app/(frontend)/_components/manager-dashboard.tsx`, `src/components/forms/types/form-types.ts`, `src/components/forms/form-input.tsx`, `src/access/index.ts`, `src/collections/users.ts`

---

### Future Milestones (not yet planned in detail)

### M9: Performance Optimization — SQL SUM Aggregation ✅ DONE

Replaced all fetch-all-and-reduce-in-JS patterns with Postgres `SUM()` queries. No new dependencies — uses `sql` re-exported from `@payloadcms/db-vercel-postgres`.

- [x] **Shared SQL utility** (`src/lib/db/sum-transactions.ts`) — `getDb` helper for transaction-scoped Drizzle access + 4 aggregation functions:
  - `sumRegisterBalance(payload, registerId, req?)` — `SUM(CASE WHEN DEPOSIT THEN +amount ELSE -amount END)`
  - `sumInvestmentCosts(payload, investmentId, req?)` — `SUM(amount)` for `INVESTMENT_EXPENSE` + `EMPLOYEE_EXPENSE`
  - `sumEmployeeSaldo(payload, workerId, dateRange?)` — `SUM(CASE WHEN ADVANCE THEN +amount ELSE -amount END)` with optional date range
  - `sumAllWorkerSaldos(payload)` — same as above but `GROUP BY worker_id`, returns `Map<number, number>`
- [x] **`recalculate-balances.ts` hooks** — replaced `payload.find(limit: 0)` + `.reduce()` with `sumRegisterBalance` / `sumInvestmentCosts`. `req` forwarded for transaction-scoped DB access.
- [x] **`get-employee-dashboard.ts`** — `getEmployeeSaldo`: replaced 2x `payload.find(limit: 0)` + reduce → single `sumEmployeeSaldo`. `getEmployeeMonthlyData`: replaced monthly saldo fetch + loop → `sumEmployeeSaldo` with date range.
- [x] **`settlements/actions.ts`** — `getEmployeeSaldo`: replaced 2x `payload.find(limit: 1000)` + reduce → `sumEmployeeSaldo`. **Fixed limit:1000 truncation bug.**
- [x] **`transactions/actions.ts`** — `getEmployeeMonthData`: replaced 2x `payload.find(limit: 1000)` + reduce → single `sumEmployeeSaldo`. Dropped 2 of 3 parallel queries. **Fixed limit:1000 truncation bug.**
- [x] **`uzytkownicy/[id]/page.tsx`** — replaced 2x `payload.find(pagination: false)` + reduce → single `sumEmployeeSaldo`. Dropped 2 of 6 parallel queries.
- [x] **`uzytkownicy/page.tsx`** — replaced 2x full-table scans (`pagination: false`, no worker filter) + JS grouping → single `sumAllWorkerSaldos` with `GROUP BY`. Dropped 2 of 3 parallel queries.
- **New file**: `src/lib/db/sum-transactions.ts`
- **Modified**: `src/hooks/transactions/recalculate-balances.ts`, `src/lib/transactions/get-employee-dashboard.ts`, `src/lib/settlements/actions.ts`, `src/lib/transactions/actions.ts`, `src/app/(frontend)/uzytkownicy/page.tsx`, `src/app/(frontend)/uzytkownicy/[id]/page.tsx`
- **Verified**: `pnpm tsc --noEmit` (0 new errors)

#### Deferred from M9

- **Searchable combobox** — sidebar/forms fetch all users/investments/categories upfront with `pagination: false`. Won't scale past ~100-200 records, but fine for a construction company with <50 workers, <100 investments, <10 registers. Defer to a later milestone if growth warrants it.

### Bug Fixes (post-M9)

- [x] **Pagination not navigating** — `UrlPagination` called `e.preventDefault()` unconditionally, blocking `<Link>` navigation when `onNavigate` wasn't passed. Made `handleClick` conditional.
- [x] **Pagination page windowing** — all page buttons rendered (e.g. 20 buttons). Replaced with 5-page sliding window + first/last page buttons + configurable jump-by-N arrows (`jumpSize` prop, default 5). New utility: `src/components/ui/pagination/get-windowed-pages.ts`.
- [x] **MANAGER privilege escalation** — MANAGER could create users with any role (ADMIN, OWNER). Added `create: isAdminOrOwnerField` to role field; restricted collection `update`/`delete` to `isAdminOrOwner`. MANAGER can now only create EMPLOYEE users (role field defaults when not writable).

### M10: Table Column Management

- [ ] Column visibility toggle — allow users to hide/show columns in data tables (transactions, users, investments, cash registers)
- [ ] Column reordering — drag-and-drop or menu-based column reordering
- [ ] Persist preferences per user (localStorage or DB) so column config survives page reload
- [ ] TanStack Table already supports `columnVisibility` and `columnOrder` state — wire into existing `DataTable` component
- **Files**: `src/components/ui/data-table.tsx`, new `src/components/ui/column-settings.tsx`
- **Success**: Users can hide irrelevant columns and reorder them to their preference

### M11: Reports (was M10)

- [ ] Filterable report views (date range, investment, worker, register)
- [ ] Daily / monthly / yearly summaries
- [ ] Data tables with TanStack Table (sorting, filtering, pagination)
- **Files**: `src/app/(frontend)/reports/`
- **Success**: OWNER/MANAGER can generate filtered reports

### M12: Invoices View & Download

- [ ] Dedicated page for browsing/searching uploaded invoices (currently only accessible via individual transactions)
- [ ] Filtering by date, worker, investment
- [ ] Download/preview functionality
- [ ] Access control: decide who can view invoices (open question in M8.1)
- [ ] **Downloadable invoice PDF in every transaction table** — wherever a transaction row appears in the app (transactions list, investment detail, cash register detail, worker detail, dashboard recent, settlement history), display a download link/icon when the transaction has an attached invoice. This is a **cross-cutting requirement** that affects the shared `TransactionDataTable` component and any other place transactions are rendered.
- **Files**: `src/app/(frontend)/faktury/`, `src/components/transactions/transaction-data-table.tsx`, `src/lib/transactions/map-transaction-row.ts`
- **Success**: Users can browse, search, and download invoices; invoice PDF download is accessible inline from any transaction row across the entire app

### M13: Deployment (in progress)

- [x] Vercel project setup
- [x] Neon Postgres provisioning + data migrated
- [x] File storage — Vercel Blob via `@payloadcms/storage-vercel-blob@3.73.0`, configured in `payload.config.ts` plugin. Requires `BLOB_READ_WRITE_TOKEN` env var.
- [x] Production build verification — `pnpm build` succeeds. Fixed dead `format-date.ts` (removed) and seed script type errors (`type`/`paymentMethod` widened to `string` instead of literal unions).
- [x] Email adapter — `@payloadcms/email-nodemailer@3.73.0` + `nodemailer` with SMTP (seohost.pl). Requires `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS` env vars.
- [ ] Environment variables audit — ensure all env vars are set in Vercel (`DATABASE_URL`, `PAYLOAD_SECRET`, `BLOB_READ_WRITE_TOKEN`, `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`)
- [x] Test email route (`GET /api/test-email?to=...`) — ADMIN-only, verifies SMTP connection before sending
- **New deps**: `@payloadcms/storage-vercel-blob@3.73.0`, `@payloadcms/email-nodemailer@3.73.0`, `nodemailer`, `@types/nodemailer` (dev)
- **Modified**: `src/payload.config.ts`, `src/scripts/seed-transactions.ts`, `src/scripts/seed-ziutek-advances.ts`
- **Deleted**: `src/lib/format-date.ts` (dead code, referenced deleted i18n module)
- **Success**: App live on Vercel, all features working

---

## Local Dev Setup

```bash
docker compose up -d      # start Postgres 17
pnpm dev                  # start Next.js 16 + Payload 3.73 (Turbopack)
```

- Frontend: http://localhost:3000
- Admin panel: http://localhost:3000/admin
- Postgres: localhost:5432 (user: postgres, pass: postgres, db: wykonczymy)

### Useful commands

```bash
pnpm payload migrate          # run pending migrations
pnpm migrate:create           # create a new migration
pnpm generate:types           # regenerate payload-types.ts
pnpm generate:importmap       # regenerate admin importMap.js
```
