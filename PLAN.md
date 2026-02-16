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

- **No separate SubAccounts collection.** EMPLOYEE balance = sum of their ACCOUNT_FUNDING transactions minus sum of their EMPLOYEE_EXPENSE transactions. Simpler, no sync issues.
- **Investment totalCosts** = computed via hooks on transaction CRUD, stored on the Investment document for fast reads. (May evolve to signed P&L balance in M28 — deferred.)
- **CashRegister balance** = computed via hooks on transaction CRUD, stored on the register document.
- **All money flows are transactions.** Register-to-register transfer = single `REGISTER_TRANSFER` transaction with source + target registers.
- **EMPLOYEE_EXPENSE does NOT touch cash registers.** When a worker spends their advanced money, only their saldo decreases and investment costs increase. The cash register already lost the money when the advance was given. This prevents double-charging.
- **Deposit types are explicit.** Instead of a generic `DEPOSIT`, each source of funds is a separate transaction type (`INVESTOR_DEPOSIT`, `STAGE_SETTLEMENT`, `COMPANY_FUNDING`, `OTHER_DEPOSIT`) with appropriate required fields.

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

| Field            | Type         | Notes                                                                                                                                            |
| ---------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| description      | text         | what the money was spent on                                                                                                                      |
| amount           | number       | always positive, direction determined by type                                                                                                    |
| date             | date         | when the transaction occurred                                                                                                                    |
| type             | select       | See type enum table in M24. Current: `DEPOSIT` / `INVESTMENT_EXPENSE` / `ADVANCE` / `EMPLOYEE_EXPENSE` / `OTHER`. Post-M24: expanded to 9 types. |
| paymentMethod    | select       | `CASH` / `BLIK` / `TRANSFER` / `CARD`                                                                                                            |
| cashRegister     | relationship | → CashRegisters (source of funds). **Not used for EMPLOYEE_EXPENSE** (post-M24).                                                                 |
| targetRegister   | relationship | → CashRegisters (post-M24, only for REGISTER_TRANSFER)                                                                                           |
| investment       | relationship | → Investments (required for some types, optional for EMPLOYEE_EXPENSE)                                                                           |
| worker           | relationship | → Users (required if type = ACCOUNT_FUNDING or EMPLOYEE_EXPENSE)                                                                                 |
| invoice          | upload       | → Media                                                                                                                                          |
| invoiceNote      | textarea     | optional, never required                                                                                                                         |
| otherCategory    | relationship | → OtherCategories (required if type = OTHER)                                                                                                     |
| otherDescription | textarea     | required if type = OTHER and category not in predefined list                                                                                     |
| createdBy        | relationship | → Users, auto-set via hook                                                                                                                       |

### 5. OtherCategories

| Field | Type | Notes                      |
| ----- | ---- | -------------------------- |
| name  | text | e.g. "Paliwo", "Narzędzia" |

### 6. Media (Payload built-in)

For invoice file uploads (PDF, images).

---

## Hooks (Business Logic)

### Transactions - beforeValidate

- Auto-set `createdBy` from `req.user`
- Type-dependent required fields — see M24 type table for full matrix. Key rules:
  - Deposit types (`INVESTOR_DEPOSIT`, `STAGE_SETTLEMENT`) → require `cashRegister` + `investment`
  - `COMPANY_FUNDING`, `OTHER_DEPOSIT` → require `cashRegister`
  - `INVESTMENT_EXPENSE` → require `cashRegister` + `investment`
  - `ACCOUNT_FUNDING` → require `cashRegister` + `worker`
  - `EMPLOYEE_EXPENSE` → require `worker`, NO cash register. `investment` optional (relaxed in M27).
  - `REGISTER_TRANSFER` → require `cashRegister` (source) + `targetRegister`
  - `OTHER` → require `cashRegister` + `otherCategory`

### Transactions - afterChange (create/update/delete)

- Recalculate `cashRegister.balance` — **skip for EMPLOYEE_EXPENSE** (no register involved)
- For `REGISTER_TRANSFER` → recalculate BOTH source (`cashRegister`) and target (`targetRegister`) balances
- If type has `investment` → recalculate `investment.totalCosts`
- Worker sub-account balance is computed on-read (no stored field needed)

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

### M10: Mobile Navigation UX ✅ DONE

- [x] Increased hamburger button touch target (`p-2.5` → `p-3`, 48px)
- [x] Increased Sheet close button touch target (`p-1.5`, icon `size-4` → `size-6`)
- [x] Added Framer Motion animations to mobile nav drawer (overlay fade + panel slide-from-left via `AnimatePresence` + `motion.div`)
- [x] Kept Radix Dialog for accessibility (focus trap, escape, aria), disabled its CSS animations
- **Modified**: `src/components/layouts/mobile-nav.tsx`, `src/components/layouts/mobile-menu-toggle.tsx`, `src/components/ui/sheet.tsx`

