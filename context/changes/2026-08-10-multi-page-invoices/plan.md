# Multi-page invoices (EX-659) Implementation Plan

## Overview

An expense carries a **list** of invoice files instead of exactly one, so a long invoice that spans
2–3 photographed pages lands on a single expense. `transactions.invoice` becomes `hasMany`, the AI
scan reads all pages in one model call, and every surface that renders, exports or edits an invoice
learns to handle N files.

## Current State Analysis

`transactions.invoice` is a scalar Payload `upload` (`src/collections/transfers.ts:222-227`) stored as
`transactions.invoice_id` (`src/migrations/20260211_213603.ts:19,31,37`). The full map is in
`research.md`; the four facts that shape this plan:

1. **Three read guards fail silently.** `typeof doc.invoice === 'number'`
   (`src/lib/queries/transfer-mapping.ts:69,113`, `src/lib/queries/investment-transactions.ts:111`)
   evaluates `false` on an array — no type error, no runtime error, invoices simply vanish from every
   surface. One of them feeds the unauthenticated client-share page. This is the single largest risk
   in the change and the reason Phase 1 is test-first.
2. **No `hasMany` precedent exists.** `grep hasMany src/collections/*.ts` returns one hit, and it is
   `hasMany: false`. There is no `transactions_rels` table; only Payload's own
   `payload_locked_documents_rels` (`dumps/dump-latest.sql:1177`) shows the shape the adapter expects.
3. **This is real data, even though it never reaches production.** The change ships to preview only,
   but the preview and local DBs are restored from prod dumps — ~940 media rows carry live
   `invoice_id` values — so the migration still owes backfill-then-drop.
4. **`src/lib/db/**`never touches`invoice_id`.** The media join is done in TypeScript
(`src/lib/queries/media.ts:31-58`caches the whole table, filters by id in JS), so no raw SQL breaks
and`depth: 0` can stay everywhere.

On the write side the file never enters a zod schema — it rides a separate positional action parameter
keyed to the row's stable client id, with the contract documented only in a comment
(`src/lib/utils/upload-file-client.ts:28-31`). That keeps schema work at zero and concentrates the
change in the out-of-form `Map` and the wire contract.

## Desired End State

- One expense can hold any number of invoice files, ordered as pages.
- The expense dialog has **two** scan entry points: the existing one (N photos = N expenses) and a new
  one (N photos = **one** expense, one model call over all pages). Drag & drop offers the same two
  choices as two drop zones.
- Manual attachment on a row accepts multiple files.
- A saved expense can gain a page, lose a single page, or lose all pages — from both the transfers
  table and the edit form.
- Preview opens one dialog paging through the document; print and download cover the whole set.
- The ZIP export archives every page; CSV/print carry every link.
- Replacing or deleting an invoice no longer leaks files in Vercel Blob.

Verify by: creating a 3-page expense through the new button, confirming the amount is extracted from
whichever page carries the total, then downloading the ZIP and receiving three files under one expense.

### Key Discoveries

- Payload's expected join-table shape, from the only in-repo example (`dumps/dump-latest.sql:1177`):
  `id serial PK`, `order integer`, `parent_id NOT NULL`, `path varchar NOT NULL`, `<collection>_id`,
  plus `_order_idx` / `_parent_idx` / `_path_idx` / `_media_id_idx`. `order` gives page sequence for free.
- Migration templates: `src/migrations/20260720_0_add_kosztorys_shares.ts` (CREATE TABLE) and
  `src/migrations/20260728_1_add_worker_to_kosztorys_stages.ts` (ALTER). Filenames sort lexically and
  that sort **is** the run order; `src/migrations/index.ts` needs two hand edits per migration.
- The model call is already a multi-part content array (`src/lib/ai/openrouter.ts:102-113`) — adding
  file parts is a loop, not a rewrite, and the extraction schema stays flat.
- `next.config.ts:15` caps server-action bodies at 4.5MB. `/api/upload-file`
  (`src/app/(frontend)/api/upload-file/route.ts:14-16`) exists precisely to escape that cap and is the
  pattern the scan must copy.
- `buildUniqueFilename` (`src/lib/export/invoice-zip.ts:3-23`) already dedupes with a `_1`/`_2` counter,
  so multi-page ZIP naming falls out for free — but the **tallies** at `:39-69` mix row counts with
  file counts and would print „Pobrano 9 z 5".
