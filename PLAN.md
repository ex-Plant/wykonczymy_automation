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

| Collection      | ADMIN       | OWNER     | MANAGER                      | EMPLOYEE                 |
| --------------- | ----------- | --------- | ---------------------------- | ------------------------ |
| Users           | full CRUD   | full CRUD | read all                     | read self only           |
| CashRegisters   | full CRUD   | full CRUD | read all, update own balance | no access                |
| Investments     | full CRUD   | full CRUD | read all                     | no access                |
| Transactions    | full CRUD   | full CRUD | create, read all, update own | read own (worker = self) |
| OtherCategories | full CRUD   | full CRUD | read                         | no access                |
| Media           | full CRUD   | full CRUD | create, read                 | read own                 |
| Payload Admin   | full access | no access | no access                    | no access                |

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

### M8.1: Form Defaults & Manager Cash Register Scoping

**Goal:** Default payment method to CASH across all forms. Lock Manager's own cash register in transaction/settlement forms (read access to all data remains unrestricted).

#### Task 1: Default payment method to CASH

**Files to modify:**
- `src/components/settlements/settlement-form.tsx` — `useState('')` → `useState('CASH')`
- `src/components/settlements/zero-saldo-dialog.tsx` — `useState('')` → `useState('CASH')`
- `src/components/transactions/transaction-form.tsx` — already `'CASH'`, no change needed

#### Task 2: Manager cash register locked in settlement/transaction forms

MANAGER sees all cash registers and all transactions (read access is unrestricted). But when **creating** transactions or settlements, Manager's own cash register is pre-selected and **cannot be changed** (select is disabled).

ADMIN/OWNER can freely choose any cash register in all forms.

**Server-side:** Pass `user` (role + id) to settlement/transaction pages so forms know the current user's own register.

**Resolve Manager's own register:**
```ts
// src/lib/auth/get-user-cash-registers.ts
async function getUserCashRegisterIds(userId: number, role: RoleT): Promise<number[] | undefined>
```
Returns register ids for MANAGER, `undefined` for ADMIN/OWNER (meaning "all/no restriction").

**Client-side behavior (all 3 forms):**
- `src/components/settlements/settlement-form.tsx` — if MANAGER: default to own register, disable select
- `src/components/settlements/zero-saldo-dialog.tsx` — same: default to own register, disable select
- `src/components/transactions/transaction-form.tsx` — same: default to own register, disable select

**Data flow:** Server page fetches ALL cash registers (for display) but also passes the Manager's own register id(s). Client forms use this to pre-select and lock the cash register field for MANAGER role.

#### Note: Adding workers & investments

Adding new workers (Users) and investments is handled exclusively via the **Payload admin panel** — no frontend forms needed. MANAGER already has read access; ADMIN/OWNER create entries in the admin panel.

---

### Future Milestones (not yet planned in detail)

### M9: Reports

- [ ] Filterable report views (date range, investment, worker, register)
- [ ] Daily / monthly / yearly summaries
- [ ] Data tables with TanStack Table (sorting, filtering, pagination)
- **Files**: `src/app/(frontend)/reports/`
- **Success**: OWNER/MANAGER can generate filtered reports

### M10: Invoices View

- [ ] Dedicated page for browsing/searching uploaded invoices (currently only accessible via individual transactions)
- [ ] Filtering by date, worker, investment
- [ ] Download/preview functionality
- [ ] Access control: decide who can view invoices (open question in M8.1)
- [ ] **Downloadable invoice links in transaction tables** — every transaction table (transactions page, dashboard recent, investment detail, settlement history, etc.) should display a download link/icon when the transaction has an attached invoice. This applies globally wherever transactions are rendered, not just the dedicated invoices page.
- **Files**: `src/app/(frontend)/faktury/`, transaction table components
- **Success**: Users can browse, search, and download invoices without navigating to each transaction; invoice downloads are also accessible inline from any transaction row

### M11: Deployment

- [ ] Vercel project setup
- [ ] Neon Postgres provisioning (swap DATABASE_URL)
- [ ] Uploadthing or Vercel Blob for file storage
- [ ] Email adapter (nodemailer) for production
- [ ] Environment variables configuration
- **Files**: `vercel.json` (if needed), env config
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