### M11: Cache + Revalidation ✅ DONE

- [x] Cache infrastructure: `src/lib/cache/tags.ts` (tag constants), `src/lib/cache/revalidate.ts` (revalidation helpers)
- [x] Hook factory: `src/hooks/revalidate-collection.ts` — shared `afterChange`/`afterDelete` hooks calling `revalidateCollection()`
- [x] Wrapped expensive fetches with `unstable_cache`: navigation reference data (4 collection tags), all worker saldos, individual employee saldo
- [x] Replaced `revalidatePath()` with `revalidateCollections()` in server actions (`transactions/actions.ts`, `settlements/actions.ts`)
- [x] Added revalidation hooks to all 5 collection configs (cash-registers, investments, users, other-categories, transactions)
- [x] Extracted `ROLES`/`RoleT`/`ROLE_LABELS` from `users.ts` into `src/lib/auth/roles.ts` to break server→client import chain
- **New files**: `src/lib/cache/tags.ts`, `src/lib/cache/revalidate.ts`, `src/hooks/revalidate-collection.ts`, `src/lib/auth/roles.ts`
- **Modified**: 12+ files (navigation, pages, actions, hooks, collections)

### M12: Session Duration ✅ DONE

- [x] Extended Payload session from default 2h to 24h (`auth: { tokenExpiration: 86400 }`)
- **Modified**: `src/collections/users.ts`

### M13: Deployment ✅ DONE

- [x] Vercel project setup
- [x] Neon Postgres provisioning + data migrated
- [x] File storage — Vercel Blob via `@payloadcms/storage-vercel-blob@3.73.0`, configured in `payload.config.ts` plugin. Requires `BLOB_READ_WRITE_TOKEN` env var.
- [x] Production build verification — `pnpm build` succeeds. Fixed dead `format-date.ts` (removed) and seed script type errors (`type`/`paymentMethod` widened to `string` instead of literal unions).
- [x] Email adapter — `@payloadcms/email-nodemailer@3.73.0` + `nodemailer` with SMTP (seohost.pl). Requires `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS` env vars.
- [x] Environment variables audit — ensure all env vars are set in Vercel (`DATABASE_URL`, `PAYLOAD_SECRET`, `BLOB_READ_WRITE_TOKEN`, `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`)
- [x] Test email route (`GET /api/test-email?to=...`) — ADMIN-only, verifies SMTP connection before sending
- **New deps**: `@payloadcms/storage-vercel-blob@3.73.0`, `@payloadcms/email-nodemailer@3.73.0`, `nodemailer`, `@types/nodemailer` (dev)
- **Modified**: `src/payload.config.ts`, `src/scripts/seed-transactions.ts`, `src/scripts/seed-ziutek-advances.ts`
- **Deleted**: `src/lib/format-date.ts` (dead code, referenced deleted i18n module)
- **Success**: App live on Vercel, all features working

---

### M14: Centralized Query Layer + lib/ Cleanup ✅ DONE

- [x] Shared pagination helper (`src/lib/pagination.ts`) — `parsePagination()`, `buildPaginationMeta()`, constants
- [x] Query files: `src/lib/queries/` — transactions, investments, cash-registers, users, employees, reference-data
- [x] All queries self-contained — each creates own Payload instance, wrapped with `unstable_cache` + tag-based invalidation
- [x] Pages no longer manage Payload instances — just call cached query functions
- [x] Server actions consolidated into `src/lib/actions/` (auth, transactions, settlements)
- [x] Table configs consolidated into `src/lib/tables/` (one file per entity: type + columns + mapper)
- [x] Schemas moved to `src/lib/schemas/` (transactions)
- [x] Navigation `fetchReferenceData` moved to `src/lib/queries/reference-data.ts`
- [x] `getUserCashRegisterIds` wrapped with `unstable_cache`
- [x] Inline `payload.find()` calls in pages replaced with proper cached query functions
- [x] Dead code removed: `getEmployeeMonthData`, `EmployeeMonthDataT`, `SerializedTransactionT`
- **Final `src/lib/` structure**:
  ```
  lib/
  ├── actions/       (auth.ts, transactions.ts, settlements.ts)
  ├── auth/          (get-current-user.ts, get-user-cash-registers.ts, permissions.ts, roles.ts)
  ├── cache/         (tags.ts, revalidate.ts)
  ├── constants/     (transactions.ts)
  ├── db/            (sum-transactions.ts)
  ├── queries/       (transactions.ts, cash-registers.ts, investments.ts, users.ts, employees.ts, reference-data.ts)
  ├── schemas/       (transactions.ts)
  ├── tables/        (transactions.tsx, cash-registers.tsx, investments.tsx, users.tsx)
  └── [utilities]    (cn.ts, env.ts, pagination.ts, format-currency.ts)
  ```
