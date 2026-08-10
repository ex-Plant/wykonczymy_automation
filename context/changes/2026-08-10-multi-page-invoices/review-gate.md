# Review-gate ledger — multi-page-invoices (EX-659) · 2026-08-10

Diff under review: `8d82c0d9..HEAD` (commits `256bb423`, `e86859ea`, `abfc6c0d`, `4cd98d0c`,
`e71abbcb`, `a2aaa7bc`, `0b46428b`) plus the uncommitted review fixes.

## Findings

<!-- One checkbox per finding, most-severe first. Severity tags are the bug-finding checks' own
     (impl-review / code-review); the structural + comment audits carry none. -->

- [x] 🔴 CRITICAL · fixed · impl-review F1 + code-review · `src/lib/actions/media.ts:12` ·
      `deleteOrphanedMediaAction` deleted any media id the client named — a `'use server'` export
      any MANAGEMENT session can call in a loop, and the new rels FK is `ON DELETE cascade`, so
      each delete silently strips that page off every expense pointing at it. Fixed by routing all
      three cleanup sites through one guarded helper (`src/lib/invoices/delete-unreferenced-media.ts`)
      that counts referencing transactions first and skips anything still attached.
      test: test-driven-debugging · unit — `transfer-actions.test.ts` „refuses an id a transfer still
      references" is red against the old unguarded action
- [x] 🔴 CRITICAL · fixed · impl-review F2 · `src/lib/actions/transfers.ts:317` · orphan deletes were
      fire-and-forget in a serverless action; the invocation can be frozen the moment the response is
      written, dropping exactly the deletes Phase 6 exists to make. Now awaited.
      test: no automated test — the failure is the platform freezing the invocation, which no unit
      harness reproduces; the fix is a one-token `await` the reviewer verified by reading
- [x] 🟡 WARNING · fixed · impl-review F8 · `src/lib/actions/transfers.ts:289` · „a media row is only
      ever linked from the transfer that uploaded it" was asserted in two comments and enforced
      nowhere — while `updateTransferInvoiceAction` and the admin panel both let a media id be
      attached twice. Same guarded helper as F1 turns the assertion into a check.
      test: test-driven-debugging · unit — `delete-invoice-media.test.ts` „keeps a page another
      expense still references"
- [x] 🟡 WARNING · fixed · impl-review F6 · `src/lib/actions/transfers.ts:325,338,349` · the three
      invoice actions went through `protectedAction` only, so any MANAGER could detach — and thereby
      permanently delete — the invoice of any transfer, cancelled ones included. All three now run
      `fetchAndAuthorize(payload, user, transferId, 'edycji')` like the other mutators.
      test: no automated test — `fetchAndAuthorize` and `canMutateTransfer` already carry their own
      specs; this finding is the missing call, verified by the existing action specs still passing
      through it
- [x] 🟡 WARNING · fixed · impl-review F5 + F7 · `src/app/(frontend)/api/extract-receipt/route.ts` ·
      the scan route validated less than the upload route it was copied from (no mime allowlist, no
      empty-file check, no page bound, `JSON.parse` unguarded → a client typo became a 500 that fired
      the SENTRY-REQUIRED log), and its scaled timeout budget could outlive the function. Added the
      `Media.upload.mimeTypes` mirror, `MAX_RECEIPT_PAGES = 8` sized so (30s + 15s×7) × 2 attempts
      stays under the declared `maxDuration = 300`, an empty-file reject, and a `safeParse` + a
      `SyntaxError` → 400 branch.
      test: TDD · unit — new `__tests__/app/(frontend)/api/extract-receipt/route.test.ts`, 8 specs
      covering role, page cap, mime, empty file, malformed JSON, wrong-shape JSON, provider failure
- [x] 🟡 WARNING · fixed · impl-review F4 + code-review · `upload-file-client.ts:78`,
      `expense-form.tsx:163` · `mapWithConcurrency` rejects the whole call on the first failing page,
      so the pages that already landed in Blob were unrecoverable and the cleanup — gated on
      `invoiceMediaIds` being assigned — never ran for the failure mode that produces the most
      orphans. `resolveInvoiceMediaIds` now catches per page, short-circuits the rest of the batch,
      and throws `InvoiceUploadError` carrying the ids that did land; both forms hand those to
      cleanup. (Its siblings kept running past a rejection, so a snapshot at throw-time would have
      missed ids — hence per-page catching rather than a `Promise.allSettled` at the seam.)
      test: test-driven-debugging · unit — `invoice-media-resolve.test.ts` „reports the
      already-uploaded ids when a page fails"
- [x] 🟡 WARNING · fixed · impl-review F3 · `src/hooks/transfers/delete-invoice-media.ts:16` · the
      hook passed `req` into `payload.delete`, enlisting a best-effort delete in the expense-delete
      transaction — one Postgres-level failure would abort it and roll back the expense delete with
      an unrelated error, which no `.catch` can undo. `req` dropped.
      test: test-driven-debugging · unit — `delete-invoice-media.test.ts` „runs the media delete
      outside the expense-delete transaction"
