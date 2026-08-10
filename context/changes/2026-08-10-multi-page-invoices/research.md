---
date: 2026-08-10T00:00:00+02:00
researcher: konradantonik
git_commit: 256bb423874b630e3a70b8a5f6e01818fb53a08d
branch: konradantonik/ex-577-ai-receipt-scan-also-extract-the-netto-amount
repository: wykonczymy
topic: 'An expense carries multiple invoice pages (EX-659) — hasMany invoice'
tags: [research, codebase, transfers, media, receipt-scan, migrations, upload]
status: complete
last_updated: 2026-08-10
last_updated_by: konradantonik
---

# Research: An expense carries multiple invoice pages (EX-659)

**Date**: 2026-08-10
**Researcher**: konradantonik
**Git Commit**: `256bb423874b630e3a70b8a5f6e01818fb53a08d`
**Branch**: `konradantonik/ex-577-ai-receipt-scan-also-extract-the-netto-amount`
**Repository**: wykonczymy

## Research Question

`transactions.invoice` is a single Payload `upload` field. EX-659 makes it `hasMany` so one
expense carries 2–3 invoice page files, for both AI-scanned and hand-entered expenses. What is
the full blast radius: data model, migration, write paths, read surfaces, the AI scan pipeline,
and the tests/docs that pin the current shape?

## Summary

Eight findings that shape the plan:

1. **The change.md's "six read surfaces" is an undercount — it is ~19 code sites.** Two of them are
   silent-data-loss guards (`typeof doc.invoice === 'number'`) that neither `tsc` nor a runtime error
   catches: they just evaluate `false` on an array and every invoice quietly disappears from the UI.
2. **This would be the repo's first `hasMany` field. There is no precedent and no `transactions_rels`
   table.** `grep hasMany src/collections/*.ts` returns one hit, and it is `hasMany: false`. The join
   table must be hand-written from scratch (migrations are hand-written here per AGENTS.md), modelled
   on Payload's own `payload_locked_documents_rels`.
3. **This touches REAL production data.** The kosztorys throwaway-data exemption in AGENTS.md is
   explicitly scoped to kosztorys; transfers and media are restored from prod dumps. ~940 media rows
   with live `invoice_id` FKs. The migration owes a backfill-then-drop, not a drop.
4. **`src/lib/db/**`never touches`invoice_id`.** The media join is done in TypeScript
(`fetchAllMedia`caches the whole table,`fetchMediaByIds` filters in JS), so no raw SQL breaks.
   Significant de-risking.
5. **The scan pipeline's core invariant is `1 image → 1 row → 1 media`, and EX-443 chose it
   deliberately** ("NOT one multi-image call", for partial-failure isolation). Multi-page is a
   reversal candidate of an archived decision, and the reversal is the design's hardest question.
6. **Nobody has decided how a user says "these 3 files are one invoice."** Picking 3 files today
   mints 3 line items. The app has no grouping signal — only file order and filename. This is the
   one genuinely unresolved requirement.
7. **The model call is already a multi-part content array — adding N file parts is trivial.** The
   blocker is the 4.5MB server-action body cap, not the model.
8. **`context/changes/blob-backup/runbook.md` goes factually stale.** It is an incident-time
   recovery doc keyed on `transactions.invoice_id` and on media↔transaction being 1:1. Both become
   false. Updating it is not docs-churn.

## Detailed Findings

### Data model + migration

- Field: `src/collections/transfers.ts:222-227` — `{ name: 'invoice', type: 'upload', relationTo: 'media' }`.
  `invoiceNote` follows at `:228-238`; its admin description "Required if no invoice file is attached"
  documents an intention that **is enforced nowhere** (see Validation below).
- Column today: `src/migrations/20260211_213603.ts:19,31,37` — `invoice_id integer`,
  FK `transactions_invoice_id_media_id_fk … ON DELETE set null`, index `transactions_invoice_idx`.
  Live in prod: `dumps/dump-latest.sql:8324,8753`.
- Type today: `src/payload-types.ts:335` — `invoice?: (number | null) | Media`. Becomes
  `(number | Media)[] | null`.