- **Verified**: `pnpm typecheck` (0 errors), `pnpm lint` (0 errors)

---

### M15: Migrate `unstable_cache` → `use cache` Directive ✅ DONE

- [x] Enabled `cacheComponents: true` in `next.config.ts`
- [x] Migrated all query functions from `unstable_cache` wrapper → `'use cache'` directive + `cacheTag()` inside function body
- [x] Removed manual `keyParts` arrays — cache key derived from function arguments automatically
- [x] Split `employees.ts` (`'use server'`) — cached data functions moved to new `src/lib/queries/employee-data.ts` (`'use cache'`), server action wrappers remain in `employees.ts`
- [x] `revalidateTag()` in actions and hooks unchanged — works identically with `use cache`
- **Modified**: `next.config.ts`, `src/lib/queries/transactions.ts`, `src/lib/queries/cash-registers.ts`, `src/lib/queries/investments.ts`, `src/lib/queries/users.ts`, `src/lib/queries/employees.ts`, `src/lib/queries/reference-data.ts`, `src/lib/auth/get-user-cash-registers.ts`
- **New file**: `src/lib/queries/employee-data.ts`
- **Verified**: `pnpm typecheck` (0 errors), `pnpm lint` (0 errors)

### M16: Table Column Management ✅ DONE

- [x] Column visibility toggle — `src/components/ui/column-toggle.tsx` dropdown with `Settings2` icon, respects `meta.canHide` and `meta.label`
- [x] Column definition meta — `src/lib/tables/column-meta.ts` augments TanStack Table with `label` and `canHide` properties
- [x] Persist visibility to localStorage — `src/components/ui/data-table.tsx` reads/writes `table-columns:{storageKey}` key
- [x] Applied to transaction and investment tables with `storageKey` prop
- [x] Clickable table rows — whole row is a navigable link where relevant
- [x] Dropdown stays open on checkbox toggle (`onSelect` with `preventDefault`)
- **New files**: `src/components/ui/column-toggle.tsx`, `src/lib/tables/column-meta.ts`
- **Modified**: `src/components/ui/data-table.tsx`, table column definitions in `src/lib/tables/`

### M16.1: Settlement Form Refactor — TanStack Form + Per-Line Invoices ✅ DONE

- [x] Settlement Zod schemas — client (string values) + server (typed) for both settlement and zero-saldo forms
- [x] Settlement server actions refactored — `createSettlementAction(data, invoiceFormData)` and `zeroSaldoAction(data)` accept typed data instead of raw FormData, with schema validation via `safeParse`
- [x] Settlement form rewritten with `useAppForm` — TanStack Form array fields (`form.Field mode="array"` + `pushValue`/`removeValue`) for line items, `form.AppField` for all other fields, `useStore` for reactive total, `listeners.onChange` on worker field for saldo fetch, `useFormStatus` for submit/invalid state, `useCheckFormErrors` for dev debugging
- [x] Per-line-item invoice uploads — each line item row has its own file input, files tracked via `useRef<Map<number, File>>`, re-indexed on row removal, sent as `invoice-0`, `invoice-1`, ... in FormData
- [x] Server action handles per-line files — uploads each file separately to media collection, links each transaction to its own mediaId
- [x] Global `invoiceNote` as fallback — each line item must have either its own file OR the global note
- [x] Zero-saldo dialog rewritten with `useAppForm` — same TanStack Form pattern, `zeroSaldoFormSchema` validation, typed submit handler
- [x] Client-side field-level error display (was toast-only before)
- **New file**: `src/lib/schemas/settlements.ts`
- **Modified**: `src/lib/actions/settlements.ts`, `src/components/settlements/settlement-form.tsx`, `src/components/settlements/zero-saldo-dialog.tsx`

- **Verified**: `pnpm typecheck` (0 errors), `pnpm lint` (0 new errors)

### M17: Reports

- [ ] Filterable report views (date range, investment, worker, register)
- [ ] Daily / monthly / yearly summaries
- [ ] Data tables with TanStack Table (sorting, filtering, pagination)
- **Files**: `src/app/(frontend)/reports/`
- **Success**: OWNER/MANAGER can generate filtered reports

### M18: Mobile Modal Overflow Fix ✅ DONE

- [x] Fixed horizontal overflow on mobile for transaction, settlement, and zero-saldo modals
- [x] Full-screen modals on mobile (sheet/drawer pattern), standard dialog on desktop
- [x] Form fields constrained to viewport width
- **Modified**: `src/components/ui/dialog.tsx`, modal components
- **Verified**: Tested at 320px–428px viewport widths

