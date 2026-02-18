# M26: Cash Register Permissions — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `MAIN`/`AUXILIARY` type to cash registers so MANAGER only sees AUXILIARY registers, while ADMIN/OWNER sees all. Block register deletion for all roles.

**Architecture:** Add a `type` select field to `CashRegisters` collection. Filter at query layer (`fetchReferenceData` SQL) and component layer (dashboard, forms, list pages). No Payload access-control-based filtering since raw SQL bypasses it.

**Tech Stack:** Payload CMS collections, raw SQL migration, Next.js server components, TypeScript

---

### Task 1: Database Migration

**Files:**

- Create: `src/migrations/20260218_add_cash_register_type.ts`
- Modify: `src/migrations/index.ts`

**Step 1: Create migration file**

```typescript
// src/migrations/20260218_add_cash_register_type.ts
import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Create enum type
  await db.execute(sql`
    CREATE TYPE enum_cash_registers_type AS ENUM ('MAIN', 'AUXILIARY');
  `)

  // Add column with default AUXILIARY
  await db.execute(sql`
    ALTER TABLE cash_registers
      ADD COLUMN type enum_cash_registers_type NOT NULL DEFAULT 'AUXILIARY';
  `)

  // Set "Kasa główna" to MAIN
  await db.execute(sql`
    UPDATE cash_registers SET type = 'MAIN' WHERE name = 'Kasa główna';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE cash_registers DROP COLUMN IF EXISTS type;
    DROP TYPE IF EXISTS enum_cash_registers_type;
  `)
}
```

**Step 2: Register migration in index**

Add to `src/migrations/index.ts` after the last entry:

```typescript
import * as migration_20260218_add_cash_register_type from './20260218_add_cash_register_type'

// ... in the array:
  {
    up: migration_20260218_add_cash_register_type.up,
    down: migration_20260218_add_cash_register_type.down,
    name: '20260218_add_cash_register_type',
  },
```

**Step 3: Run migration**

Run: `pnpm payload migrate`
Expected: Migration runs, `cash_registers` table has `type` column, "Kasa główna" is `MAIN`, others are `AUXILIARY`.

**Step 4: Commit**

```bash
git add src/migrations/20260218_add_cash_register_type.ts src/migrations/index.ts
git commit -m "feat(M26): add cash register type migration (MAIN/AUXILIARY)"
```

---

### Task 2: Collection Config

**Files:**

- Modify: `src/collections/cash-registers.ts`

**Step 1: Add type field, block delete, update read access**

Changes to `src/collections/cash-registers.ts`:

1. Add `isAdminOrOwnerOrManager` to imports (already exists in `@/access`)
2. Change `read` access from `isAdminOrOwner` to `isAdminOrOwnerOrManager`
3. Set `delete` access to `() => false`
4. Add `type` field before the `balance` field:

```typescript
{
  name: 'type',
  type: 'select',
  required: true,
  defaultValue: 'AUXILIARY',
  label: { en: 'Type', pl: 'Typ' },
  options: [
    { label: { en: 'Main', pl: 'Główna' }, value: 'MAIN' },
    { label: { en: 'Auxiliary', pl: 'Pomocnicza' }, value: 'AUXILIARY' },
  ],
  admin: {
    condition: (_, __, { user }) =>
      user?.role === 'ADMIN' || user?.role === 'OWNER',
  },
},
```

**Step 2: Regenerate types**

Run: `pnpm generate:types`
Expected: `src/payload-types.ts` updated with `type: 'MAIN' | 'AUXILIARY'` on `CashRegister`

**Step 3: Verify**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/collections/cash-registers.ts src/payload-types.ts
git commit -m "feat(M26): add type field to CashRegisters, block delete, open read to MANAGER"
```

---

### Task 3: Query Layer — Reference Data

**Files:**

- Modify: `src/lib/queries/reference-data.ts`

**Step 1: Add `type` to SQL select and `ReferenceDataT`**

In `src/lib/queries/reference-data.ts`:

1. Update `RefItemT` — add a shared base, create extended type for cash registers:

```typescript
type RefItemT = { readonly id: number; readonly name: string }
type CashRegisterRefItemT = RefItemT & { readonly type: 'MAIN' | 'AUXILIARY' }

