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

| Field | Type   | Notes                                                          |
| ----- | ------ | -------------------------------------------------------------- |
| name  | text   | required                                                       |
| email | email  | required, unique                                               |
| role  | select | `ADMIN` / `OWNER` / `MANAGER` / `EMPLOYEE`, saveToJWT         |

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

| Field            | Type         | Notes                                                                   |
| ---------------- | ------------ | ----------------------------------------------------------------------- |
| description      | text         | what the money was spent on                                             |
| amount           | number       | always positive, direction determined by type                           |
| date             | date         | when the transaction occurred                                           |
| type             | select       | `INVESTMENT_EXPENSE` / `ADVANCE` / `EMPLOYEE_EXPENSE` / `OTHER`         |
| paymentMethod    | select       | `CASH` / `BLIK` / `TRANSFER` / `CARD`                                   |
| cashRegister     | relationship | → CashRegisters (source of funds)                                       |
| investment       | relationship | → Investments (required if type = INVESTMENT_EXPENSE or EMPLOYEE_EXPENSE) |
| worker           | relationship | → Users (required if type = ADVANCE or EMPLOYEE_EXPENSE)                  |
| invoice          | upload       | → Media                                                                 |
| invoiceNote      | textarea     | required if no invoice attached                                         |
| otherCategory    | relationship | → OtherCategories (required if type = OTHER)                            |
| otherDescription | textarea     | required if type = OTHER and category not in predefined list            |
| createdBy        | relationship | → Users, auto-set via hook                                              |

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

| Collection      | ADMIN          | OWNER     | MANAGER                      | EMPLOYEE                 |
| --------------- | -------------- | --------- | ---------------------------- | ------------------------ |
| Users           | full CRUD      | full CRUD | read all                     | read self only           |
| CashRegisters   | full CRUD      | full CRUD | read all, update own balance | no access                |
| Investments     | full CRUD      | full CRUD | read all                     | no access                |
| Transactions    | full CRUD      | full CRUD | create, read all, update own | read own (worker = self) |
| OtherCategories | full CRUD      | full CRUD | read                         | no access                |
| Media           | full CRUD      | full CRUD | create, read                 | read own                 |
| Payload Admin   | full access    | no access | no access                    | no access                |

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

### M4: Transactions & Business Logic

- [ ] Transactions collection with all fields and conditional visibility
- [ ] Validation hooks (beforeValidate)
- [ ] Balance update hooks (afterChange)
- [ ] Invoice upload configuration
- **Files**: `src/collections/transactions.ts`, `src/hooks/`, `src/collections/media.ts`
- **Success**: Creating a transaction updates register balance and investment costs correctly

### M5: Custom Dashboard & Views

- [ ] App layout with role-based navigation
- [ ] Dashboard with overview cards (register balances, recent transactions)
- [ ] Investment list + detail page with TanStack Table
- [ ] Cash register list + detail
- **Files**: `src/app/(frontend)/layout.tsx` (updated), `src/app/(frontend)/page.tsx`, `src/app/(frontend)/investments/`, `src/app/(frontend)/cash-registers/`, `src/components/`
- **Success**: Functional dashboard with real data from Payload

### M6: Transaction Management & Worker Sub-accounts

- [ ] New transaction form with conditional fields (Shadcn form + Zod validation)
- [ ] Worker sub-account view (balance, history)
- [ ] EMPLOYEE portal (read-only own data)
- **Files**: `src/app/(frontend)/transactions/`, `src/app/(frontend)/workers/`, `src/app/(frontend)/my-account/`
- **Success**: Full transaction creation flow, EMPLOYEE can see own balance

### M7: Settlement Flow

- [ ] MANAGER settlement page for processing EMPLOYEE invoices
- [ ] Invoice line-item calculator (add items, auto-sum)
- [ ] Batch creation of EMPLOYEE_EXPENSE transactions
- [ ] Sub-account zeroing flow (ZALICZKA NA POCZET WYPLATY)
- **Files**: `src/app/(frontend)/settlement/`, `src/components/settlement/`
- **Success**: MANAGER can settle EMPLOYEE invoices end-to-end

### M8: Reports

- [ ] Filterable report views (date range, investment, worker, register)
- [ ] Daily / monthly / yearly summaries
- [ ] Data tables with TanStack Table (sorting, filtering, pagination)
- **Files**: `src/app/(frontend)/reports/`
- **Success**: OWNER/MANAGER can generate filtered reports

### M9: Deployment

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
