# M16: Column Visibility Toggle + Clickable Rows — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add column show/hide toggles to Transactions and Investments tables, and make all table rows with detail pages clickable as full-row links.

**Architecture:** TanStack Table's built-in `columnVisibility` state wired to a `ColumnToggle` dropdown (Radix DropdownMenu). Preferences persisted in localStorage per table. Clickable rows via `getRowHref` prop on DataTable using `router.push` with Cmd/Ctrl+Click support.

**Tech Stack:** TanStack Table (existing), Radix DropdownMenu (existing Shadcn component), Next.js `useRouter`, localStorage.

---

## Task 1: Add column `meta.canHide` to transactions and investments column definitions

**Files:**

- Modify: `src/lib/tables/transactions.tsx`
- Modify: `src/lib/tables/investments.tsx`

TanStack Table columns accept an arbitrary `meta` object. We'll use `meta: { canHide: false }` to mark columns that must always stay visible. Columns without this meta (or `canHide: true`) are toggleable.

**Step 1: Add `ColumnMetaT` type declaration**

Create a TanStack Table module augmentation in `src/lib/tables/column-meta.ts`:

```typescript
import '@tanstack/react-table'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Column header label used in column toggle dropdown. Falls back to column id. */
    label?: string
    /** If false, column cannot be hidden by the user. Default: true. */
    canHide?: boolean
  }
}
```

**Step 2: Mark non-hideable columns in transactions**

In `src/lib/tables/transactions.tsx`, add `meta` to the `description` column:

```typescript
col.accessor('description', {
  id: 'description',
  header: 'Opis',
  cell: (info) => info.getValue(),
  meta: { canHide: false, label: 'Opis' },
}),
```

Add `meta: { label: '...' }` to every other column so the toggle dropdown has readable labels:

- `amount` → `label: 'Kwota'`
- `type` → `label: 'Typ'`
- `paymentMethod` → `label: 'Metoda'`
- `date` → `label: 'Data'`
- `cashRegister` → `label: 'Kasa'`
- `investment` → `label: 'Inwestycja'`
- `worker` → `label: 'Pracownik'`
- `otherCategory` → `label: 'Kategoria'`
- `invoice` → `label: 'Faktura'`

**Step 3: Mark non-hideable columns in investments**

In `src/lib/tables/investments.tsx`, add `meta` to the `name` column:

```typescript
col.accessor('name', {
  id: 'name',
  header: 'Nazwa',
  meta: { canHide: false, label: 'Nazwa' },
  cell: (info) => (
    <Link href={`/inwestycje/${info.row.original.id}`} className="hover:underline">
      {info.getValue()}
    </Link>
  ),
}),
```

Add `meta: { label: '...' }` to every other column:

- `totalCosts` → `label: 'Koszty'`
- `address` → `label: 'Adres'`
- `phone` → `label: 'Telefon'`
- `email` → `label: 'Email'`
- `contactPerson` → `label: 'Osoba kontaktowa'`
- `status` → `label: 'Status'`

**Step 4: Verify**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 5: Commit**

```bash
git add src/lib/tables/column-meta.ts src/lib/tables/transactions.tsx src/lib/tables/investments.tsx
git commit -m "feat(tables): add column meta with canHide and label for toggle support"
```

---

## Task 2: Create ColumnToggle component

**Files:**

- Create: `src/components/ui/column-toggle.tsx`

**Step 1: Write the ColumnToggle component**

```typescript
'use client'

import { type Table } from '@tanstack/react-table'
import { Settings2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

type ColumnTogglePropsT<TData> = {
  readonly table: Table<TData>
}

export function ColumnToggle<TData>({ table }: ColumnTogglePropsT<TData>) {
  const toggleableColumns = table
    .getAllColumns()
    .filter((col) => col.getCanHide() && col.columnDef.meta?.canHide !== false)

  if (toggleableColumns.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto gap-1.5">
          <Settings2 className="size-4" />
          Kolumny
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Widoczne kolumny</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {toggleableColumns.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.id}
            checked={col.getIsVisible()}
            onCheckedChange={(value) => col.toggleVisibility(!!value)}
          >
            {col.columnDef.meta?.label ?? col.id}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Step 2: Verify**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/components/ui/column-toggle.tsx
git commit -m "feat(ui): add ColumnToggle dropdown for table column visibility"
```