- **`transactions_rels` does not exist.** The only `_rels` tables are Payload-internal
  (`payload_locked_documents_rels` at `dumps/dump-latest.sql:1177`, `payload_preferences_rels` at `:1289`).
  The expected shape for a hasMany upload on slug `transactions`:

  ```sql
  CREATE TABLE "transactions_rels" (
    "id"        serial PRIMARY KEY,
    "order"     integer,
    "parent_id" integer NOT NULL REFERENCES "transactions"("id") ON DELETE CASCADE,
    "path"      varchar NOT NULL,           -- literal 'invoice'
    "media_id"  integer REFERENCES "media"("id") ON DELETE CASCADE
  );
  -- + _order_idx, _parent_idx, _path_idx, _media_id_idx
  ```

  `order` gives page 1/2/3 sequence for free. A join table is **not** a collection, so it needs no
  `payload_locked_documents_rels` column (contrast `src/migrations/20260720_0_add_kosztorys_shares.ts`).
  Because there is no in-repo precedent, verify the adapter's expected identifiers before shipping —
  a name mismatch surfaces as a runtime query error, not a migration error.

- Migration templates to copy: `src/migrations/20260728_1_add_worker_to_kosztorys_stages.ts` (ALTER shape)
  and `src/migrations/20260720_0_add_kosztorys_shares.ts` (CREATE TABLE shape). Conventions: hand-written
  header comment naming the Linear issue, `IF NOT EXISTS`/`IF EXISTS` everywhere, one multi-statement
  `sql` template per function, `down` reverses in exact inverse order, plus **two** hand edits to
  `src/migrations/index.ts` (import + `{up,down,name}` entry, `name` === filename).
  Next filename: `20260810_0_<...>.ts`. Newest existing: `20260728_1_add_worker_to_kosztorys_stages.ts`.
- **Backfill is mandatory** (real prod data): create the table →
  `INSERT INTO transactions_rels ("order", parent_id, path, media_id) SELECT 0, id, 'invoice', invoice_id FROM transactions WHERE invoice_id IS NOT NULL`
  → verify count → only then drop `invoice_id`, its FK, and its index.
- **FK semantics flip**: `ON DELETE SET NULL` on a scalar column becomes `ON DELETE CASCADE` on a join
  row. The comment at `src/collections/media.ts:28-30` (and the rationale quoted in
  `context/archive/2026-07-27-decouple-panel-write-refresh/change.md:280`) goes stale. The
  cache-invalidation reason for bumping `transfers` in media's `afterDelete` still holds.

### Read surfaces — the silent-failure ones first

| #   | Site                                                              | Assumption                             | Failure mode                                                                     |
| --- | ----------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | `src/lib/queries/transfer-mapping.ts:110-116` `extractInvoiceIds` | `typeof doc.invoice === 'number'`      | returns `[]` → empty media map → **every** `invoiceUrl` null, no error           |
| 2   | `src/lib/queries/transfer-mapping.ts:69-70` `mapTransferRow`      | same guard                             | media undefined, no error                                                        |
| 3   | `src/lib/queries/investment-transactions.ts:111`                  | **duplicated** copy of the same guard  | same, on the kosztorys Podsumowanie + **unauthenticated client-share** path      |
| 4   | `src/lib/actions/transfers.ts:299` `setTransferInvoice`           | `typeof transfer.invoice === 'number'` | `oldMediaId` always null → replaced blobs **never deleted**, orphan accumulation |

Sites 1–3 are the reason this change is dangerous: they are typed loosely enough (`RelationIdT`) that
TypeScript stays green. Site 3 feeds `src/app/(share)/k/[token]/page.tsx` and
`src/app/(share)/podglad-klienta/[id]/page.tsx` — a regression is client-visible.

Structural DTOs that carry the shape:

- `src/types/transfers.ts:34-37` (`TransferRowT`) and `:102-105` (`MaterialTransactionRowT`) — the flat
  triple `invoiceUrl` / `invoiceFilename` / `invoiceMimeType`, all `string | null`. Widest blast radius;
  ~15 consumers read it by name. Two options: keep the triple as "page 1" + add `invoiceCount` (cheap,
  shim-shaped), or make it an array (honest, touches every consumer). The ZIP export forces the array
  anyway (below), so the shim buys little.