- `src/components/kosztorys/summary/tables/materials-transactions-table.tsx:104-107` — the virtualizer
  never measures rows, so any new control must keep the exact 28px box height or spacers drift.

## What We're NOT Doing

- **No page limit.** Owner's decision: the invoice format is the vendor's, not ours. The timeout is
  scaled per page instead (see Critical Implementation Details).
- **No change to the existing scan flow.** One photo = one expense stays exactly as it is; multi-page
  is a second, explicitly chosen entry point.
- **No `invoiceNote` change.** Two or three pages of _one_ invoice still carry one note; the Sheets
  sync reads only `invoiceNote` and is untouched by this change.
- **No depth bump.** Reads stay at `depth: 0` and hydrate media manually.
- **No E2E in this change** — filed to the `e2e-backlog` instead (see Phase 6).
- **No backfill of pre-existing orphaned Blob files.** Phase 6 stops new leaks; sweeping historical
  orphans is separate work.
- **No HEIC backfill of the 17 legacy media records** (EX-457's deferred item) — unrelated, merely
  unblocked.

## Implementation Approach

Six phases, ordered so the app is never broken between them:

1. **Model and read first.** The schema, the migration and the three silent guards land together —
   widening the guards without the schema is a no-op, and the schema without the guards makes every
   invoice disappear. Test-first, proven red against the array shape.
2. **Then rendering and export**, which only consume the widened row shape.
3. **Then editing a saved invoice**, which needs the read surfaces to already show N pages.
4. **Then the add form's file custody**, the largest UI change.
5. **Then the AI scan**, which depends on custody handing it a file list.
6. **Then cleanup and docs.**

The row DTO becomes a real array (`invoices: {url, filename, mimeType}[]`) rather than a
"first page + count" shim: the ZIP export, the CSV cell and the preview pager all need every URL, so a
shim would be replaced in the same change it was introduced.

## Critical Implementation Details

**Timing & lifecycle.** With no page cap, the fixed 30s `RECEIPT_TIMEOUT_MS`
(`src/lib/ai/openrouter.ts:31`) is wrong — it was sized for a single page, and an abort fails **all**
pages together (`use-receipt-generation.ts:93`), not one. Scale it: a base budget plus a per-page
increment, computed from the number of parts in the request. Keep the fallback model retry, but note it
re-sends every page, so a primary outage doubles the token bill on a multi-page scan.

**State sequencing (migration).** The `up` must create `transactions_rels`, backfill from
`transactions.invoice_id`, verify the copied row count matches the source count, and **only then** drop
the column, its FK and its index. Dropping first loses real invoice pointers restored from the prod
dump, with no path back short of re-importing the dump. The
migration filename is `20260810_0_*` and must be registered in `src/migrations/index.ts` by hand. The
target environments are local and **preview** — production is not migrated in this change.

**Debug & observability.** There is no in-repo precedent for a hasMany rels table, so the adapter's
expected identifiers are inferred, not verified. Before building anything on top of Phase 1, run the
app against the migrated local DB and load a transfers page — per `lessons.md`, `payload migrate`
printing `Done.` proves only that the DDL ran, and a dev server booted before the migration keeps
serving stale `column does not exist` errors until restarted.

---

## Phase 1: Data model and read path

### Overview

Move `invoice` to `hasMany`, create and backfill the join table, and widen the three read guards —
with the regression tests written first and proven red.

### Changes Required:

#### 1. Failing tests for the read path

**File**: `src/__tests__/lib/queries/transfer-mapping.test.ts` (new)

**Intent**: Pin the behaviour that will otherwise fail silently — an array-valued `invoice` must
produce a populated invoice list on the mapped row. Write and run these before touching the mapper so
they are observed red; a green-only test here proves nothing, per the parity-test lesson.

**Contract**: Covers `extractInvoiceIds` (array input yields every id, mixed populated/id members
handled) and `mapTransferRow` (N ids yield N entries in document order). Same coverage for
`src/lib/queries/investment-transactions.ts`, which carries a duplicated copy of the guard.

#### 2. Collection field

**File**: `src/collections/transfers.ts`

**Intent**: The `invoice` upload field accepts a list of media documents.

**Contract**: `hasMany: true` on the field at `:222-227`. `invoiceNote` is untouched.

#### 3. Migration

**File**: `src/migrations/20260810_0_invoice_has_many.ts` (new) + `src/migrations/index.ts`

**Intent**: Create the join table, move existing invoice pointers into it, then retire the column.

**Contract**: `up` creates `transactions_rels` (`id serial PK`, `order integer`,
`parent_id integer NOT NULL` → `transactions(id) ON DELETE CASCADE`, `path varchar NOT NULL`,
`media_id integer` → `media(id) ON DELETE CASCADE`) plus the four indexes; backfills
`path = 'invoice'`, `order = 0` from every non-null `transactions.invoice_id`; verifies the count; then
drops `transactions_invoice_idx`, `transactions_invoice_id_media_id_fk` and the `invoice_id` column.
`down` reverses in exact inverse order, restoring `invoice_id` from `order = 0` rows. Follow the house
conventions in `20260720_0_add_kosztorys_shares.ts`: `IF NOT EXISTS` / `IF EXISTS`, one multi-statement
`sql` template per function, a header comment naming EX-659. A join table is not a collection, so it
needs **no** `payload_locked_documents_rels` column.

#### 4. Read mappers

**File**: `src/lib/queries/transfer-mapping.ts`, `src/lib/queries/investment-transactions.ts`

**Intent**: Collect every media id from an array-valued `invoice` and emit an ordered list of resolved
files on the row.

**Contract**: `extractInvoiceIds` flattens `number | number[] | Media | Media[]`. `TransferRowT`
(`src/types/transfers.ts:34-37`) and `MaterialTransactionRowT` (`:102-105`) replace the
`invoiceUrl` / `invoiceFilename` / `invoiceMimeType` triple with
`invoices: { url: string; filename: string; mimeType: string }[]`. Reads stay at `depth: 0`.

### Success Criteria:

#### Automated Verification:

- New mapper specs pass: `pnpm exec vitest run src/__tests__/lib/queries/transfer-mapping.test.ts`
- Migration applies against the local DB: `pnpm payload migrate`
- Backfilled row count equals the source count (assert inside the migration, and confirm via `psql`
  against the docker DB on 5433)

#### Manual Verification:

- After restarting the dev server, a transfers page loads and shows the invoice icon on expenses that
  had one before the migration
- The kosztorys Podsumowanie „Wydatki" tab still shows invoices
- The client-share page (`/k/[token]`) still shows invoices

---

## Phase 2: Rendering and export

### Overview

Every surface that displays or exports an invoice handles a list.

### Changes Required:

#### 1. Preview dialog — page navigation

**File**: `src/components/dialogs/invoice-preview-dialog.tsx`, `invoice-preview-button.tsx`

**Intent**: One dialog pages through the document, and both print and download cover the whole set
rather than the visible page.

**Contract**: The components take `invoices: {url, filename, mimeType}[]` instead of the scalar triple.
The dialog renders the active page with a „1/3"-style pager, keeps the existing per-mime branch per
page, appends every page to the print window's body, and routes „pobierz" through the ZIP helper when
more than one page exists. If a page strip is added, re-derive the `next/image` `sizes` prop — the
current value (`sizes="(max-width:1200px) 90vw, 1000px"`) describes a full-width single preview.

#### 2. Trigger with page count

**File**: `src/components/ui/invoice-preview-trigger.tsx`

**Intent**: One trigger shows how many pages sit behind it, since the icon alone cannot say.

**Contract**: Takes the list; renders a count badge when `length > 1`. The mime-derived icon falls back
to the document icon on a mixed set. This is the shared trigger for the transfers table, the kosztorys
wydatki list and the edit form, so the badge lands in all three at once.

#### 3. Table columns

**File**: `src/components/tables/transfers.tsx`,
`src/components/kosztorys/summary/tables/materials-transactions-table.tsx`

**Intent**: Both „Faktura" columns read the list.

**Contract**: The accessors move from `invoiceUrl` to `invoices`; the `hasInvoices` gate on the
kosztorys „Pobierz faktury" button becomes a non-empty-list check. **The rendered control must keep the
28px box height** — the virtualizer at `materials-transactions-table.tsx:104-107` never measures rows.

#### 4. ZIP export

**File**: `src/hooks/use-invoice-zip.ts`, `src/lib/export/invoice-zip.ts`

**Intent**: Archive every page, and report counts that stay truthful once one row yields three files.

**Contract**: Flatten rows to a file list **before** batching, so `BATCH_SIZE` bounds concurrent
fetches rather than rows (6 rows × 3 pages would otherwise be 18 parallel fetches). `buildUniqueFilename`
already dedupes, so pages land as `data_Opis.jpg`, `_1`, `_2`. The message builder at `:39-69` splits
its tally: rows-with-invoices stays a row count; `downloaded` compares against the **expected file
count**, not `total`.

#### 5. CSV and print column

**File**: `src/lib/export/transfer-columns.ts`, `src/lib/export/sort-rows.ts`

**Intent**: The „Faktura" cell carries every link rather than silently one of three.

**Contract**: `getValue` joins the URLs with a newline. `COLUMN_TO_ACCESSOR`'s `invoice` entry sorts on
page count (sorting on a joined URL string is meaningless); the transfers table already disables
sorting on this column, so this only affects export sorting.

### Success Criteria:

#### Automated Verification:

- ZIP tally specs pass, including a row yielding 3 files:
  `pnpm exec vitest run src/__tests__/invoice-zip.test.ts`
- Print/export specs pass: `pnpm exec vitest run src/__tests__/build-print-html.test.ts src/__tests__/transfer-table.test.ts`

#### Manual Verification:

- A 3-page expense shows a „3" badge in the transfers table
- The preview dialog pages through all three, prints all three, and „pobierz" yields a ZIP
- „Pobierz faktury" over a filtered list produces one file per page with no name collisions and a
  correct summary message
- CSV export of a filtered list carries all links in the „Faktura" cell

---

## Phase 3: Editing a saved invoice

### Overview

A saved expense can gain a page, lose one page, or lose all pages — from the transfers table and from
the edit form.

### Changes Required:

#### 1. Invoice actions

**File**: `src/lib/actions/transfers.ts`

**Intent**: Adding, removing one page and removing all become distinct operations, and the media
cleanup diffs two lists instead of reading a scalar.

**Contract**: `setTransferInvoice` takes the **next id list**, reads the current list, and deletes the
set difference (its `typeof transfer.invoice === 'number'` read at `:299` would otherwise always yield
`null`, silently ending all cleanup). `updateTransferInvoiceAction` appends a page;
`removeTransferInvoiceAction` gains a media-id parameter for a single page; a sibling action removes
all. `updateTransferAction`'s invoice branch (`:254`) takes a list and routes through the same cleanup
so the edit form stops orphaning files.

#### 2. Table cell

**File**: `src/components/transfers/invoice-cell.tsx`

**Intent**: The cell offers add-a-page, remove-one-page and remove-all instead of a single ambiguous
„usuń fakturę".

**Contract**: Per-page remove lives in the preview dialog next to each page; the cell keeps one
add action and one remove-all, moved into a menu rather than bare icons if width demands. The
`isReplace` distinction disappears — with a list, upload is always "add". The local `removed` boolean
becomes a per-id optimistic set. Confirmation copy names what is being removed (one page vs the whole
invoice).

#### 3. Edit form

**File**: `src/components/forms/edit-transfer-form/edit-transfer-form.tsx`

**Intent**: The edit form shows every page and can add or remove pages, instead of replacing an unseen
file.

**Contract**: Renders the preview trigger over the list; the file input gains `multiple` and its label
becomes „Dodaj faktury" unconditionally (`row.invoiceUrl ? 'Zamień' : 'Dodaj'` no longer describes what
happens). Newly picked files append rather than replace; removal routes through the Phase 3.1 actions.