- [x] 🟡 WARNING · fixed · impl-review F9 · `edit-transfer-form.tsx:174` · plan drift: Phase 3.3's
      contract said „removal routes through the Phase 3.1 actions", but the form rendered
      `InvoicePreviewButton` with no `onRemove`/`onRemoveAll`. Wired both in — and extracted the
      optimistic-hide + Polish-confirm logic it shares with `invoice-cell.tsx` into
      `src/hooks/use-invoice-removal.ts` rather than copying it.
      test: no automated test — pure prop wiring over already-specced actions; the behaviour is a
      manual/E2E check (see `manual-checks.md`)
- [x] 🟡 WARNING · fixed · code-review · `line-item-invoice-field.tsx:81`,
      `use-invoice-files.ts:47` · the „dodaj stronę" input never cleared its value, so removing a
      page and re-picking that same file fired no change event — silent no-op, no error, no toast.
      The batch pickers in `line-items-field.tsx:207` already did this, so it was inconsistent inside
      one diff. Cleared right after the files are captured.
      test: no automated test — DOM value-reset is not observable at the unit layer; belongs to the
      browser pass
- [x] 🟡 WARNING · dismissed · code-review · `extract-receipt/route.ts:23` · „the route does not
      escape the body cap it was created for" rests on Vercel functions capping request bodies at
      4.5 MB. That limit was raised to 100 MB; the route-handler path genuinely does escape
      `next.config.ts`'s server-action `bodySizeLimit: '4.5mb'`, which is the whole reason the scan
      is a route. The resource-bound half of the concern (unbounded pages buffered in RAM and billed
      to one model call) is real and is closed by `MAX_RECEIPT_PAGES` above.
- [x] 🔵 OBSERVATION · fixed · code-review · `expense-form.tsx:179` · `void deleteOrphanedMediaAction(…)`
      with no `.catch`, unlike both sibling best-effort deletes — a transport-level failure would
      surface as an unhandled rejection at the moment the user is already looking at a failed submit.
      Extracted `src/lib/utils/discard-orphaned-uploads.ts` (fire-and-forget **with** the `.catch`)
      and pointed both forms at it.
- [x] 🔵 OBSERVATION · fixed · code-review · `line-item-invoice-field.tsx:17` · `useObjectUrls`
      early-returned on an empty file list without clearing `urls`, leaving already-revoked handles
      in state and quietly satisfying the pairing guard one line below with stale entries. Empty
      branch now clears.
- [x] 🔵 OBSERVATION · fixed · code-review · `invoice-preview-dialog.tsx:110` · the archive name was
      built from a filename with its extension, producing `faktury-20260315_Cegly.jpg-<date>.zip`.
      Added `stripExtension` and applied it at the call site only — putting it inside
      `buildInvoiceArchiveName` would truncate an investment name like „Dom ul. Polna 3".
- [x] 🔵 OBSERVATION · fixed · impl-review F10.2 · `src/migrations/20260810_0_invoice_has_many.ts:55` ·
      `down` re-added the FK with no guard while everything around it had one, so a second `down`
      errored. Now drops the constraint first.
- [x] 🔵 OBSERVATION · fixed · impl-review F10.4 · `invoice-preview-trigger.tsx:50`,
      `upload-file-client.ts:9` · `text-[0.625rem]` → the existing `text-2xs` token; STRIP-TEST-failing
      JSDoc removed.
- [x] 🔵 OBSERVATION · fixed · impl-review F10.3 · `context/foundation/manual-checks.md` · no
      `## EX-659` section existed although every phase was marked done. Section added at close-out.
- [x] 🔵 OBSERVATION · skipped · impl-review F10.1 · `context/changes/2026-08-10-cron-lead-reconcile/*` ·
      commit `e71abbcb` swept 405 lines of another change's docs into an EX-659 commit — a
      stage-by-explicit-path failure. Not fixed: the only clean removal is rewriting published branch
      history, which is a bigger and riskier operation than the mistake, and the files are inert
      prose that belongs in the repo either way. Flagged to the user instead.
- [x] fixed · module-cohesion + structure-scatter · `src/lib/queries/transfer-mapping.ts:108-135` ·
      extracted the invoice-field reader into `src/lib/invoices/invoice-field.ts` — a Payload
      `afterDelete` hook reaching into a UI-table row-mapper was a layer crossing. Four importers
      repointed; its specs moved to `__tests__/lib/invoices/invoice-field.test.ts`.
- [x] fixed · feature-first · `src/components/ui/invoice-preview-trigger.tsx:4` · a `ui/` primitive
      importing a domain type and rendering Polish invoice copy — `git mv`'d to
      `components/dialogs/` next to its sole consumer.
- [x] fixed · feature-first · `src/hooks/use-invoice-zip.ts:14` · dead `InvoiceZipRowT` re-export
      (zero consumers) creating a second import path — deleted.
- [x] fixed · comment-noise · 5 deletions / 4 trims across `transfers.ts:338,350`,
      `use-invoice-zip.ts:48,85`, `transfer-mapping.ts:126-128`, `scan-receipt-client.ts:3`,
      `route.ts:8`, `invoice-zip.ts:79-80`, `invoice-preview-trigger.tsx:49-50`.
