# M17: Worker Monthly Report — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-worker period filtering, summary stats, and a printable report route to the worker detail page.

**Architecture:** Reuse the existing `TransferFilters` component (extracted to shared location) on the worker detail page. Add a new SQL aggregation query for period breakdown (advances vs expenses). Create a dedicated print route that fetches all transfers without pagination.

**Tech Stack:** Next.js 16 App Router, Payload CMS queries, `@payloadcms/db-vercel-postgres` raw SQL, `use cache` + `cacheTag`, Tailwind CSS `@media print`.

---

### Task 1: Extract TransferFilters to shared location

The `TransferFilters` component is currently co-located with the transfers page. Move it to a shared location so both `/transakcje` and `/uzytkownicy/[id]` can use it. The component currently hardcodes `/transakcje` as the base URL for navigation — make it configurable via a `baseUrl` prop.

**Files:**

- Move: `src/app/(frontend)/transakcje/_components/transfer-filters.tsx` → `src/components/transfers/transfer-filters.tsx`
- Modify: `src/app/(frontend)/transakcje/page.tsx` (update import)

**Step 1: Add `baseUrl` prop and move the file**

In the moved file, add a `baseUrl` prop to `TransferFiltersPropsT`:

```typescript
type TransferFiltersPropsT = {
  cashRegisters: ReferenceItemT[]
  baseUrl: string
  className?: string
}
```

Update `updateParam` to use `baseUrl` instead of hardcoded `'/transakcje'`:

```typescript
function updateParam(key: string, value: string) {
  router.push(buildUrlWithParams(baseUrl, searchParams.toString(), { [key]: value, page: '' }))
}
```

Update `clearFilters` to use `baseUrl`:

```typescript
function clearFilters() {
  router.push(baseUrl)
}
```

**Step 2: Update the transactions page import**

In `src/app/(frontend)/transakcje/page.tsx`, change line 7:

```typescript
// Before
import { TransferFilters } from './_components/transfer-filters'

// After
import { TransferFilters } from '@/components/transfers/transfer-filters'
```

And pass the `baseUrl` prop:

```typescript
<TransferFilters cashRegisters={cashRegisterOptions} baseUrl="/transakcje" className="mt-6" />
```

**Step 3: Delete the old file**

Delete `src/app/(frontend)/transakcje/_components/transfer-filters.tsx`.

**Step 4: Verify**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 5: Commit**

```bash
git add -A && git commit -m "refactor: extract TransferFilters to shared location"
```

---

### Task 2: SQL aggregation — sumWorkerPeriodBreakdown

Add a new SQL function that returns advances, expenses, and net saldo for a worker within a date range. Follows the same pattern as existing functions in `src/lib/db/sum-transfers.ts`.

**Files:**

- Modify: `src/lib/db/sum-transfers.ts` (add function to existing file)

**Step 1: Add the function**

Add to the bottom of `src/lib/db/sum-transfers.ts`:

```typescript
export type WorkerPeriodBreakdownT = {
  totalAdvances: number
  totalExpenses: number
  periodSaldo: number
}

/**
 * Returns advances, expenses, and net saldo for a worker in a date range.
 * Single SQL query with CASE WHEN grouping.
 */
export const sumWorkerPeriodBreakdown = async (
  payload: Payload,
  workerId: number,
  dateRange: DateRangeT,
): Promise<WorkerPeriodBreakdownT> => {
  const db = await getDb(payload)

  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'ADVANCE' THEN amount ELSE 0 END), 0) AS advances,
      COALESCE(SUM(CASE WHEN type = 'EMPLOYEE_EXPENSE' THEN amount ELSE 0 END), 0) AS expenses
    FROM transactions
    WHERE worker_id = ${workerId}
      AND type IN ('ADVANCE', 'EMPLOYEE_EXPENSE')
      AND date >= ${dateRange.start}
      AND date <= ${dateRange.end}
  `)

  const advances = Number(result.rows[0].advances)
  const expenses = Number(result.rows[0].expenses)

  return {
    totalAdvances: advances,
    totalExpenses: expenses,
    periodSaldo: advances - expenses,
  }
}
```

**Step 2: Verify**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/lib/db/sum-transfers.ts && git commit -m "feat: add sumWorkerPeriodBreakdown SQL aggregation"
```