### Success Criteria:

#### Automated Verification:

- Action specs cover append, remove-one, remove-all and the cleanup diff:
  `pnpm exec vitest run src/__tests__/transfer-actions.test.ts`

#### Manual Verification:

- Adding a page to a saved 2-page expense yields 3 pages without touching the existing two
- Removing the middle page leaves the other two intact and in order
- Remove-all clears the invoice and the expense survives
- Replacing via the edit form no longer leaves the old file reachable

---

## Phase 4: Add form — multiple files per row

### Overview

The expense dialog gets a second scan button, two drop zones, and a row file input that accepts
multiple files. The out-of-form file custody widens from one File per row to a list.

### Changes Required:

#### 1. File custody

**File**: `src/components/forms/expense-form/use-invoice-files.ts`,
`src/components/forms/expense-form/use-invoice-ingest.tsx`

**Intent**: A row holds an ordered list of files rather than one.

**Contract**: The store becomes `Map<string, File[]>`. `handleFileChange` appends every picked file
(each still passing `processUploadFile`, whose 4MB guard stays **per file**); `registerFilesAt` gains a
mode for "all these files belong to one row" alongside today's one-file-per-row mapping; `renameFile`
(used by the AI Opis-based rename) applies to the page list, keeping page order stable. A per-row
per-file removal is needed here too, since a row can now hold several files before submit.