export type ReferenceDataT = {
  readonly cashRegisters: CashRegisterRefItemT[]
  readonly investments: RefItemT[]
  readonly workers: RefItemT[]
  readonly otherCategories: RefItemT[]
}
```

2. Update the SQL to select `type` for cash registers:

```sql
SELECT 'cashRegisters' AS collection, id, name, type FROM cash_registers
UNION ALL
SELECT 'investments' AS collection, id, name, NULL AS type FROM investments WHERE status = 'active'
UNION ALL
SELECT 'workers' AS collection, id, name, NULL AS type FROM users
UNION ALL
SELECT 'otherCategories' AS collection, id, name, NULL AS type FROM other_categories
```

3. Update the row mapping to include `type`:

```typescript
for (const row of result.rows) {
  const collection = row.collection as string
  if (collection === 'cashRegisters') {
    data.cashRegisters.push({
      id: Number(row.id),
      name: row.name as string,
      type: (row.type as 'MAIN' | 'AUXILIARY') ?? 'AUXILIARY',
    })
  } else {
    data[collection]?.push({
      id: Number(row.id),
      name: row.name as string,
    })
  }
}
```

Note: `data` initialization needs `cashRegisters` as a separate mutable typed array. Simplest approach — initialize `cashRegisters` separately and cast at the end.

**Step 2: Verify**

Run: `pnpm typecheck`
Expected: Possibly errors in consumers of `ReferenceDataT` that now get `CashRegisterRefItemT` instead of `RefItemT`. These are fixed in later tasks.

**Step 3: Commit**

```bash
git add src/lib/queries/reference-data.ts
git commit -m "feat(M26): add type field to reference data cash registers query"
```

---

### Task 4: Query Layer — Cash Register Rows

**Files:**

- Modify: `src/lib/tables/cash-registers.tsx`
- Modify: `src/lib/queries/cash-registers.ts`

**Step 1: Add `type` to `CashRegisterRowT`**

In `src/lib/tables/cash-registers.tsx`, update the type:

```typescript
export type CashRegisterRowT = {
  readonly id: number
  readonly name: string
  readonly ownerName: string
  readonly balance: number
  readonly type: 'MAIN' | 'AUXILIARY'
}
```

**Step 2: Add `type` to `mapCashRegisterRows`**

In `src/lib/queries/cash-registers.ts`, update `mapCashRegisterRows`:

```typescript
return docs.map((cr) => ({
  id: cr.id as number,
  name: cr.name as string,
  ownerName:
    typeof cr.owner === 'number' ? (workersMap.get(cr.owner) ?? '—') : getOwnerName(cr.owner),
  balance: (cr.balance ?? 0) as number,
  type: (cr.type as 'MAIN' | 'AUXILIARY') ?? 'AUXILIARY',
}))
```

**Step 3: Verify**

Run: `pnpm typecheck`
Expected: 0 errors (or errors in dashboard components — fixed in Task 5)

**Step 4: Commit**

```bash
git add src/lib/tables/cash-registers.tsx src/lib/queries/cash-registers.ts
git commit -m "feat(M26): add type to CashRegisterRowT and mapper"
```

---

### Task 5: Dashboard — Filter for MANAGER

**Files:**

- Modify: `src/components/dashboard/manager-dashboard.tsx`

**Step 1: Filter cash registers by role**

In `src/components/dashboard/manager-dashboard.tsx`:

1. The component already has `user` from `getCurrentUserJwt()` and `isAdmin` check. Add a role check:

```typescript
const isAdminOrOwner = user?.role === 'ADMIN' || user?.role === 'OWNER'
```

2. After `mapCashRegisterRows`, filter for MANAGER:

```typescript
const cashRegisters = mapCashRegisterRows(rawCashRegisters, workersMap)
const visibleRegisters = isAdminOrOwner
  ? cashRegisters
  : cashRegisters.filter((cr) => cr.type === 'AUXILIARY')
```

3. Replace all uses of `cashRegisters` with `visibleRegisters`:
   - `totalBalance` calculation
   - `DashboardTables` prop
   - `TransferTableServer` filters prop

**Step 2: Verify**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/components/dashboard/manager-dashboard.tsx
git commit -m "feat(M26): filter MAIN registers from MANAGER dashboard"
```