- [x] dropped · module-cohesion · `src/lib/utils/upload-file-client.ts:35-83` · `positionalFiles` /
      `filesByRowId` / `resolveInvoiceMediaIds` are the expense form's wire contract rather than
      upload transport. Real, but the split would move three functions and their single spec for no
      behavioural gain, and the module is 90 LOC — not worth the churn against a slice already
      carrying a bigger extraction (`lib/invoices/`).
- [x] dropped · module-cohesion · `src/lib/export/invoice-zip.ts` · 9 exports across three kinds
      (filename rules, Polish toast copy, row model). Same call: the kinds are all "how an invoice
      archive is named and reported", every export has a consumer, and splitting it would scatter one
      cohesive story across three files.
- [x] dismissed · module-cohesion · `src/components/forms/form-fields/line-items-field.tsx` · 439 LOC
      but one render surface, one reason to change — proportionate growth.
- [x] dismissed · structure-scatter · `src/lib/utils/` junk-drawer trend · this slice followed the
      existing `*-client.ts` precedent; not the slice's fault.
- [x] fixed · reuse-scan · `src/lib/invoices/invoice-field.ts:24` · private `toNullableId` /
      `field.map(…)` id-unwrapping re-implemented the existing `resolveId` primitive
      (`src/lib/utils/resolve-id.ts`). Both this file and `transfer-mapping.ts:78` now delegate to
      it; `transfer-mapping`'s copy stays only as a 2-line null-vs-undefined adapter for `TransferRowT`.
- [x] fixed · reuse-scan · `src/lib/export/invoice-zip.ts:27,41` · `getExtension` + `stripExtension`
      re-implemented `splitExtension` (`src/lib/utils/append-short-id.ts:5`). Both deleted; the three
      call sites (`buildUniqueFilename`, `dedupeFilename`, `invoice-preview-dialog.tsx:112`) now use
      `splitExtension`. The two differ only on a leading-dot filename, which Payload's
      `sanitizeFileName` makes unreachable — covered by a new
      `__tests__/lib/utils/append-short-id.test.ts` that inherits the deleted `getExtension` specs.
- [x] fixed · reuse-scan · `src/components/forms/expense-form/use-invoice-files.ts:60` · `pageFilename`
      hand-split the extension a fourth time — same `splitExtension`.
- [x] fixed · reuse-scan · `src/lib/utils/scan-receipt-client.ts:5` · in-diff copy of
      `upload-file-client.ts`'s fetch-and-unwrap-`{error}` wrapper. Extracted
      `src/lib/utils/post-form-data.ts`; both clients route through it (`UploadResultT` deleted).
- [x] fixed · reuse-scan · `src/app/(frontend)/api/extract-receipt/route.ts:30` · hand-rolled
      role/session gate duplicating the sibling upload route's — both now use
      `requireAuth(MANAGEMENT_ROLES)`.
- [x] fixed · reuse-scan · `src/components/dialogs/invoice-preview-dialog.tsx:44,59,83` +
      `invoice-preview-trigger.tsx:27` · the image-vs-pdf mime discrimination written four times.
      Extracted `src/lib/invoices/mime.ts` (`isImageMime` / `isPdfMime` / `isPreviewableMime`).
- [x] fixed · reuse-scan · `invoice-download-button.tsx:37`, `csv-button.tsx:34`,
      `materials-transactions-table.tsx:175` · `new Date().toISOString().slice(0, 10)` re-implemented
      the existing `today()` (`src/lib/utils/date.ts`) — three pre-existing call sites the new
      `today()` user made visible; all repointed (dedup reaching outside the diff is in scope).

## Simplify pass

Ran `primitive-reuse-scan` over the branch diff — 7 confirmed dupes, all 7 fixed; folded into
`## Findings` above tagged `reuse-scan`. No open or proposed items. Homes catalogued:
`src/components/ui`, `src/hooks`, `src/lib/**`, `src/types` (read from the repo's existing
`.reuse-scan.json`).

## Tests & suite

- Whole-tree gate before the review: `tsc --noEmit` clean · `pnpm lint` 0 errors (80 pre-existing
  warnings) · `vitest run` 1976 passed / 86 skipped · `pnpm test:integration` 83 passed ·
  `pnpm build` succeeded.
- Whole-tree gate after the review fixes + reuse scan: `tsc --noEmit` clean · `pnpm lint` 0 errors
  (82 pre-existing warnings, none in the slice's files) · `vitest run` 1988 passed / 86 skipped ·
  `pnpm test:integration` 83 passed · `pnpm build` succeeded.
- `pnpm test:integration` first failed on its **re-import** leg, not on a spec: `db:import:test`
  restored the dump onto a already-migrated test DB, and the dump's `DROP TABLE`s can't drop
  `transactions` / `media` while the migration's new `transactions_rels` references them — so the
  restore half-applied and the migration then re-ran against a broken schema. Any future migration
  adding a table with FKs into dumped tables would hit the same wall, so `db:import:test` now
  resets the schema (`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`) before restoring. Test DB
  only — `db:import` (dev, 5433) is untouched.