Rendering:

- `src/components/tables/transfers.tsx:119-135` — the „Faktura" column, `col.accessor('invoiceUrl')`.
  One icon wide; a list does not fit → **badge count on the trigger**.
- `src/components/transfers/invoice-cell.tsx:17-77` — the only widget that owns upload+replace+remove.
  `:28` `hasInvoice = !!url && !removed`; `:31` `confirm('Czy na pewno chcesz usunąć fakturę?')`;
  `:32` `removeTransferInvoiceAction(transactionId)` takes no media id; `:38` a single `removed`
  boolean; `:72` `isReplace={hasInvoice}`. Under hasMany, **upload is always "add"** and the
  replace/remove verbs become per-file — this is exactly the two-verb collision the change.md's
  design decision was made to avoid.
- `src/components/ui/invoice-preview-trigger.tsx:15-40` — the shared trigger for the transfers table,
  the kosztorys wydatki list and the edit form. Icon is picked from `mimeType` (ambiguous when pages
  mix JPEG+PDF) and the label is the filename. **This is where the count badge belongs.**
- `src/components/dialogs/invoice-preview-button.tsx:10-58` / `invoice-preview-dialog.tsx:22-147` —
  single-document viewer end to end: one mime branch `:32-34`, `handlePrint` builds one `<img>`/`<iframe>`
  `:37-72`, one `next/image` `:87-97` (`sizes="(max-width:1200px) 90vw, 1000px"` — if a page-strip is
  added, re-derive `sizes` per the next/image rule), one PDF iframe `:101-106`, one `<a download>` `:137`.
  Plausible target: page pager (1/3), print-all, download-all via `useInvoiceZip`.
- `src/components/kosztorys/summary/tables/materials-transactions-table.tsx:98-119,165,178-181` —
  the client-facing „Faktura" column and the `hasInvoices` gate on „Pobierz faktury".
  **Constraint at `:104-107`: the virtualizer never measures rows**, so any multi-file control must keep
  the exact same 28px box height or the spacers drift.
- `src/components/forms/edit-transfer-form/edit-transfer-form.tsx:175-186` — `row.invoiceUrl` truthiness
  and the label `row.invoiceUrl ? 'Zamień fakturę' : 'Dodaj fakturę'`, which hasMany makes wrong.

Export:

- `src/hooks/use-invoice-zip.ts:14-19,46,70-98` — one URL per row, `BATCH_SIZE = 6` batches **rows**.
  With N files/row that becomes up to 18 concurrent fetches → **flatten to a file list before batching**.
  `buildUniqueFilename` (`src/lib/export/invoice-zip.ts:3-23`) already dedupes with `_1`/`_2`, so
  `20260810_Opis.jpg` / `_1.jpg` / `_2.jpg` falls out for free.