### M19: Invoices View & Download ✅ DONE

- [x] Dedicated page for browsing/searching uploaded invoices
- [x] Filtering by date, worker, investment
- [x] Download/preview functionality
- [x] Downloadable invoice PDF in every transaction table (cross-cutting)
- **Files**: `src/app/(frontend)/faktury/`, `src/components/transactions/transaction-data-table.tsx`

### M20: Add/Replace Invoice on Existing Transactions ✅ DONE

- [x] Edit transaction action — upload + attach invoice to existing transaction
- [x] Inline "Dodaj fakturę" button in transaction table rows
- [x] Permission: MANAGER own transactions, ADMIN/OWNER any
- [x] Revalidate transaction cache after update
- **Files**: `src/lib/actions/transactions.ts`, `src/components/transactions/`

---

### M21: Performance Audit & Optimization ⬅️ TOP PRIORITY

> **Problem**: App feels slow everywhere — page navigations are the worst offender, mutations (e.g. adding a transaction) take ~3 seconds with a loader. Should feel instant.

#### Root Causes (from code analysis)

**A. Mutation overhead (transaction create = ~3 seconds)**

Each `payload.create('transactions')` triggers a synchronous hook chain that blocks the response:

1. `beforeValidate` — validation (fast, no DB)
2. `afterChange` in `recalculate-balances.ts`:
   - `sumRegisterBalance()` — 1 SQL SUM query
   - `payload.update('cash-registers')` — 1 DB write → triggers its own `afterChange` hook → `revalidateCollection('cashRegisters')`
   - `sumInvestmentCosts()` — 1 SQL SUM query (if investment-linked)
   - `payload.update('investments')` — 1 DB write → triggers its own `afterChange` hook → `revalidateCollection('investments')`
   - `revalidateCollections(['transactions', 'cashRegisters'])` ← 1st revalidation
3. `afterChange` in `revalidate-collection.ts`:
   - `revalidateCollection('transactions')` ← 2nd revalidation (DUPLICATE)
4. Back in `createTransactionAction`:
   - `revalidateCollections(['transactions', 'cashRegisters'])` ← 3rd revalidation (DUPLICATE)

**Total**: 5-7 DB round trips + 3x duplicate cache invalidation, all synchronous.

**B. Cache invalidation is too broad (page navigations slow)**

Cache tags are **collection-level** only (`collection:transactions`, `collection:cash-registers`, etc.). Creating 1 transaction invalidates ALL `transactions`-tagged caches globally — every dashboard, every list page, every employee saldo, every investment detail. On next navigation, Next.js must re-run all those queries from scratch.

**C. Settlement is catastrophically slow**

Creates N transactions in a **sequential loop**, each with the full hook chain. 5 line items = ~30 DB operations + 6x cache invalidation, all sequential.

#### Implementation Plan

##### Phase 1: Baseline measurement (instrument before changing anything)

Establish hard numbers so every subsequent change can be measured against the baseline.

- [ ] **Server action timing** — wrap `createTransactionAction`, `createSettlementAction`, `zeroSaldoAction` with `performance.now()` measuring: total action time, Payload `create()` call time, time spent in hooks (returned via context or measured around the call), revalidation time.
- [ ] **Hook timing** — instrument `recalcAfterChange` and `recalcAfterDelete` in `recalculate-balances.ts`: measure each SQL SUM query, each `payload.update()`, and revalidation calls separately.
- [ ] **Page load timing** — instrument key cached query functions (`findTransactions`, `findAllCashRegisters`, `findActiveInvestments`, `getUserSaldo`, `getCachedEmployeeSaldo`) with `performance.now()` to measure cache hit vs miss times.
- [ ] **Log format** — structured logs: `[PERF] <operation> <duration>ms` so they're easy to grep. Include context (e.g., transaction type, number of line items for settlements).
- [ ] **Capture baseline** — run through the key flows (create transaction, create settlement with 3-5 items, navigate dashboard → transactions → worker detail → back) and record the numbers.

##### Phase 2: Quick wins (remove waste)

- [ ] **Remove duplicate revalidation** — `createTransactionAction` and `recalcAfterChange` both call `revalidateCollections`. Remove from action, keep in hook only. Same for settlement actions.
- [ ] **Remove cascading hook revalidation** — `payload.update('cash-registers')` inside the transaction hook triggers the cash-registers collection `afterChange` hook, which calls `revalidateCollection('cashRegisters')` again. Either skip hooks on these internal updates (`context: { skipRevalidation: true }`) or remove the generic revalidation hook from cash-registers/investments since the transaction hook already handles it.
- [ ] **Re-measure** — run the same flows from Phase 1, compare numbers.

##### Phase 3: Mutation speed (make creates feel instant)

