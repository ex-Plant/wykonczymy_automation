# M28: Investment View Enhancements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add income tracking, manual labor costs, and P&L balance to investment detail page. Financial stats visible to OWNER/ADMIN only.

**Architecture:** Add `totalIncome` (computed via hooks) and `laborCosts` (manual) fields to Investments collection. New `sumInvestmentIncome()` SQL function. Hook recalculates both `totalCosts` and `totalIncome` on transfer CRUD. Detail page conditionally renders stat cards by role.

**Tech Stack:** Payload CMS collections, raw SQL migration + aggregation, Next.js server components

---

### Task 1: Database Migration

**Files:**

- Create: `src/migrations/20260218_add_investment_financials.ts`
- Modify: `src/migrations/index.ts`

**Step 1: Create migration file**

```typescript
// src/migrations/20260218_add_investment_financials.ts
import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE investments
      ADD COLUMN total_income numeric DEFAULT 0 NOT NULL,
      ADD COLUMN labor_costs numeric DEFAULT 0 NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE investments
      DROP COLUMN IF EXISTS total_income,
      DROP COLUMN IF EXISTS labor_costs;
  `)
}
```

**Step 2: Register in `src/migrations/index.ts`**

Add import and entry after the last migration (`20260218_add_cash_register_type`).

**Step 3: Run migration**

Run: `pnpm payload migrate`

**Step 4: Commit**

```bash
git add src/migrations/20260218_add_investment_financials.ts src/migrations/index.ts
git commit -m "feat(M28): add total_income and labor_costs columns to investments"
```

---

### Task 2: Collection Config

**Files:**

- Modify: `src/collections/investments.ts`

**Step 1: Add imports and fields**

Add `isAdminOrOwnerField` to the import from `@/access`.

Add two new fields AFTER `totalCosts`:

```typescript
{
  name: 'totalIncome',
  type: 'number',
  defaultValue: 0,
  label: { en: 'Total Income', pl: 'Wpłaty od inwestora' },
  admin: {
    readOnly: true,
    description: {
      en: 'Updated automatically via deposit transfers',
      pl: 'Aktualizowane automatycznie przez wpłaty',
    },
  },
  access: {
    update: () => false,
  },
},
{
  name: 'laborCosts',
  type: 'number',
  defaultValue: 0,
  label: { en: 'Labor Costs', pl: 'Koszty robocizny' },
  admin: {
    description: {
      en: 'Manually entered labor costs',
      pl: 'Ręcznie wprowadzone koszty robocizny',
    },
  },
  access: {
    update: isAdminOrOwnerField,
  },
},
```

**Step 2: Regenerate types**

Run: `pnpm generate:types`

**Step 3: Verify**

Run: `pnpm typecheck`

**Step 4: Commit**

```bash
git add src/collections/investments.ts src/payload-types.ts
git commit -m "feat(M28): add totalIncome and laborCosts fields to Investments collection"
```

---

### Task 3: SQL Aggregation Function

**Files:**

- Modify: `src/lib/db/sum-transfers.ts`

**Step 1: Add `sumInvestmentIncome` function**

Add after `sumInvestmentCosts`:

```typescript
/**
 * SUM income for an investment using SQL aggregation.
 * Only INVESTOR_DEPOSIT and STAGE_SETTLEMENT types count.
 */