#### 2. Second scan button and drop zones

**File**: `src/components/forms/form-fields/line-items-field.tsx`

**Intent**: The user declares intent by choosing an entry point, before any scan runs — one photo per
expense, or many photos forming one expense.

**Contract**: The existing picker keeps today's behaviour (N files mint N rows). A new picker mints
**one** row holding all picked files. Drag & drop offers the two matching zones, labelled so the choice
is readable before the drop; both zones share the ingest path with the corresponding picker. The
per-row file input gains `multiple` for manual attachment.

#### 3. Row widget

**File**: `src/components/forms/form-fields/line-item-invoice-field.tsx`

**Intent**: A row shows all its pages and can drop one before submit.

**Contract**: Takes `files: File[]`, mints one object URL per file, and renders the shared preview
trigger with the page count. Keeps a "add more pages" input and a per-page remove.

#### 4. Wire contract

**File**: `src/lib/utils/upload-file-client.ts`, `src/lib/actions/transfers.ts`,
`src/stores/optimistic-form-store.ts`, `src/components/forms/hooks/use-form-submit.ts`

**Intent**: The positional submit channel carries a list of media ids per row.

**Contract**: `resolveInvoiceMediaIds` returns `number[][]` (`mediaIds[i]` belongs to `lineItems[i]`,
`mediaIds[i][j]` is its page j) with `UPLOAD_CONCURRENCY` now bounding total files, not rows.
`positionalFiles` / `filesByRowId` carry `File[]`. `createBulkTransferAction` writes
`invoice: invoiceMediaIds?.[i]` as a list; `createTransferAction` takes a list. The optimistic-recovery
store persists `Map<number, File[]>`. Update the contract comment at `upload-file-client.ts:28-31` —
it is the only place this positional contract is written down.