- `src/lib/export/invoice-zip.ts:39-69` — **the tally semantics break**: `total` = rows,
  `withInvoice` = rows with a URL, `downloaded` = files archived. Once one row yields 3 files,
  `:60 if (downloaded === total)` and `:63-66 missing/failed` mix row counts with file counts →
  wrong Polish message („Pobrano 9 z 5"). Row-tally and file-tally must split. Pinned by
  `src/__tests__/invoice-zip.test.ts:187,205`.
- `src/lib/export/transfer-columns.ts:41` — CSV/print „Faktura" cell = `r.invoiceUrl ?? ''`.
  Pinned by `src/__tests__/build-print-html.test.ts:29-32`.
- `src/lib/export/sort-rows.ts:15` — `invoice: 'invoiceUrl'`; sorting an array stringifies to
  `"a,b,c"`. Non-crashing, low severity (the table sets `enableSorting: false`), still real.

**Not affected**: the Google Sheets sync. `src/lib/google/tab-rows.ts:30-42,70,109` carries
`invoiceNote` only — no sheet cell reads the file. `invoiceNote` stays a single string, which is
correct: 2–3 pages of _one_ invoice still have one note.

**Depth stays 0.** All three transfer reads run `depth: 0`
(`src/lib/queries/transfers.ts:40,110`, `src/lib/queries/export-transfers.ts:18`,
`src/lib/actions/transfers.ts:294-298`) and hydrate media manually. Bumping depth would re-introduce
the ~375ms ORM hydration the comment at `src/lib/queries/media.ts:26-30` exists to avoid. Widen the
extractor, not the depth.

**Cache capacity note**: `src/lib/queries/media.ts:20-25` sizes the whole-table media cache at
"988 rows … revisit around ~10 000" against a ~2MB Data-Cache entry ceiling. Multi-page multiplies
media rows 2–3× per expense, so that ceiling arrives 2–3× sooner. Worth a line in the plan, not a blocker.

### Write paths

Every media doc is created through one boundary: `src/lib/utils/upload-file.ts:20-42` →
`POST /api/upload-file` (`src/app/(frontend)/api/upload-file/route.ts`, an API route specifically to
dodge the server-action body cap) → `uploadFileClient` (`src/lib/utils/upload-file-client.ts:10-26`),
returning a bare `number`. **One file per POST**, `UPLOAD_CONCURRENCY = 4`.

Four sites set `invoice`:

- `src/lib/actions/transfers.ts:30,52` `createTransferAction(data, invoiceMediaId?)`.
- `src/lib/actions/transfers.ts:64-67,111` `createBulkTransferAction(data, invoiceMediaIds?)` —
  the wire contract is **positional**: `mediaIds[i]` ↔ `lineItems[i]`. Becomes `mediaIds[i][j]`, which
  is a contract re-decision, not just a re-type.
- `src/lib/actions/transfers.ts:220-281,254` `updateTransferAction` — spread-conditional replace;
  **remove is impossible** through it and the old media **orphans** (no delete).
- `src/lib/actions/transfers.ts:283-332` `setTransferInvoice` + `updateTransferInvoiceAction` /
  `removeTransferInvoiceAction` — the only place that deletes replaced media (`:309-312`,
  fire-and-forget, unawaited). Both actions need a media-id parameter under hasMany.

Client-side file custody (nothing is uploaded until submit):

- `src/components/forms/expense-form/use-invoice-files.ts:23` — `Map<string /*row id*/, File>`, with
  `handleFileChange` reading `e.target.files?.[0]` (`:53`) and `registerFilesAt` mapping `ids[i] ← picked[i]`
  (`:74-86`). **→ `Map<string, File[]>`.**
- `src/lib/utils/upload-file-client.ts:34-44,50-60,66-80` — `positionalFiles` / `filesByRowId` /
  `resolveInvoiceMediaIds`, the id-space↔position-space bridge. `(number|undefined)[]` → `number[][]`.
- `src/stores/optimistic-form-store.ts:9,30,59-63` + `src/components/forms/hooks/use-form-submit.ts:24` —
  `invoiceFiles: Map<number, File>` persisted for optimistic-submit recovery. → `Map<number, File[]>`.
- `src/components/forms/form-fields/line-item-invoice-field.tsx:27-74` — one `file?: File`, one blob URL
  via `useObjectUrl`, one `FileInput` (no `multiple`), a hidden replace input `:66-72`.
  **Replace yes, remove no** (only by deleting the whole row).
- `src/components/forms/expense-form/bulk-expense-form.ts:14-23` — the form schema carries **no** invoice
  field at all (only `invoiceNote`); the File lives out-of-form keyed by the row's stable client id
  (EX-448). **So no zod/form-schema change is needed** — the change is the out-of-form Map plus the
  positional wire contract.

**Validation**: there is no "invoice OR invoiceNote" rule anywhere.
`src/hooks/transfers/validate.ts` never mentions `invoice`; `invoice` appears in no zod schema
(`src/lib/schemas/transfer.ts:28,53`, `src/components/forms/expense-form/expense-schema.ts:48,70,152`
cover `invoiceNote` only). The admin description at `src/collections/transfers.ts:234` is unenforced
documentation. hasMany changes nothing here.

**Pre-existing orphan leaks that all get worse ×N**: `updateTransferAction` replace (`:254`), transfer
deletion (`src/collections/transfers.ts:76` `afterDelete` leaves media behind), and a failed submit
after `resolveInvoiceMediaIds` already uploaded.

### AI receipt-scan pipeline

- Model input is **already a multi-part content array** — `src/lib/ai/openrouter.ts:102-113` sends
  `[{type:'text'}, {type:'file'}]`. Appending N file parts is mechanically trivial. Signature
  (`:58-63`) and `ExtractReceiptInputT` (`src/lib/actions/extract-receipt.ts:9-12`) are scalar and
  would widen.
- **The real blocker is the request body**: `next.config.ts:15` `bodySizeLimit: '4.5mb'` for server
  actions. Today one scan = one file ≤ 4MB (`src/lib/utils/process-upload-file.ts:8` `MAX_UPLOAD_BYTES`),
  so per-file ≈ per-request. A 3-page scan in one action body is up to 12MB → 413
  `FUNCTION_PAYLOAD_TOO_LARGE`, **uncatchable in-function**. The size guard is strictly per-file
  (`:89-94`, called at `:100,:110,:113`); **there is no aggregate check anywhere**. The escape hatch
  already exists as a pattern: move the scan onto an API route, exactly as
  `src/app/(frontend)/api/upload-file/route.ts:14-16` did.
- `src/lib/ai/receipt-pdf-plugins.ts:11` is single-mediaType; a mixed page set (JPEG + PDF) needs the
  predicate to become "some part is application/pdf" — the plugin is per-call, not per-part.
- `RECEIPT_TIMEOUT_MS = 30_000` per attempt (`openrouter.ts:31`) is sized for one page. N pages raise
  latency, and an abort fails **all N pages together** (`use-receipt-generation.ts:93`). Fallback
  (`:120-128`, primary → `FALLBACK_MODEL`) re-sends every page, doubling the token bill on a primary outage.
- **The scan persists nothing** — `src/lib/actions/extract-receipt.ts:19-21`, pinned by
  `src/__tests__/extract-receipt-action.test.ts:68-74` (guards the orphaned-media bug). Upload happens
  only at submit.
- **One call with N images needs no schema change.** `src/lib/ai/receipt-extraction-schema.ts:11-17` is
  flat, and the prompt (`openrouter.ts:66-92`) already asks for document-level totals, which on a
  multi-page invoice appear once, on the last page. The delta is one prompt sentence.
- **N calls merged is where the cost lands**, and it is a correctness hazard, not a nicety: a per-page
  _subtotal_ is indistinguishable from the grand total under "last non-null wins"; `invoiceNote` is the
  one field that must **concatenate** while every other field takes first/last-wins; and
  `UNREADABLE_RECEIPT` (`openrouter.ts:134`, tallied at `use-receipt-generation.ts:120-131`) becomes
  per-page with no rule for "2 of 3 pages readable".
- Progress/abort UI: `SCAN_PENDING_KEY` pill (`use-receipt-generation.ts:53,114`), „Odczytano n/N"
  (`line-items-field.tsx:372-376`), per-row spinner (`:280-292`), „nie odczytano" marker (`:266-275`).
  **No user-facing cancel** — only the per-attempt timeout `AbortController`.

### The combinatorial seam (multi-page × multi-row)

Today: `src/components/forms/form-fields/line-items-field.tsx:166-183` — **N picked files mint N rows**,
then `onRegisterFiles(ids, picked)` with `ids[i]` holding `picked[i]`. Eligible rows are scanned one
call each at `GENERATION_CONCURRENCY = 4` (`use-receipt-generation.ts:41-48,77-80`).

That rule is precisely what multi-page must break, and **the app has no grouping signal** — only file
order and filename. Every hop downstream is "one" (`Map<string, File>` → `Map<number, File>` →
`(number|undefined)[]` → `invoice: id`), so the plumbing is a `File → File[]` widening at four points;
the _requirement_ is the open question.

Also note two guards that stay valid under the widening: submit blocked while `isIngesting`
(`expense-form.tsx:135-138`), and row-delete disabled during generation
(`line-items-field.tsx:276-279` — removing a row mid-generation shifts the array under an in-flight
task's captured `index`).

### Tests that pin the current shape

| file:line                                                                     | pins                                                                           | breaks                                        |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------- |
| `src/__tests__/invoice-media-resolve.test.ts:11-41`                           | `resolveInvoiceMediaIds` → `(number\|undefined)[]`, sparse positions preserved | directly — return type becomes `number[][]`   |
| `src/__tests__/invoice-zip.test.ts:187,205`                                   | ZIP shortfall wording off the row-count tally                                  | once row-tally ≠ file-tally                   |
| `src/__tests__/build-print-html.test.ts:29-32`                                | print fixture carries the flat triple                                          | compile break on the DTO change               |
| `src/__tests__/transfer-table.test.ts:5,60-61`                                | mocks `InvoiceCell`; fixture `invoice: null`                                   | fixture shape; the mock hides the cell change |
| `src/__tests__/extract-receipt-action.test.ts:68-74`                          | the scan persists nothing                                                      | must survive a multi-file scan                |
| `src/__tests__/lib/google/tab-rows.test.ts`, `lib/utils/invoice-note.test.ts` | `invoiceNote` only                                                             | unaffected                                    |

**No E2E coverage exists** — `grep -rn -i invoice e2e/` returns nothing. A slice touching the transfers
table, the kosztorys wydatki list and the client share page owes an E2E or an `e2e-backlog` Linear issue
(per AGENTS.md / `slice-review-gate` Step 3).

## Code References

- `src/collections/transfers.ts:222-227` — the `invoice` upload field
- `src/collections/media.ts:29-31,35-46,48-53` — `ON DELETE SET NULL` rationale, upload config, public `read`
- `src/migrations/20260211_213603.ts:19,31,37` — `invoice_id` column + FK + index (to be replaced)
- `src/lib/queries/transfer-mapping.ts:69,110-116` — the two silent-failure guards
- `src/lib/queries/investment-transactions.ts:111` — the duplicated third guard (client-share path)
- `src/lib/actions/transfers.ts:52,111,254,283-332` — every write, plus the media-cleanup diff
- `src/lib/utils/upload-file-client.ts:34-44,50-60,66-80` — the positional id↔position bridge
- `src/components/forms/expense-form/use-invoice-files.ts:23,53,74-86` — `Map<string, File>` custody
- `src/components/transfers/invoice-cell.tsx:28-38,72` — the upload/replace/remove widget
- `src/hooks/use-invoice-zip.ts:46,70-98` + `src/lib/export/invoice-zip.ts:39-69` — ZIP loop + tally
- `src/lib/ai/openrouter.ts:102-113,120-128` — model content array + fallback
- `src/lib/utils/process-upload-file.ts:8,89-94` + `next.config.ts:15` — the two size ceilings
- `src/migrations/20260720_0_add_kosztorys_shares.ts` — CREATE TABLE migration template
- `dumps/dump-latest.sql:1177` — `payload_locked_documents_rels`, the only `_rels` shape precedent

## Architecture Insights

- **The media join lives in TypeScript, not SQL.** `src/lib/queries/media.ts:31-58` caches the whole
  media table and filters by id in JS. That is why a schema change this invasive touches zero raw SQL
  in `src/lib/db/**` — and why `depth: 0` must stay.
- **The invoice file travels a side channel, not the form.** It never enters the zod schema; it rides
  a separate positional action parameter keyed to the row's stable client id. That keeps the schema
  work at zero but means the "contract" is a comment (`upload-file-client.ts:28-31`) rather than a type.
- **Read-only and read-write invoice widgets were deliberately split** (EX-585 reversing EX-569):
  `InvoicePreviewButton` (read-only) vs `InvoiceCell` (upload+delete). That split is the seam the
  change.md's design decision reasons about — put per-file remove in `InvoiceCell` only, and keep the
  client-facing table on the read-only component.
- **Typed-loose DB boundaries defeat `tsc` as a safety net here.** The three `typeof === 'number'`
  guards are the entire risk profile of this change; a red-first test on the mapper is worth more than
  any amount of careful reading.

## Historical Context (from prior changes)

- `context/archive/2026-07-11-receipt-scan-line-items/change.md` (EX-443) — **"1 receipt = 1 line item"**,
  and explicitly: fan-out is "one parallel extraction call per image … **NOT one multi-image call**",
  chosen for partial-failure isolation. Also "one upload to Payload media, two uses (extraction +
  attachment)". Scope was add-flow only, not the edit form. EX-659 is a candidate reversal of the
  fan-out decision, and the archived rationale is what must be argued against.
- `context/archive/2026-07-12-receipt-scan-heic-and-filesize/change.md` (EX-457) — HEIC conversion +
  the size riders. Its deferred HEIC backfill of 17 media records was blocked on a blob backup, which
  has since shipped — so that follow-up is unblocked (separate from EX-659). Minor doc drift: the guard
  is 4MB (`MAX_UPLOAD_BYTES`), not the 4.5MB the doc says.
- `context/archive/2026-07-25-kosztorys-client-invoices/change.md` (EX-569) — `MaterialTransactionRowT`
  gains the invoice triple via `fetchMediaByIds` + `extractInvoiceIds` at `depth: 0`; no server action
  because **media is `read: () => true` and blob URLs are already public** (recorded caveat: blob URLs
  are public, unguessable and permanent, surviving share-token revocation); `fetchFilteredTransfers`
  must never be exposed (caller-supplied `Where`, no investment scoping).
- `context/archive/2026-07-26-kosztorys-invoice-note-and-preview/change.md` (EX-585) — `invoiceNote`
  format (line 1 = numer faktury, then each pozycja) and the read-only/read-write widget split.
- `context/changes/blob-backup/runbook.md` (EX-459) — §0/§1/§2/§5 key the whole recovery mechanic on
  `transactions.invoice_id → media.id → media.filename == blob pathname`, and assert the mapping is
  1:1 (940 rows, 0 duplicates). **hasMany falsifies both the column name and the 1:1 claim.** Recovery
  itself is unaffected (filename-keyed puts), but this is an incident-time doc — it must be updated in
  this change. Still owed by EX-459 independently: confirming the first unattended cron run and the
  Phase 3 restore drill.
- `context/archive/2026-07-27-decouple-panel-write-refresh/change.md:280` — documents why media's
  `afterDelete` bumps `transfers`, citing the `ON DELETE SET NULL` FK that this change removes.
- `context/archive/2026-08-10-receipt-scan-netto-extraction/change.md` (EX-577) — scope-fenced netto
  extraction only; "broader wydatek-form adjustments are explicitly a later change". EX-659 is that change.

## Related Research

None — no prior research doc covers multi-file invoices. `grep` over `context/` for
`wielostron|multi-page|multiple file|hasMany` returns only this change's `change.md`.

## Open Questions

1. **How does a user declare "these 3 files are one invoice"?** This is the requirement gap, not a
   technical one. Candidates: a multi-select file input per row (explicit, hand-entry friendly, but
   the scan flow currently _mints_ rows from the picked set); a "dodaj stronę" button on an existing
   row; grouping by filename pattern (fragile). Nothing in the app supplies this signal today.
2. **One multi-image scan call, or N calls merged?** One call = a prompt sentence and no schema change,
   but hits the 4.5MB action body cap. N merged = a new merge module with a real correctness hazard
   (page subtotal vs document total) and a per-page `UNREADABLE_RECEIPT` policy, at N× tokens. If the
   answer is one call, the scan likely moves to an API route.
3. **Row DTO: array or "first + count"?** The ZIP tally and the download-all behaviour push toward a
   real array; the ~15 named consumers of the triple push toward a shim. Decide once, up front.
4. **Remove semantics on a saved expense.** Per-file remove in `InvoiceCell` (a media-id parameter on
   `removeTransferInvoiceAction`) vs remove-all. The change.md's design decision implies per-file.
5. **Does `updateTransferAction` finally get a remove path**, or does removal stay exclusive to the
   table cell? Today the edit form can only replace and it orphans the old media.
6. **Do we fix the pre-existing orphan leaks in this change** (transfer delete, failed submit,
   `updateTransferAction` replace), or file them separately? They get 2–3× worse here, which is an
   argument for now.
7. **What is the E2E disposition?** No invoice E2E exists at all; three surfaces are affected including
   an unauthenticated client-facing one.