export const sumInvestmentIncome = async (
  payload: Payload,
  investmentId: number,
  req?: PayloadRequest,
): Promise<number> => {
  const db = await getDb(payload, req)

  const result = await db.execute(sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE investment_id = ${investmentId}
      AND type IN ('INVESTOR_DEPOSIT', 'STAGE_SETTLEMENT')
  `)

  return Number(result.rows[0].total)
}
```

**Step 2: Verify**

Run: `pnpm typecheck`

**Step 3: Commit**

```bash
git add src/lib/db/sum-transfers.ts
git commit -m "feat(M28): add sumInvestmentIncome SQL aggregation function"
```

---

### Task 4: Recalculate Balances Hook

**Files:**

- Modify: `src/hooks/transfers/recalculate-balances.ts`

**Step 1: Import `sumInvestmentIncome`**

Update the import line:

```typescript
import {
  getDb,
  sumRegisterBalance,
  sumInvestmentCosts,
  sumInvestmentIncome,
} from '@/lib/db/sum-transfers'
```

**Step 2: Add income type constants**

After the existing `COST_TYPES`:

```typescript
const INCOME_TYPES = ['INVESTOR_DEPOSIT', 'STAGE_SETTLEMENT'] as const
```

**Step 3: Update `recalcInvestmentCosts` to also recalculate income**

Rename `recalcInvestmentCosts` to `recalcInvestmentFinancials`. Update it to calculate both costs and income in parallel and write both in a single UPDATE:

```typescript
const recalcInvestmentFinancials = async (
  payload: Payload,
  investmentId: number,
  req: PayloadRequest,
): Promise<void> => {
  const [totalCosts, totalIncome] = await Promise.all([
    perf(`hook.sumInvestmentCosts(${investmentId})`, () =>
      sumInvestmentCosts(payload, investmentId, req),
    ),
    perf(`hook.sumInvestmentIncome(${investmentId})`, () =>
      sumInvestmentIncome(payload, investmentId, req),
    ),
  ])

  await perf(`hook.updateInvestment(${investmentId})`, async () => {
    const db = await getDb(payload, req)
    await db.execute(sql`
      UPDATE investments
      SET total_costs = ${totalCosts}, total_income = ${totalIncome}, updated_at = NOW()
      WHERE id = ${investmentId}
    `)
  })
}
```

**Step 4: Update trigger conditions in `recalcAfterChange`**

Currently, investment recalc only fires for `COST_TYPES`. It now needs to fire for income types too. Replace the condition on line ~116:

```typescript
// Investment costs and income
const INVESTMENT_TYPES = [...COST_TYPES, ...INCOME_TYPES]
if (investmentId && INVESTMENT_TYPES.includes(doc.type as string)) {
  tasks.push(recalcInvestmentFinancials(req.payload, investmentId, req))
}
if (prevInvestmentId && prevInvestmentId !== investmentId) {
  tasks.push(recalcInvestmentFinancials(req.payload, prevInvestmentId, req))
}
```

**Step 5: Apply same change in `recalcAfterDelete`**

Update the condition on line ~163:

```typescript
if (investmentId && INVESTMENT_TYPES.includes(doc.type as string)) {
  tasks.push(recalcInvestmentFinancials(req.payload, investmentId, req))
}
```

**Step 6: Move `INVESTMENT_TYPES` to module level**

Define at the top of the file (after `COST_TYPES` and `INCOME_TYPES`):

```typescript
const INVESTMENT_TYPES = [...COST_TYPES, ...INCOME_TYPES] as const
```

Remove the inline definition from Step 4.

**Step 7: Update settlement action**

In `src/lib/actions/settlements.ts`, the balance recalculation block (lines ~113-122) currently only calls `sumInvestmentCosts`. Update it to also set `totalIncome`:

```typescript
await perf('settlement.recalcBalances', async () => {
  if (parsed.data.mode === 'investment' && parsed.data.investment) {
    const db = await getDb(payload)
    const investmentId = parsed.data.investment
    const [totalCosts, totalIncome] = await Promise.all([
      sumInvestmentCosts(payload, investmentId),
      sumInvestmentIncome(payload, investmentId),
    ])
    await db.execute(sql`
      UPDATE investments
      SET total_costs = ${totalCosts}, total_income = ${totalIncome}, updated_at = NOW()
      WHERE id = ${investmentId}
    `)
  }
})
```

Add `sumInvestmentIncome` to the import from `@/lib/db/sum-transfers`.

**Step 8: Verify**

Run: `pnpm typecheck`

**Step 9: Commit**

```bash
git add src/hooks/transfers/recalculate-balances.ts src/lib/actions/settlements.ts
git commit -m "feat(M28): recalculate investment income alongside costs in hooks"
```

---

### Task 5: Investment Detail Page — Role-Conditional Stats

**Files:**

- Modify: `src/app/(frontend)/inwestycje/[id]/page.tsx`

**Step 1: Add role check**

After the existing `user` check, determine if user is OWNER/ADMIN:

```typescript
const isOwnerOrAdmin = user.role === 'ADMIN' || user.role === 'OWNER'
```

**Step 2: Replace the single StatCard with conditional stat cards**

Replace the existing `<StatCard label="Koszty całkowite" ... />` block with:

```tsx
{
  isOwnerOrAdmin && (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Koszty inwestycji" value={formatPLN(investment.totalCosts ?? 0)} />
      <StatCard label="Wpłaty od inwestora" value={formatPLN(investment.totalIncome ?? 0)} />
      <StatCard label="Koszty robocizny" value={formatPLN(investment.laborCosts ?? 0)} />
      <StatCard
        label="Bilans"
        value={formatPLN(
          (investment.totalIncome ?? 0) -
            (investment.totalCosts ?? 0) -
            (investment.laborCosts ?? 0),
        )}
      />
    </div>
  )
}
```

**Step 3: Verify**

Run: `pnpm typecheck`

**Step 4: Commit**

```bash
git add "src/app/(frontend)/inwestycje/[id]/page.tsx"
git commit -m "feat(M28): add role-conditional financial stat cards to investment detail"
```

---

### Task 6: Update PLAN.md + Final Verification

**Files:**

- Modify: `PLAN.md`

**Step 1: Run full verification**

Run: `pnpm typecheck && pnpm lint`
Expected: 0 new errors

**Step 2: Update PLAN.md**

Mark M28 as done with implementation details, key files, and verification status.

**Step 3: Commit**

```bash
git add PLAN.md
git commit -m "docs: mark M28 as done"
```

---

## File Change Summary

| File                                                   | Change                                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| `src/migrations/20260218_add_investment_financials.ts` | **NEW** — total_income + labor_costs columns                               |
| `src/migrations/index.ts`                              | Register new migration                                                     |
| `src/collections/investments.ts`                       | Add `totalIncome`, `laborCosts` fields                                     |
| `src/payload-types.ts`                                 | Auto-regenerated                                                           |
| `src/lib/db/sum-transfers.ts`                          | Add `sumInvestmentIncome()`                                                |
| `src/hooks/transfers/recalculate-balances.ts`          | Recalculate income alongside costs, rename to `recalcInvestmentFinancials` |
| `src/lib/actions/settlements.ts`                       | Update settlement recalc to include income                                 |
| `src/app/(frontend)/inwestycje/[id]/page.tsx`          | Role-conditional stat cards (4 cards for OWNER/ADMIN)                      |
| `PLAN.md`                                              | Mark M28 done                                                              |