### Success Criteria:

#### Automated Verification:

- Upload-resolution specs pin the nested shape and sparse positions:
  `pnpm exec vitest run src/__tests__/invoice-media-resolve.test.ts`
- Optimistic-store and bulk-create specs pass:
  `pnpm exec vitest run src/__tests__/optimistic-form-store.test.ts src/__tests__/bulk-transaction.test.ts`

#### Manual Verification:

- The existing scan button still produces one expense per photo
- The new button produces one expense holding all picked photos
- Both drop zones behave like their matching buttons and are distinguishable before dropping
- Manually attaching 3 files to a hand-entered row saves all 3
- Removing a page before submit removes only that page
- An interrupted submit recovers the full page list, not just page one

---

## Phase 5: Multi-page AI scan

### Overview

One model call reads every page of one invoice, from a route that can carry them.

### Changes Required:

#### 1. Scan moves to a route handler

**File**: `src/app/(frontend)/api/extract-receipt/route.ts` (new),
`src/lib/actions/extract-receipt.ts`, `src/components/forms/expense-form/use-receipt-generation.ts`

**Intent**: A multi-page scan exceeds the server-action body cap, which fails with an uncatchable 413.

**Contract**: A `POST` route accepting FormData with N files, gated on `MANAGEMENT_ROLES` exactly as
`api/upload-file/route.ts:21-23`. The extraction logic moves behind it unchanged in behaviour; the
client calls it instead of the server action. **The scan must still persist nothing** — that invariant
is pinned by `src/__tests__/extract-receipt-action.test.ts:68-74` and guards a known orphaned-media bug.

#### 2. Multi-image model call

