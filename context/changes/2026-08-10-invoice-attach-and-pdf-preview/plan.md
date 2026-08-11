# Attach invoice pages straight from the picker in the transfers table (EX-662)

## Overview

The transfers table's „+" opens `InvoiceUploadDialog` — a modal whose whole content is one file
input and a „Zapisz" button. It adds a step without adding information: after picking a file the
modal shows only a filename, no preview, and the user still has to press „Zapisz". Drop it. The
click opens the OS picker directly, the picked pages ingest and upload on change, and the cell shows
progress while they do — the way the expense form already works.

Two defects ride along with the modal and are fixed here:

1. **Single file only.** The table can attach one page at a time, while the invoice field is
   `hasMany` since EX-659.
2. **No ingest.** The table uploads the raw `File` (`uploadFileClient` straight from the dialog),
   skipping `processUploadFile` — so an iPhone HEIC or a 6 MB photo fails from the table while the
   same photo works from the expense form.

**Out of scope (dropped by the owner, 2026-08-11):** rendering PDFs the same way as photos in the
preview modal. It needs `pdfjs-dist` plus a pager remodelled from files to (file, page) pairs, and
touches print + download — disproportionate to the payoff.

## Current State

- `src/components/transfers/invoice-cell.tsx` — ghost `Plus` (or the preview's „Dodaj stronę" via
  `onAdd`) sets `uploadOpen`, which dynamic-imports the dialog.
- `src/components/dialogs/invoice-upload-dialog.tsx` — `fileRef.current?.files?.[0]` →
  `uploadFileClient(file)` → `updateTransferInvoiceAction(transactionId, mediaId)`. Its only caller
  is `invoice-cell.tsx`.
- `src/lib/actions/transfers.ts:329` — `updateTransferInvoiceAction(transferId, invoiceMediaId)`
  appends one id via `setTransferInvoices`, which is a **read-modify-write** (`findByID` → compute →
  `update`). N concurrent single-id appends would lose pages; a multi-file path must batch.
- `src/components/forms/expense-form/use-invoice-ingest.tsx` — the pipeline the table lacks:
  `processUploadFile` per file, `BlockedFileError` collected and reported as one Polish toast,
  busy ids while conversion runs. Its `blockedFilesMessage` renderer is form-local today.

## Desired End State

Clicking „+" (or „Dodaj stronę") opens the OS picker with `multiple`. On change every picked file
runs through `processUploadFile`, blocked files are reported in one toast, the survivors upload
concurrently, and **one** action call attaches all of them. The cell shows a spinner instead of its
icon while that runs. `invoice-upload-dialog.tsx` is deleted.

## What we are NOT doing

- Not touching `invoice-preview-dialog.tsx` (PDF rendering, pager, print) — see the dropped scope.
- Not adding drag-and-drop to the table cell.
- Not putting the invoice actions behind `fetchAndAuthorize` — the owner ruled on that in EX-659.

---

## Phase 1: Batch append action

### Changes Required

- `src/lib/actions/transfers.ts` — replace `updateTransferInvoiceAction(transferId, mediaId)` with
  `addTransferInvoicesAction(transferId, mediaIds: number[])`: one `setTransferInvoices` call
  appending every id not already attached, preserving pick order. Empty array → no-op success (no
  `findByID`/`update` round trip). Keep the existing dedupe semantics for a re-added id.
- `src/__tests__/transfer-actions.test.ts` — rewrite the `updateTransferInvoiceAction` describe
  block for the new signature and add the cases the batch introduces: several ids in one call land
  in pick order in a **single** `payload.update`; a mix of new and already-attached ids appends only
  the new ones; an empty list touches nothing.

### Success Criteria

#### Automated Verification:

- [ ] `pnpm exec vitest run src/__tests__/transfer-actions.test.ts` passes

---

## Phase 2: Share the ingest pipeline

`processUploadFile` + blocked-file reporting currently lives inside the expense form. The table
needs the same behaviour, so it moves to a shared home rather than being written twice.

### Changes Required

