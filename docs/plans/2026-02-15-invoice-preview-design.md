# M19: Invoice Preview in Transaction Tables — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make invoice files (PDF/images) previewable and downloadable directly from the invoice column in any transaction table.

**Architecture:** Extend the transaction row type to carry invoice metadata (URL, filename, mimeType) instead of a boolean. Create an `InvoiceCell` client component that renders a clickable icon button opening an `InvoicePreviewDialog` (Radix Dialog with `<img>` for images, `<iframe>` for PDFs, download button). The DataTable's `handleRowClick` already skips `<button>` elements, so no stopPropagation needed.

**Tech Stack:** React 19, Radix Dialog (existing), Lucide icons, TanStack Table

---

### Task 1: Extend TransactionRowT and update mapper

**Files:**

- Modify: `src/lib/tables/transactions.tsx`

**Step 1: Update the row type**

Replace `hasInvoice: boolean` with three nullable fields:

```typescript
export type TransactionRowT = {
  readonly id: number
  readonly description: string
  readonly amount: number
  readonly type: TransactionTypeT
  readonly paymentMethod: PaymentMethodT
  readonly date: string
  readonly cashRegisterName: string
  readonly investmentName: string
  readonly workerName: string
  readonly otherCategoryName: string
  readonly invoiceUrl: string | null
  readonly invoiceFilename: string | null
  readonly invoiceMimeType: string | null
}
```

**Step 2: Update the mapper**

In `mapTransactionRow`, replace `hasInvoice: doc.invoice != null` with:

```typescript
invoiceUrl: getMediaField(doc.invoice, 'url'),
invoiceFilename: getMediaField(doc.invoice, 'filename'),
invoiceMimeType: getMediaField(doc.invoice, 'mimeType'),
```

Add a helper below `getRelationName`:

```typescript
function getMediaField(field: unknown, key: string): string | null {
  if (typeof field === 'object' && field !== null && key in field) {
    return (field as Record<string, unknown>)[key] as string | null
  }
  return null
}
```

**Step 3: Update the column accessor**

Change the column from `col.accessor('hasInvoice', ...)` to `col.accessor('invoiceUrl', ...)`. Update the cell to use the new `InvoiceCell` component (created in Task 3):

```typescript
col.accessor('invoiceUrl', {
  id: 'invoice',
  header: 'Faktura',
  meta: { label: 'Faktura' },
  enableSorting: false,
  cell: (info) => {
    const url = info.getValue()
    if (!url) return <span className="text-muted-foreground">—</span>
    const row = info.row.original
    return (
      <InvoiceCell
        url={url}
        filename={row.invoiceFilename}
        mimeType={row.invoiceMimeType}
      />
    )
  },
})
```

Add the import at the top: `import { InvoiceCell } from '@/components/transactions/invoice-cell'`

Remove the `FileText` import if no longer used elsewhere in this file.

**Step 4: Verify**

Run: `pnpm typecheck`
Expected: 0 errors (once Tasks 2 & 3 are complete — this task can be done together with them)

---

### Task 2: Create InvoicePreviewDialog

**Files:**

- Create: `src/components/transactions/invoice-preview-dialog.tsx`

**Step 1: Create the component**

```typescript
'use client'

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

type InvoicePreviewDialogPropsT = {
  readonly url: string
  readonly filename: string | null
  readonly mimeType: string | null
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

export function InvoicePreviewDialog({
  url,
  filename,
  mimeType,
  open,
  onOpenChange,
}: InvoicePreviewDialogPropsT) {
  const isImage = mimeType?.startsWith('image/')
  const isPdf = mimeType === 'application/pdf'
  const displayName = filename ?? 'Faktura'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{displayName}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
          {isImage && (
            <img
              src={url}
              alt={displayName}
              className="max-h-[70vh] max-w-full object-contain"
            />
          )}
          {isPdf && (
            <iframe
              src={url}
              title={displayName}
              className="h-[70vh] w-full rounded border-0"
            />
          )}
          {!isImage && !isPdf && (
            <p className="text-muted-foreground text-sm">
              Podgląd niedostępny dla tego typu pliku.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" asChild>
            <a href={url} download={filename ?? true} target="_blank" rel="noopener noreferrer">
              <Download />
              Pobierz
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Key decisions:**

- `max-h-[90vh]` on DialogContent so it doesn't overflow viewport
- `sm:max-w-4xl` for a wide preview area on desktop
- Image uses `object-contain` + `max-h-[70vh]` to fit without cropping
- PDF iframe fills 70vh height
- Download button uses `<a>` via `asChild` for native download behavior
- Polish label: "Pobierz" (Download), "Podgląd niedostępny..." (Preview unavailable)

---

### Task 3: Create InvoiceCell

**Files:**

- Create: `src/components/transactions/invoice-cell.tsx`

**Step 1: Create the component**

```typescript
'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { InvoicePreviewDialog } from './invoice-preview-dialog'

type InvoiceCellPropsT = {
  readonly url: string
  readonly filename: string | null
  readonly mimeType: string | null
}

export function InvoiceCell({ url, filename, mimeType }: InvoiceCellPropsT) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer transition-colors"
        aria-label={`Podgląd faktury: ${filename ?? 'faktura'}`}
      >
        <FileText className="size-4" />
      </button>
      <InvoicePreviewDialog
        url={url}
        filename={filename}
        mimeType={mimeType}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
```

**Key decisions:**

- Native `<button>` (not `Button` component) to keep the cell minimal — just an icon
- `aria-label` for accessibility (icon-only button per CLAUDE.md WCAG rules)
- DataTable's `handleRowClick` already has `if (target.closest('a, button')) return` — so clicking this button won't trigger row navigation. No `stopPropagation` needed.
- Dialog renders inside the cell but portals to `<body>` via Radix, so no layout issues

---

### Task 4: Verify and commit

**Step 1: Type check**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 2: Lint**

Run: `pnpm lint`
Expected: 0 new errors

**Step 3: Manual verification**

1. Start dev server: `pnpm dev`
2. Navigate to `/transakcje` — invoice column should show clickable icons for transactions with invoices
3. Click an icon — preview dialog should open with image or PDF
4. Click "Pobierz" — file should download
5. Click outside dialog or X — dialog closes
6. Click a row (not the icon) — row navigation still works
7. Check `/inwestycje/[id]` and `/kasa/[id]` — invoice column works there too

**Step 4: Update PLAN.md**

Mark M19 tasks as done and update the description to match the reduced scope.

**Step 5: Commit**

```bash
git add src/lib/tables/transactions.tsx src/components/transactions/invoice-preview-dialog.tsx src/components/transactions/invoice-cell.tsx
git commit -m "feat(M19): add invoice preview dialog to transaction tables"
```

---

## Summary

| Task | Files                                                    | Action                               |
| ---- | -------------------------------------------------------- | ------------------------------------ |
| 1    | `src/lib/tables/transactions.tsx`                        | Extend type, mapper, column cell     |
| 2    | `src/components/transactions/invoice-preview-dialog.tsx` | Create preview modal                 |
| 3    | `src/components/transactions/invoice-cell.tsx`           | Create cell renderer                 |
| 4    | —                                                        | Typecheck, lint, manual test, commit |