- [ ] **Parallelize balance recalculation** — `sumRegisterBalance` + `sumInvestmentCosts` can run in parallel (`Promise.all`), then both `payload.update()` calls can also run in parallel.
- [ ] **Investigate: fire-and-forget balance recalc** — balance recalculation doesn't need to block the response. The user doesn't need to wait for the cash register balance to update before seeing "transaction created." Explore running recalculation after the response is sent (e.g., `waitUntil()` from `next/server`, or `after()` from Next.js 15+).
- [ ] **Settlement: batch transaction creation** — replace sequential loop with `Promise.all` for media uploads, then `Promise.all` for transaction creates. Or explore Payload's bulk create if available. Revalidate once at the end, not per-transaction.

##### Phase 4: Navigation speed (smarter caching)

- [ ] **Loading skeletons** — audit all pages for `loading.tsx` files. Any page without one feels frozen during data fetching. Add skeletons for dashboard, transaction list, worker detail, investment detail, cash register detail.
- [ ] **Granular cache tags** — replace collection-wide tags with entity-specific tags where it matters most:
  - `cashRegister:${id}:balance` — only invalidate the affected register
  - `investment:${id}:costs` — only invalidate the affected investment
  - `user:${id}:saldo` — only invalidate the affected worker's saldo
  - Keep `collection:transactions` for list queries but add per-entity tags for detail queries
- [ ] **Investigate: partial revalidation** — when creating a transaction for worker X on cash register Y, only invalidate caches that involve X or Y, not the entire transactions collection.

##### Phase 5: Evaluate (Payload vs direct DB)

- [ ] **Compare Payload ORM vs direct Drizzle** — with instrumentation from Phase 1, measure `payload.find()` overhead vs raw SQL. If Payload's ORM adds >100ms per query, migrate hot-path reads to direct Drizzle (already available via `getDb()`).
- [ ] **Decision gate**: if Phases 1-3 bring mutation time to <500ms and navigation feels instant with cache hits, keep Payload. If not, plan migration to Prisma/Drizzle for the data layer.

- **Key files**: `src/hooks/transactions/recalculate-balances.ts`, `src/hooks/revalidate-collection.ts`, `src/lib/actions/transactions.ts`, `src/lib/actions/settlements.ts`, `src/lib/cache/tags.ts`, `src/lib/cache/revalidate.ts`, all `src/lib/queries/*.ts`, `loading.tsx` files
- **Success**: Transaction create <500ms, page navigation feels instant on cache hits, settlement proportional but parallelized

### Data Integrity: Balance Verification & Repair

> **Bug**: Cash register balances can become stale (non-zero with zero transactions). Root cause: `afterDelete` hook may not fire on bulk deletes via Payload admin, or hook errors swallow silently. Investment `totalCosts` likely has the same issue.

- [ ] **Recalculate all balances script** — admin-only server action or API route that re-runs `SUM()` for every cash register and every investment, updating stored balances. Use as a repair tool.
- [ ] **Investigate bulk delete** — confirm whether Payload's admin bulk delete triggers `afterDelete` per-doc or skips hooks. If it skips, add a `beforeBulkOperation` hook or disable bulk delete for transactions.
- [ ] **Periodic verification** — consider a lightweight check on dashboard load: compare displayed balance vs live `SUM()`. If mismatch, log warning and auto-repair.

### M21.1: Remove `/transakcje` Page (Merge into Dashboard)

> Dashboard and `/transakcje` render the same `TransactionDataTable` with the same filters. Eliminating the duplicate page removes redundant queries on navigation and simplifies the sidebar.

- [ ] **EMPLOYEE transactions on dashboard** — the employee dashboard already shows monthly transactions. Verify it covers the same data `/transakcje` showed (auto-filtered to `worker=self`, same columns hidden). If not, add the missing pieces.
- [ ] **Move investment filter to dashboard** — if `/transakcje` had an investment filter the dashboard lacks, add it to the dashboard's `TransactionDataTable`.
- [ ] **Remove `/transakcje` route** — delete `src/app/(frontend)/transakcje/page.tsx` and directory.
- [ ] **Remove sidebar item** — remove "Transakcje" from sidebar nav. Dashboard ("Kokpit") is the single entry point.
- [ ] **Update internal links** — any `href="/transakcje"` in the codebase should point to `"/"` or be removed.
- **Key files**: `src/app/(frontend)/transakcje/`, `src/components/layouts/sidebar/sidebar-nav.tsx`, `src/components/dashboard/manager-dashboard.tsx`, `src/components/dashboard/employee-dashboard-server.tsx`
- **Success**: One fewer page, one fewer set of queries, sidebar is simpler, all transaction browsing happens on dashboard

---

### M22: Bug Fixes & Form Polish