- `src/lib/invoices/blocked-files-message.tsx` (new) — move `blockedFilesMessage` and
  `MAX_UPLOAD_MB` out of `use-invoice-ingest.tsx` verbatim; both consumers import it. (Shipped under
  `lib/invoices/`, not the `components/invoices/` this plan first named: it renders no mounted
  component, only a `ReactNode` for `toastMessage` — same shape as `lib/export/print.tsx`.)
- `src/lib/invoices/ingest-files.ts` (new) — the ingest loop (`processUploadFile` +
  `INGEST_CONCURRENCY` + blocked-collection) was duplicated by the table side too, so it moves out
  of `use-invoice-files.ts` alongside the message renderer.
- `src/components/forms/expense-form/use-invoice-files.ts` — call `ingestFiles`; delete the local
  loop. Public contract unchanged.
- `src/components/forms/expense-form/use-invoice-ingest.tsx` — import the moved renderer, delete the
  local copy. No behaviour change.
- `src/hooks/use-invoice-upload.ts` (new) — the table-side pipeline, returning
  `{ isUploading, uploadFiles }`. `uploadFiles(fileList)`: `processUploadFile` each file collecting
  `BlockedFileError`s, report them in one toast, upload the survivors via `uploadFileClient`
  (reuse the `UPLOAD_CONCURRENCY` runner in `src/lib/utils/upload-file-client.ts`), then a single
  `addTransferInvoicesAction`. On action failure, delete the just-uploaded media the same way the
  form's orphan cleanup does; on success `router.refresh()` so the row shows its new pages.

### Success Criteria

#### Automated Verification:

- [ ] `pnpm exec vitest run src/__tests__/lib/invoices/ingest-files.test.ts` passes — pins the
      positional contract (a blocked file leaves a hole at its own index) the form's row pairing
      rides on. Added at the review gate: the phase's original criterion
      (`src/__tests__/components/forms/expense-form`) exercised none of the moved code.

---

## Phase 3: Picker in the cell, dialog deleted

### Changes Required

- `src/components/transfers/invoice-cell.tsx` — hidden
  `<input type="file" accept="image/*,application/pdf" multiple className="sr-only">` + a ref; „+"
  and the preview's `onAdd` both `click()` it (the `onAdd` path closes the preview first, as today).
  `onChange` → `uploadFiles(e.target.files)` and then clear `e.target.value` so re-picking the same
  file fires again. While `isUploading`, the trigger is disabled and renders a spinner in place of
  its icon. Drop the `uploadOpen` state and the dynamic import.
- `src/components/dialogs/invoice-upload-dialog.tsx` — deleted.

### Success Criteria

#### Automated Verification:

- [ ] `pnpm typecheck` reports no reference to the deleted dialog or the old action

#### Manual Verification (deferred to the end-of-change checklist):

- picking two photos on one „+" attaches both pages to that transfer
- a HEIC from an iPhone attaches from the table (it fails today)
- an oversize photo reports the same Polish toast the expense form gives

---

## Whole-tree Gate

- [x] `pnpm typecheck`
- [x] `pnpm lint` (0 errors; the 81 warnings are pre-existing migration `db` args)
- [x] `pnpm test` — 1991 passed
- [x] `pnpm build`

---

## Progress

### Phase 1: Batch append action

- [x] 1.1 `addTransferInvoicesAction` replaces `updateTransferInvoiceAction`
- [x] 1.2 Batch-append specs in `transfer-actions.test.ts`

### Phase 2: Share the ingest pipeline

- [x] 2.1 Extract `blocked-files-message.tsx`
- [x] 2.2 `use-invoice-upload.ts` (plus `ingest-files.ts` — the ingest loop was duplicated too)

### Phase 3: Picker in the cell, dialog deleted

- [x] 3.1 Hidden picker + spinner in `invoice-cell.tsx`
- [x] 3.2 Delete `invoice-upload-dialog.tsx`
- [x] 3.3 Whole-tree gate (typecheck / lint / test / build — all green)