---

### Task 6: Navigation — Filter Reference Data for Forms

**Files:**

- Modify: `src/components/nav/navigation.tsx`

**Step 1: Filter cashRegisters in reference data before passing to TopNav**

In `src/components/nav/navigation.tsx`, after fetching `referenceData`:

```typescript
// Filter MAIN registers for MANAGER
const filteredRefData = referenceData
  ? {
      ...referenceData,
      cashRegisters:
        user.role === 'ADMIN' || user.role === 'OWNER'
          ? referenceData.cashRegisters
          : referenceData.cashRegisters.filter((cr) => cr.type === 'AUXILIARY'),
    }
  : undefined
```

Pass `filteredRefData` to `<TopNav>` instead of `referenceData`.

Note: `TopNav` and its children (`AddTransferDialog`, `TransferForm`) use `ReferenceDataT` which now has `CashRegisterRefItemT[]` for `cashRegisters`. The `ReferenceItemT` in `add-transfer-dialog.tsx` needs updating to accept the `type` field. Simplest: make `ReferenceItemT` accept extra props or update it to include optional `type`.

**Step 2: Update `ReferenceItemT` in `add-transfer-dialog.tsx`**

In `src/components/dialogs/add-transfer-dialog.tsx`:

```typescript
export type ReferenceItemT = { id: number; name: string; type?: string }
```

This is additive — existing consumers don't break.

**Step 3: Verify**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/components/nav/navigation.tsx src/components/dialogs/add-transfer-dialog.tsx
git commit -m "feat(M26): filter MAIN registers from MANAGER form dropdowns"
```

---

### Task 7: Cash Register Detail Page — Block MANAGER from MAIN

**Files:**

- Modify: `src/app/(frontend)/kasa/[id]/page.tsx`

**Step 1: Add MAIN register guard**

In `src/app/(frontend)/kasa/[id]/page.tsx`, after fetching the register and checking `notFound()`:

```typescript
const register = await getCashRegister(id)
if (!register) notFound()

// Block MANAGER from viewing MAIN registers
if (user.role === 'MANAGER' && register.type === 'MAIN') notFound()
```

This prevents MANAGER from navigating directly to `/kasa/<main-register-id>`.

**Step 2: Verify**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 3: Commit**

```bash
git add "src/app/(frontend)/kasa/[id]/page.tsx"
git commit -m "feat(M26): block MANAGER from MAIN register detail page"
```

---

### Task 8: Update PLAN.md + Final Verification

**Files:**

- Modify: `PLAN.md`

**Step 1: Run full verification**

Run: `pnpm typecheck && pnpm lint`
Expected: 0 errors on both

**Step 2: Update PLAN.md**

Mark M26 as done with implementation details, key files, and verification status.

**Step 3: Commit**

```bash
git add PLAN.md
git commit -m "docs: mark M26 as done"
```

---

## File Change Summary

| File                                                | Change                                             |
| --------------------------------------------------- | -------------------------------------------------- |
| `src/migrations/20260218_add_cash_register_type.ts` | **NEW** — enum + column + data migration           |
| `src/migrations/index.ts`                           | Register new migration                             |
| `src/collections/cash-registers.ts`                 | Add `type` field, block delete, update read access |
| `src/payload-types.ts`                              | Auto-regenerated                                   |
| `src/lib/queries/reference-data.ts`                 | Add `type` to SQL + `ReferenceDataT`               |
| `src/lib/tables/cash-registers.tsx`                 | Add `type` to `CashRegisterRowT`                   |
| `src/lib/queries/cash-registers.ts`                 | Add `type` to `mapCashRegisterRows`                |
| `src/components/dashboard/manager-dashboard.tsx`    | Filter AUXILIARY for MANAGER                       |
| `src/components/nav/navigation.tsx`                 | Filter reference data by role                      |
| `src/components/dialogs/add-transfer-dialog.tsx`    | Add optional `type` to `ReferenceItemT`            |
| `src/app/(frontend)/kasa/[id]/page.tsx`             | Block MANAGER from MAIN register detail            |
| `PLAN.md`                                           | Mark M26 done                                      |