---

### Task 3: Cached query wrapper for period breakdown

Wrap the SQL function with `'use cache'` + `cacheTag` in the queries layer.

**Files:**

- Modify: `src/lib/queries/users.ts` (add cached wrapper)

**Step 1: Add the cached function**

Add to `src/lib/queries/users.ts`:

```typescript
import { sumEmployeeSaldo, sumWorkerPeriodBreakdown } from '@/lib/db/sum-transfers'
import type { WorkerPeriodBreakdownT } from '@/lib/db/sum-transfers'
```

Note: `sumEmployeeSaldo` is already imported — just add `sumWorkerPeriodBreakdown` and the type to the existing import.

Then add the function:

```typescript
export async function getWorkerPeriodBreakdown(
  workerId: string,
  from: string,
  to: string,
): Promise<WorkerPeriodBreakdownT> {
  'use cache'
  cacheTag(CACHE_TAGS.transfers)

  const payload = await getPayload({ config })
  return sumWorkerPeriodBreakdown(payload, Number(workerId), { start: from, end: to })
}
```

**Step 2: Verify**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/lib/queries/users.ts && git commit -m "feat: add cached getWorkerPeriodBreakdown query"
```

---

### Task 4: Add a query function for all transfers (no pagination)

The print route needs ALL transfers for a worker + filters without pagination. Add a `findAllTransfers` query function.

**Files:**

- Modify: `src/lib/queries/transfers.ts`

**Step 1: Add the function**

Add to `src/lib/queries/transfers.ts`:

```typescript
export async function findAllTransfers({
  where = {},
  sort = '-date',
}: {
  readonly where?: Where
  readonly sort?: string
}) {
  'use cache'
  cacheTag(CACHE_TAGS.transfers)

  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'transactions',
    where,
    sort,
    pagination: false,
    depth: 1,
  })

  return result.docs.map(mapTransferRow)
}
```

**Step 2: Verify**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/lib/queries/transfers.ts && git commit -m "feat: add findAllTransfers query (no pagination)"
```

---

### Task 5: Add filters and period stats to worker detail page

Wire up `TransferFilters` + `StatCard` period stats on the existing worker detail page.

**Files:**

- Modify: `src/app/(frontend)/uzytkownicy/[id]/page.tsx`

**Step 1: Add imports**

Add to the imports:

```typescript
import { findTransfers, buildTransferFilters } from '@/lib/queries/transfers'
import { getWorkerPeriodBreakdown } from '@/lib/queries/users'
import { TransferFilters } from '@/components/transfers/transfer-filters'
```

Remove the direct `findTransfers` import if it's already there (it is — line 7). Replace it with the one that also imports `buildTransferFilters`.

**Step 2: Build where clause from search params**

After `parsePagination`, build the where clause using the existing `buildTransferFilters` helper. Force the worker filter:

```typescript
const filters = buildTransferFilters(sp, { id: Number(id), isManager: false })
// buildTransferFilters with isManager: false always adds worker = id
```

Wait — `buildTransferFilters` uses `userContext.id` for the worker filter when `isManager` is false. But here the worker ID comes from the URL param `id` (the target user), not the current user. So we need to build the where clause manually, reusing the filter parts for type/cashRegister/date but forcing `worker = id`:

```typescript
// Build filters from search params (type, cashRegister, date range)
const baseFilters = buildTransferFilters(sp, { id: Number(id), isManager: false })
// buildTransferFilters already sets worker = id when isManager is false
```

Actually, `buildTransferFilters` with `isManager: false` and `id: Number(id)` will set `worker = { equals: Number(id) }` plus any type/cashRegister/date filters. This is exactly what we want. The `Number(id)` is the target worker ID.

**Step 3: Update the Promise.all data fetching**

Replace the current `findTransactions` call with the filtered version, and add the period breakdown:

```typescript
const fromParam = typeof sp.from === 'string' ? sp.from : undefined
const toParam = typeof sp.to === 'string' ? sp.to : undefined
const hasDateRange = fromParam && toParam

const [
  { rows, paginationMeta },
  saldo,
  periodBreakdown,
  activeInvestments,
  cashRegisters,
  managerRegisterIds,
] = await Promise.all([
  findTransfers({
    where: baseFilters,
    page,
    limit,
  }),
  getUserSaldo(id),
  hasDateRange ? getWorkerPeriodBreakdown(id, fromParam, toParam) : Promise.resolve(undefined),
  findActiveInvestments(),
  findAllCashRegisters(),
  getUserCashRegisterIds(user.id, user.role),
])
```

**Step 4: Add filters UI and period stats to the JSX**

After the saldo stat card section and before the transactions table, add:

```tsx
{/* Filters */}
<SectionHeader className="mt-8">Transfery</SectionHeader>
<TransferFilters
  cashRegisters={cashRegisters.map((c) => ({ id: c.id, name: c.name }))}
  baseUrl={`/uzytkownicy/${id}`}
  className="mt-4"
/>

{/* Period stats — only shown when date range is active */}
{periodBreakdown && (
  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
    <StatCard label="Zaliczki w okresie" value={formatPLN(periodBreakdown.totalAdvances)} />
    <StatCard label="Wydatki w okresie" value={formatPLN(periodBreakdown.totalExpenses)} />
    <StatCard label="Saldo okresu" value={formatPLN(periodBreakdown.periodSaldo)} />
  </div>
)}
```

Also add a "Drukuj raport" link that opens the print route in a new tab. Build the URL with the same search params:

```tsx
{
  hasDateRange && (
    <div className="mt-4 flex justify-end">
      <a
        href={`/uzytkownicy/${id}/raport?${new URLSearchParams(
          Object.fromEntries(
            Object.entries({
              from: fromParam,
              to: toParam,
              type: sp.type,
              cashRegister: sp.cashRegister,
            })
              .filter(([, v]) => typeof v === 'string' && v !== '')
              .map(([k, v]) => [k, String(v)]),
          ),
        ).toString()}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary text-sm font-medium hover:underline"
      >
        Drukuj raport &rarr;
      </a>
    </div>
  )
}
```

**Step 5: Verify**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 6: Commit**

```bash
git add src/app/\(frontend\)/uzytkownicy/\[id\]/page.tsx && git commit -m "feat: add filters and period stats to worker detail page"
```

---

### Task 6: Print route — `/uzytkownicy/[id]/raport`

Create the server-rendered print page that shows ALL transactions for the worker.

**Files:**

- Create: `src/app/(frontend)/uzytkownicy/[id]/raport/page.tsx`

**Step 1: Create the print page**

```typescript
import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { getUser } from '@/lib/queries/users'
import { getWorkerPeriodBreakdown } from '@/lib/queries/users'
import { findAllTransactions, buildTransactionFilters } from '@/lib/queries/transactions'
import { formatPLN } from '@/lib/format-currency'
import { ROLE_LABELS, type RoleT } from '@/lib/auth/roles'
import {
  TRANSACTION_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  type TransactionTypeT,
  type PaymentMethodT,
} from '@/lib/constants/transactions'
import type { TransactionRowT } from '@/lib/tables/transactions'
import { PrintButton } from './print-button'