- [ ] **Debug Juri saldo bug** — investigate why saldo didn't update after receiving money. Check `recalcAfterChange` hook fires correctly for all transaction types, verify `sumEmployeeSaldo` SQL covers the relevant type.
- [ ] **Form reset after successful submit** — audit all forms (transaction, settlement, zero-saldo). Ensure TanStack Form `reset()` is called on success. Check if dialog close triggers reset.
- [ ] **Investment column in transaction tables** — add `investment` column to `src/lib/tables/transactions.tsx` (all contexts: transaction list, cash register detail, worker detail, investment detail).
- [ ] **Investment filter on transaction list page** — add investment filter to `/transakcje` URL-based filters alongside existing type/cash-register/date-range filters.
- [ ] **Remove invoiceNote requirement** — `invoiceNote` is never required (no "invoice OR invoiceNote" validation). Remove from `validateTransaction` hook, settlement action validation, and any frontend form-level required checks.
- **Key files**: `src/hooks/transactions/recalculate-balances.ts`, `src/hooks/transactions/validate.ts`, `src/lib/db/sum-transactions.ts`, `src/components/transactions/transaction-form.tsx`, `src/components/settlements/settlement-form.tsx`, `src/components/settlements/zero-saldo-dialog.tsx`, `src/lib/tables/transactions.tsx`, `src/app/(frontend)/transakcje/`
- **Success**: Saldo always consistent after any transaction type, all forms reset cleanly, investment visible and filterable in tables

### M23: Naming Overhaul

Rename terminology across the entire codebase to match business language.

#### Rename "Zaliczka" → "Zasilenie konta współpracownika"

- [ ] **DB migration** — `UPDATE transactions SET type = 'ACCOUNT_FUNDING' WHERE type = 'ADVANCE'`
- [ ] **Payload collection** — update `TRANSACTION_TYPES` option value + labels (pl: "Zasilenie konta współpracownika", en: "Account Funding")
- [ ] **Constants** — update `src/lib/constants/transactions.ts`: type enum, labels map, `needsWorker()` helper
- [ ] **SQL queries** — update all raw SQL in `src/lib/db/sum-transactions.ts` that reference `'ADVANCE'` → `'ACCOUNT_FUNDING'`
- [ ] **Validation hook** — update `src/hooks/transactions/validate.ts` type checks
- [ ] **Balance hook** — update `src/hooks/transactions/recalculate-balances.ts` if it references `ADVANCE`
- [ ] **Frontend forms** — update transaction form, settlement form type references
- [ ] **Schemas** — update Zod schemas in `src/lib/schemas/`

#### Rename "Transakcje" → "Transfery"

- [ ] **Sidebar** — rename nav item label from "Transakcje" to "Transfery"
- [ ] **Page titles** — `/transakcje` page heading, breadcrumbs
- [ ] **Payload admin labels** — collection `labels.singular`/`labels.plural` (pl: "Transfer"/"Transfery", en: "Transfer"/"Transfers")
- [ ] **Table headers** — any reference to "transakcja" in table columns
- [ ] **URL route** — consider renaming `/transakcje` → `/transfery` (breaking change for bookmarks — evaluate if worth it or defer)

- **Migration**: `20260217_rename_advance_to_account_funding.ts`
- **Key files**: `src/collections/transactions.ts`, `src/lib/constants/transactions.ts`, `src/lib/db/sum-transactions.ts`, `src/hooks/transactions/validate.ts`, `src/hooks/transactions/recalculate-balances.ts`, `src/lib/schemas/transactions.ts`, `src/components/layouts/sidebar/`, page components
- **Success**: All UI shows "Zasilenie konta współpracownika" and "Transfery", DB stores `ACCOUNT_FUNDING`, no references to old names remain

### M24: Transaction Type System Overhaul

> **Resolved design decisions:**
>
> - **Q1 (Investment saldo):** Deferred — keep `totalCosts` as positive accumulator for now. Revisit if/when investor payments are implemented.
> - **Q2 (Employee expense + register):** `EMPLOYEE_EXPENSE` has **no cash register field at all**. Clean separation: advances go through registers, employee expenses go through worker accounts only.
> - **Q3 (Register transfers):** Implement as a single `REGISTER_TRANSFER` transaction with `sourceRegister` (= `cashRegister`) + `targetRegister` field.
> - **Q4 (Deposit subtypes):** Separate top-level transaction types (not a subtype field).

#### New transaction type enum

Replace current: `DEPOSIT | INVESTMENT_EXPENSE | ACCOUNT_FUNDING | EMPLOYEE_EXPENSE | OTHER`

With expanded set:

| Type                 | Polish label                    | Requires fields                                    | Register balance effect                |
| -------------------- | ------------------------------- | -------------------------------------------------- | -------------------------------------- |
| `INVESTOR_DEPOSIT`   | Wpłata od inwestora             | `cashRegister`, `investment`                       | +amount to register                    |
| `STAGE_SETTLEMENT`   | Rozliczenie etapu               | `cashRegister`, `investment`                       | +amount to register                    |
| `COMPANY_FUNDING`    | Zasilenie z konta firmowego     | `cashRegister`                                     | +amount to register                    |
| `OTHER_DEPOSIT`      | Inna wpłata                     | `cashRegister`                                     | +amount to register                    |
| `INVESTMENT_EXPENSE` | Wydatek inwestycyjny            | `cashRegister`, `investment`                       | -amount from register                  |
| `ACCOUNT_FUNDING`    | Zasilenie konta współpracownika | `cashRegister`, `worker`                           | -amount from register                  |
| `EMPLOYEE_EXPENSE`   | Wydatek pracowniczy             | `worker`, `investment` (optional)                  | **no register effect**                 |
| `REGISTER_TRANSFER`  | Transfer między kasami          | `cashRegister` (source), `targetRegister` (target) | -amount from source, +amount to target |
| `OTHER`              | Inne                            | `cashRegister`, `otherCategory`                    | -amount from register                  |

#### Implementation tasks

- [ ] **Remove `DEPOSIT` type** — replaced by 4 specific deposit types (`INVESTOR_DEPOSIT`, `STAGE_SETTLEMENT`, `COMPANY_FUNDING`, `OTHER_DEPOSIT`)
- [ ] **DB migration** — update enum values, add `target_register_id` column, migrate existing `DEPOSIT` rows to `OTHER_DEPOSIT` (or appropriate subtype), remove `cash_register_id` requirement
- [ ] **Remove `cashRegister` from `EMPLOYEE_EXPENSE`** — field not applicable. Existing EMPLOYEE_EXPENSE rows: set `cash_register_id = NULL` in migration.
- [ ] **Add `targetRegister` field** — relationship → CashRegisters, visible only when type = `REGISTER_TRANSFER`
- [ ] **Update Payload collection** — new type options with pl/en labels, conditional field visibility:
  - `investment`: visible when type in (`INVESTOR_DEPOSIT`, `STAGE_SETTLEMENT`, `INVESTMENT_EXPENSE`, `EMPLOYEE_EXPENSE`)
  - `worker`: visible when type in (`ACCOUNT_FUNDING`, `EMPLOYEE_EXPENSE`)
  - `cashRegister`: visible for all types EXCEPT `EMPLOYEE_EXPENSE`
  - `targetRegister`: visible only for `REGISTER_TRANSFER`
  - `otherCategory`: visible only for `OTHER`
- [ ] **Update validation hook** — new type→field requirement matrix (see table above)
- [ ] **Update constants** — `src/lib/constants/transactions.ts`: new type enum, labels, `needsInvestment()`, `needsWorker()`, `needsCashRegister()`, `needsTargetRegister()` helpers
- [ ] **Update `sumRegisterBalance` SQL** — deposit types add, expense types subtract, `EMPLOYEE_EXPENSE` excluded, `REGISTER_TRANSFER` subtracts from source:
  ```sql
  CASE
    WHEN type IN ('INVESTOR_DEPOSIT', 'STAGE_SETTLEMENT', 'COMPANY_FUNDING', 'OTHER_DEPOSIT') THEN amount
    WHEN type = 'EMPLOYEE_EXPENSE' THEN 0
    ELSE -amount
  END
  ```
  Plus a separate query/addition for `REGISTER_TRANSFER` deposits (where `target_register_id = registerId`):
  ```sql
  + COALESCE((SELECT SUM(amount) FROM transactions WHERE target_register_id = registerId AND type = 'REGISTER_TRANSFER'), 0)
  ```
- [ ] **Update `sumInvestmentCosts`** — include `INVESTOR_DEPOSIT` and `STAGE_SETTLEMENT` as income? (Deferred per Q1 — only count costs for now)
- [ ] **Update `recalculate-balances` hook** — skip register recalc for `EMPLOYEE_EXPENSE`. For `REGISTER_TRANSFER`, recalc BOTH source and target registers.
- [ ] **Update `sumEmployeeSaldo` / `sumAllWorkerSaldos`** — currently uses `ADVANCE` (will be `ACCOUNT_FUNDING` after M23). Verify no other type changes needed.
- [ ] **Update frontend forms** — transaction form conditional field logic, new type select options, remove cash register for EMPLOYEE_EXPENSE, add target register for REGISTER_TRANSFER
- [ ] **Update schemas** — Zod schemas for new type enum + conditional field requirements
- [ ] **Update table columns/filters** — new type labels in tables, type filter updated
- **Migration**: `20260217_transaction_type_overhaul.ts` — new enum values, `target_register_id` column, data migration for existing rows
- **Key files**: `src/collections/transactions.ts`, `src/hooks/transactions/validate.ts`, `src/hooks/transactions/recalculate-balances.ts`, `src/lib/db/sum-transactions.ts`, `src/lib/constants/transactions.ts`, `src/lib/schemas/transactions.ts`, `src/components/transactions/transaction-form.tsx`, `src/lib/queries/transactions.ts`
- **Depends on**: M23 (naming — `ADVANCE` already renamed to `ACCOUNT_FUNDING`)
- **Success**: All new types work end-to-end, register balances correct, no double-charging on employee expenses