**File**: `src/lib/ai/openrouter.ts`, `src/lib/ai/receipt-pdf-plugins.ts`

**Intent**: The model sees the whole document, so it finds the total wherever the vendor printed it.

**Contract**: `extractReceipt` takes an ordered list of `{ bytes, mediaType, filename }` and appends one
`{ type: 'file' }` part per page after the text part. The prompt gains one sentence stating the document
may span several pages in order and totals are reported once for the whole document — the extraction
schema stays flat and unchanged. The PDF plugin predicate becomes "any part is a PDF" (the plugin is
per-call, not per-part), so a mixed JPEG+PDF set works. The Opis-based rename derives its base name from
the first page and suffixes the rest.

#### 3. Scaled timeout

**File**: `src/lib/ai/openrouter.ts`

**Intent**: With no page cap, a fixed 30s budget fails long documents for the wrong reason.

**Contract**: The abort budget becomes a base plus a per-page increment derived from the part count.
Failure semantics are unchanged: a timeout fails the whole row, which is correct — a partial document
would yield a wrong total.

### Success Criteria:

#### Automated Verification:

- Fallback and timeout specs pass with a multi-part request:
  `pnpm exec vitest run src/__tests__/openrouter-fallback.test.ts src/__tests__/receipt-pdf-plugins.test.ts`
- The persists-nothing guard still passes:
  `pnpm exec vitest run src/__tests__/extract-receipt-action.test.ts`

#### Manual Verification:

- A real 3-page invoice with the total on the **last** page extracts the correct brutto and netto
- A real invoice with a summary **first** page extracts correctly too
- A mixed set (photo + PDF page) scans without error
- A scan failure marks the row „nie odczytano" and leaves the other rows usable
- The progress counter and pending pill behave with a multi-page row

---

## Phase 6: Blob cleanup and documentation

### Overview

Stop leaking files in Vercel Blob, and correct the docs this change falsifies.

### Changes Required:

#### 1. Orphan cleanup

**File**: `src/lib/actions/transfers.ts`, `src/collections/transfers.ts`

**Intent**: A file stops existing in Blob once nothing points at it — on replace, on expense deletion,
and after a failed submit.

**Contract**: Replace already routes through the Phase 3.1 diff. Expense deletion cleans its media (the
existing `afterDelete` hooks at `src/collections/transfers.ts:76` leave files behind); per project
convention new side effects belong in the server action rather than a new `afterChange` hook, so prefer
the action path where deletion goes through one. A failed bulk submit deletes the media it already
uploaded. Deletions stay best-effort and logged, matching today's fire-and-forget shape at `:309-312`.

#### 2. Documentation

**File**: `context/changes/blob-backup/runbook.md`, `src/collections/media.ts`

**Intent**: The disaster-recovery runbook stops naming a column that no longer exists.

**Contract**: §0, §1, §2 and §5 replace `transactions.invoice_id → media.id` with the join-table path,
and the "mapping is 1:1" claim becomes 1:N. The recovery mechanic itself (filename-keyed Blob puts) is
unchanged. The comment at `src/collections/media.ts:29-31` explains cache invalidation in terms of an
`ON DELETE SET NULL` FK that this change replaces with a cascading join row.

#### 3. E2E backlog

**Intent**: The change touches three browser surfaces including an unauthenticated client-facing one,
and no invoice E2E exists.

**Contract**: A Linear issue in project "Wykonczymy" labelled `e2e-backlog`, covering: multi-photo
scan → one expense, per-page removal, and the client-share invoice column. Record its id here.

### Success Criteria:

#### Automated Verification:

- Cleanup specs cover replace, delete and failed-submit paths:
  `pnpm exec vitest run src/__tests__/transfer-actions.test.ts`

#### Manual Verification:

- Deleting an expense with 3 pages leaves no reachable file behind
- The runbook's recovery walkthrough can be followed against the new schema

---

## Testing Strategy

### Unit Tests

- **The three read guards** — an array-valued `invoice` yields every media id, in order, through both
  `transfer-mapping.ts` and `investment-transactions.ts`. Written first, observed red. This is the
  highest-value test in the change: it is the only defence against a failure mode that produces no
  error.
- **ZIP tallies** — a dataset where one row yields three files must produce a truthful message; today's
  row-count arithmetic would print „Pobrano 9 z 5".