---

## Task 3: Wire column visibility + clickable rows into DataTable

**Files:**

- Modify: `src/components/ui/data-table.tsx`

This is the core task. We add:

1. `columnVisibility` state synced to localStorage
2. `getRowHref` prop for clickable rows
3. Expose `table` instance to parent via render prop (for ColumnToggle)

**Step 1: Update DataTable props and state**

Replace the full `data-table.tsx` with the updated version. Key changes:

Add to props type:

```typescript
type DataTablePropsT<TData> = {
  readonly data: readonly TData[]
  readonly columns: ColumnDef<TData, any>[]
  readonly emptyMessage?: string
  readonly enableVirtualization?: boolean
  readonly virtualRowHeight?: number
  readonly virtualContainerHeight?: number
  // New props:
  readonly storageKey?: string
  readonly getRowHref?: (row: TData) => string | undefined
  readonly toolbar?: (table: Table<TData>) => React.ReactNode
}
```

Add imports:

```typescript
import { useRouter } from 'next/navigation'
import { type Table, type VisibilityState } from '@tanstack/react-table'
```

Add localStorage helpers inside the component (before `useReactTable`):

```typescript
const STORAGE_PREFIX = 'table-columns:'

function readVisibility(key: string): VisibilityState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    return raw ? (JSON.parse(raw) as VisibilityState) : {}
  } catch {
    return {}
  }
}

function writeVisibility(key: string, state: VisibilityState) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}
```

Add state:

```typescript
const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
  storageKey ? readVisibility(storageKey) : {},
)
const router = useRouter()
```

Wire into `useReactTable`:

```typescript
const table = useReactTable({
  data: data as TData[],
  columns,
  state: { sorting, columnVisibility },
  onSortingChange: setSorting,
  onColumnVisibilityChange: (updater) => {
    setColumnVisibility((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (storageKey) writeVisibility(storageKey, next)
      return next
    })
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
})
```

**Step 2: Add clickable row handler**

Add a row click handler function inside the component:

```typescript
function handleRowClick(e: React.MouseEvent<HTMLTableRowElement>, href: string) {
  // Don't navigate if user clicked on a link or button inside the row
  const target = e.target as HTMLElement
  if (target.closest('a, button')) return

  if (e.metaKey || e.ctrlKey) {
    window.open(href, '_blank')
  } else {
    router.push(href)
  }
}
```

**Step 3: Update row rendering (non-virtual)**

Update the non-virtual `<tr>` to support clickable rows:

```tsx
rows.map((row) => {
  const href = getRowHref?.(row.original)
  return (
    <tr
      key={row.id}
      className={cn(
        'border-border border-b last:border-b-0',
        href && 'hover:bg-muted/50 cursor-pointer',
      )}
      onClick={href ? (e) => handleRowClick(e, href) : undefined}
    >
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="text-foreground px-4 py-3">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  )
})
```

Apply the same pattern to the virtualized `<tr>` block.

**Step 4: Render toolbar**

Add toolbar rendering above the table (inside the outer `<div>`, before the `<table>`):

```tsx
return (
  <div className="space-y-2">
    {toolbar && <div className="flex items-center">{toolbar(table)}</div>}
    <div className="border-border overflow-x-auto rounded-lg border">
      {/* existing table content */}
    </div>
  </div>
)
```

**Step 5: Verify**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 6: Commit**

```bash
git add src/components/ui/data-table.tsx
git commit -m "feat(data-table): add column visibility persistence and clickable rows"
```

---

## Task 4: Wire up TransactionDataTable with column toggle

**Files:**

- Modify: `src/components/transactions/transaction-data-table.tsx`

**Step 1: Add storageKey and toolbar**