### M25: Cash Flow Integrity & Lockdown

- [ ] **Restrict balance editing in Payload admin** — remove manual balance override for ALL roles. Balance field becomes truly computed-only (remove `update` access, keep `admin.readOnly: true`).
- [ ] **Consider disabling transaction editing** — evaluate if editing existing transactions should be blocked (safer for accounting). Only corrections via new offsetting transactions.
- [ ] **Verify cash flow integrity** — write a verification script/action that checks: `SUM(all deposits) - SUM(all withdrawals) = SUM(all register balances)`. Run against existing data.
- [ ] **Fix any existing data inconsistencies** — if M24 migration reveals balance discrepancies from the double-charge bug, recalculate all register balances.
- **Depends on**: M24

### M26: Cash Register Permissions

- [ ] **Add `type` field to CashRegisters** — `MAIN` | `AUXILIARY` (select field, default `AUXILIARY`)
- [ ] **DB migration** — add `type` column, update existing "Kasa główna" to `MAIN`
- [ ] **Access control: read** — `MAIN` registers restricted to ADMIN/OWNER. `AUXILIARY` registers readable by MANAGER.
- [ ] **Frontend filter** — register lists/dropdowns filter by user role + register type. MANAGER sees only `AUXILIARY` registers.
- [ ] **Dashboard** — MANAGER dashboard shows only auxiliary register balances. OWNER/ADMIN sees all.
- [ ] **Forms** — cash register select in transaction/settlement forms respects role-based visibility
- **Key files**: `src/collections/cash-registers.ts`, `src/access/index.ts`, `src/lib/queries/cash-registers.ts`, `src/lib/queries/reference-data.ts`, `src/components/transactions/transaction-form.tsx`, `src/components/settlements/settlement-form.tsx`, dashboard components
- **Migration**: `20260217_add_cash_register_type.ts`
- **Success**: MANAGER cannot see or select "Kasa główna", OWNER sees everything

### M27: Settlement Relaxation

- [ ] **Make `investment` optional** — remove required validation on `investment` field in settlement form and `createSettlementAction`
- [ ] **Allow adding investment later** — extend existing M20 edit action to support adding/changing `investment` on existing transactions
- [ ] **Expense subtype in settlement** — evaluate adding a type selector to settlement line items (e.g., "Materiały", "Robocizna", "Inne")
- **Key files**: `src/hooks/transactions/validate.ts`, `src/lib/schemas/settlements.ts`, `src/components/settlements/settlement-form.tsx`, `src/lib/actions/settlements.ts`, `src/lib/actions/transactions.ts`
- **Success**: Settlement submittable without investment or invoice, both can be attached later

### M28: Investment View Enhancements

- [ ] **Labor costs stat** — add "Koszty robocizny" card to investment detail page (SUM of `EMPLOYEE_EXPENSE` where investment matches)
- [ ] **Materials costs stat** — add "Koszty materiałów" card (SUM of `INVESTMENT_EXPENSE` where investment matches)
- [ ] **Transaction type filter** — add type filter/breakdown on investment detail page transaction table
- [ ] **Investment balance** — if M24 introduces signed investment saldo (income - costs), display net balance on investment detail
- **Depends on**: M24/M25 (saldo model), M22 (investment column)
- **Key files**: `src/app/(frontend)/inwestycje/[id]/page.tsx`, `src/lib/db/sum-transactions.ts`, `src/lib/queries/investments.ts`

---

## Milestone Dependency Graph

```
M21 (Perf) ─── in progress
  │
  ├── M22 (Bugs/Polish) ─── independent, quick wins
  │
  ├── M23 (Naming) ─── independent, safe rename
  │     │
  │     └── M24 (Type System) ─── depends on M23 + design decisions Q1-Q4
  │           │
  │           ├── M25 (Cash Flow) ─── depends on M24
  │           │
  │           ├── M27 (Settlement) ─── depends on M24 validation changes
  │           │
  │           └── M28 (Investment View) ─── depends on M24/M25
  │
  └── M26 (Register Permissions) ─── independent of type changes
```

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