- **`resolveInvoiceMediaIds`** — the nested positional contract, including sparse rows (a row with no
  files) and page order within a row.
- **Media cleanup diff** — replacing page 2 deletes exactly the replaced file, not the set.

### Integration Tests

- The migration's backfill count assertion runs as part of `pnpm payload migrate` against the local DB
  and again against the 5435 test container via `pnpm db:import:test`.

### Manual Testing Steps

1. Scan a real 3-page invoice with the total on the last page through the new button — confirm the
   brutto and netto match the document.
2. Repeat with an invoice whose first page carries the summary.
3. Open the preview, page through, print, download.
4. Export the ZIP over a filtered list containing the multi-page expense.
5. Add a page to the saved expense from the transfers table; remove the middle page; remove all.
6. Repeat the add/remove from the edit form.
7. Verify the kosztorys „Wydatki" tab and the client-share page still render invoices.

## Performance Considerations

- Media rows grow 2–3× per expense. `src/lib/queries/media.ts:20-25` sizes the whole-table media cache
  at "988 rows … revisit around ~10 000" against a ~2MB Data-Cache entry ceiling — that ceiling now
  arrives 2–3× sooner. Not a blocker for this change; worth a note when it approaches.
- The ZIP export must bound concurrency by **files**, not rows, or the existing batch size triples.
- A multi-page scan costs input tokens linear in page count, and the fallback retry re-sends every page.

## Migration Notes

**This change never touches production.** It ships to the preview environment only, so the migration
targets the preview DB with `pnpm db:migrate:preview` — `db:migrate:prod` is out of scope here.
Production stays on the scalar `invoice_id` column until someone decides otherwise, which means `main`
must not receive this code before that decision.

The backfill is still mandatory. The preview and local DBs are restored from prod dumps, so they carry
the same ~940 real media rows — dropping `invoice_id` before copying it loses invoices that people will
notice on the preview environment. Order of operations: create → backfill → verify count → drop.

Sequencing per environment: apply locally (`pnpm payload migrate`) → verify → apply to preview
(`pnpm db:migrate:preview`) **before** the preview deploy builds against the new code, since the build
no longer runs migrations. After applying locally, restart every dev server that was running beforehand
— a pre-migration process serves stale `column does not exist` errors that look like a code bug.

## Whole-tree Gate

Run **once**, after the final phase:

- Type checking passes: `pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm exec vitest run`
- DB-backed specs pass: `pnpm test:integration`
- Build succeeds: `pnpm build`

## References

- Research: `context/changes/2026-08-10-multi-page-invoices/research.md`
- Migration templates: `src/migrations/20260720_0_add_kosztorys_shares.ts`,
  `src/migrations/20260728_1_add_worker_to_kosztorys_stages.ts`
- Join-table shape precedent: `dumps/dump-latest.sql:1177`
- Body-cap escape pattern: `src/app/(frontend)/api/upload-file/route.ts:14-16`
- Prior scan decisions: `context/archive/2026-07-11-receipt-scan-line-items/change.md`
- Backup runbook this change falsifies: `context/changes/blob-backup/runbook.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Data model and read path

#### Automated

- [x] 1.1 New mapper specs pass — e86859ea
- [x] 1.2 Migration applies against the local DB — e86859ea
- [x] 1.3 Backfilled row count equals the source count — e86859ea

### Phase 2: Rendering and export

#### Automated

- [x] 2.1 ZIP tally specs pass, including a row yielding 3 files — abfc6c0d
- [x] 2.2 Print/export specs pass — abfc6c0d

### Phase 3: Editing a saved invoice

#### Automated

- [x] 3.1 Action specs cover append, remove-one, remove-all and the cleanup diff

### Phase 4: Add form — multiple files per row

#### Automated

- [ ] 4.1 Upload-resolution specs pin the nested shape and sparse positions
- [ ] 4.2 Optimistic-store and bulk-create specs pass

### Phase 5: Multi-page AI scan

#### Automated

- [ ] 5.1 Fallback and PDF-plugin specs pass with a multi-part request
- [ ] 5.2 The persists-nothing guard still passes

### Phase 6: Blob cleanup and documentation

#### Automated

- [ ] 6.1 Cleanup specs cover replace, delete and failed-submit paths