type PagePropsT = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function WorkerReportPage({ params, searchParams }: PagePropsT) {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const { id } = await params
  const sp = await searchParams

  const targetUser = await getUser(id)
  if (!targetUser) notFound()

  const fromParam = typeof sp.from === 'string' ? sp.from : undefined
  const toParam = typeof sp.to === 'string' ? sp.to : undefined

  if (!fromParam || !toParam) {
    redirect(`/uzytkownicy/${id}`)
  }

  const where = buildTransactionFilters(sp, { id: Number(id), isManager: false })

  const [rows, periodBreakdown] = await Promise.all([
    findAllTransactions({ where }),
    getWorkerPeriodBreakdown(id, fromParam, toParam),
  ])

  const periodLabel = `${formatDate(fromParam)} — ${formatDate(toParam)}`

  return (
    <div className="mx-auto max-w-4xl p-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{targetUser.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {ROLE_LABELS[targetUser.role as RoleT]?.pl ?? targetUser.role} &middot;{' '}
            {targetUser.email}
          </p>
          <p className="text-muted-foreground mt-0.5 text-sm">Okres: {periodLabel}</p>
        </div>
        <PrintButton />
      </div>

      {/* Summary stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <SummaryCard label="Zaliczki" value={formatPLN(periodBreakdown.totalAdvances)} />
        <SummaryCard label="Wydatki" value={formatPLN(periodBreakdown.totalExpenses)} />
        <SummaryCard label="Saldo okresu" value={formatPLN(periodBreakdown.periodSaldo)} />
      </div>

      {/* Full transaction table */}
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 font-medium">Data</th>
            <th className="pb-2 font-medium">Opis</th>
            <th className="pb-2 font-medium">Typ</th>
            <th className="pb-2 font-medium">Metoda</th>
            <th className="pb-2 text-right font-medium">Kwota</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b">
              <td className="py-1.5">{formatDate(row.date)}</td>
              <td className="py-1.5">{row.description}</td>
              <td className="py-1.5">
                {TRANSACTION_TYPE_LABELS[row.type as TransactionTypeT] ?? row.type}
              </td>
              <td className="py-1.5">
                {PAYMENT_METHOD_LABELS[row.paymentMethod as PaymentMethodT] ?? row.paymentMethod}
              </td>
              <td className="py-1.5 text-right font-medium">{formatPLN(row.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && (
        <p className="text-muted-foreground mt-4 text-center text-sm">
          Brak transakcji w wybranym okresie.
        </p>
      )}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
    </div>
  )
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
```

**Step 2: Create the PrintButton client component**

Create `src/app/(frontend)/uzytkownicy/[id]/raport/print-button.tsx`:

```typescript
'use client'

import { Button } from '@/components/ui/button'

export function PrintButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.print()}
      className="print:hidden"
    >
      Drukuj
    </Button>
  )
}
```

**Step 3: Verify**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/app/\(frontend\)/uzytkownicy/\[id\]/raport/ && git commit -m "feat: add printable worker report route"
```

---

### Task 7: Print styles

Add `@media print` CSS to hide non-essential UI on the print route. The report page components already use `print:hidden` on the print button. Add global print styles to hide the sidebar/nav layout wrapper.

**Files:**

- Modify: `src/styles/globals.css`

**Step 1: Add print media query**

Add to the bottom of `globals.css` (before the closing of the file):

```css
@media print {
  /* Hide navigation and sidebar */
  nav,
  [data-slot='sidebar'],
  [data-slot='mobile-nav'] {
    display: none !important;
  }

  /* Remove page padding — the report has its own */
  body {
    background: white !important;
  }

  /* Remove shadows and borders for cleaner print */
  * {
    box-shadow: none !important;
  }
}
```

Check what `data-slot` values the sidebar/nav components use and adjust selectors accordingly. The exact selectors may need tweaking — check `src/components/layouts/` for the sidebar wrapper element.

**Step 2: Verify**

Open `/uzytkownicy/[id]/raport?from=2026-01-01&to=2026-01-31` in browser, use Print Preview (Cmd+P) — should show only the report content, no sidebar/nav.

**Step 3: Commit**

```bash
git add src/styles/globals.css && git commit -m "feat: add print styles for worker report"
```

---

### Task 8: Final verification

**Step 1: Type check and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: 0 type errors, 0 new lint errors

**Step 2: Manual testing checklist**

1. `/transakcje` — filters still work (no regression from component move)
2. `/uzytkownicy/5` — page loads, shows worker info + saldo + transactions
3. `/uzytkownicy/5?from=2026-01-01&to=2026-01-31` — filters applied, period stats visible, print link appears
4. `/uzytkownicy/5?from=2026-01-01&to=2026-01-31&type=ADVANCE` — type filter applied on top of date range
5. Click "Drukuj raport" — opens new tab with full transaction list
6. Cmd+P on report page — print preview shows clean layout
7. `/uzytkownicy/5/raport` (no dates) — redirects back to detail page

**Step 3: Commit**

```bash
git add -A && git commit -m "feat(M17): worker monthly report with filters, stats, and print route"
```