```typescript
import { ColumnToggle } from '@/components/ui/column-toggle'

export function TransactionDataTable({
  data,
  paginationMeta,
  excludeColumns = [],
  baseUrl,
  className,
}: TransactionDataTablePropsT) {
  const columns = getTransactionColumns(excludeColumns)

  return (
    <div className={cn('space-y-4', className)}>
      <DataTable
        data={data}
        columns={columns}
        emptyMessage="Brak transakcji"
        storageKey="transactions"
        toolbar={(table) => <ColumnToggle table={table} />}
      />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl={baseUrl} />
    </div>
  )
}
```

No `getRowHref` — transactions don't have a detail page.

**Step 2: Verify**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/components/transactions/transaction-data-table.tsx
git commit -m "feat(transactions): wire column toggle into transaction table"
```

---

## Task 5: Wire up InvestmentDataTable with column toggle + clickable rows

**Files:**

- Modify: `src/app/(frontend)/inwestycje/_components/investment-data-table.tsx`

**Step 1: Add storageKey, toolbar, and getRowHref**

```typescript
import { ColumnToggle } from '@/components/ui/column-toggle'
import type { InvestmentRowT } from '@/lib/tables/investments'

export function InvestmentDataTable({ data, paginationMeta }: InvestmentDataTablePropsT) {
  return (
    <div className="space-y-4">
      <DataTable
        data={data}
        columns={investmentColumns}
        emptyMessage="Brak inwestycji"
        storageKey="investments"
        toolbar={(table) => <ColumnToggle table={table} />}
        getRowHref={(row: InvestmentRowT) => `/inwestycje/${row.id}`}
      />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl="/inwestycje" />
    </div>
  )
}
```

**Step 2: Verify**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/app/(frontend)/inwestycje/_components/investment-data-table.tsx
git commit -m "feat(investments): wire column toggle and clickable rows"
```

---

## Task 6: Wire up CashRegisterDataTable + UserDataTable with clickable rows

**Files:**

- Modify: `src/app/(frontend)/kasa/_components/cash-register-data-table.tsx`
- Modify: `src/components/users/user-data-table.tsx`

These two tables don't get column toggles (too few columns), but they get clickable rows.

**Step 1: CashRegisterDataTable**

```typescript
import type { CashRegisterRowT } from '@/lib/tables/cash-registers'

export function CashRegisterDataTable({ data, paginationMeta }: CashRegisterDataTablePropsT) {
  return (
    <div className="mt-6 space-y-4">
      <DataTable
        data={data}
        columns={cashRegisterColumns}
        emptyMessage="Brak kas"
        getRowHref={(row: CashRegisterRowT) => `/kasa/${row.id}`}
      />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl="/kasa" />
    </div>
  )
}
```

**Step 2: UserDataTable**

```typescript
import type { UserRowT } from '@/lib/tables/users'

export function UserDataTable({ data, paginationMeta }: UserDataTablePropsT) {
  return (
    <div className="space-y-4">
      <DataTable
        data={data}
        columns={userColumns}
        emptyMessage="Brak użytkowników"
        getRowHref={(row: UserRowT) => `/uzytkownicy/${row.id}`}
      />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl="/uzytkownicy" />
    </div>
  )
}
```

**Step 3: Verify**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/app/(frontend)/kasa/_components/cash-register-data-table.tsx src/components/users/user-data-table.tsx
git commit -m "feat(tables): add clickable rows to cash registers and users tables"
```

---

## Task 7: Final verification

**Step 1: Full type check**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 2: Lint**

Run: `pnpm lint`
Expected: 0 new errors

**Step 3: Manual test checklist**

- [ ] Transactions table: column toggle dropdown visible, can hide/show columns, preferences survive page reload
- [ ] Investments table: column toggle visible, clickable rows navigate to `/inwestycje/[id]`, Cmd+Click opens new tab
- [ ] Cash registers table: rows clickable, navigate to `/kasa/[id]`
- [ ] Users table: rows clickable, navigate to `/uzytkownicy/[id]`
- [ ] Clicking a link inside a row (e.g. existing name link) doesn't double-navigate
- [ ] Hidden column state persists in localStorage after browser restart
