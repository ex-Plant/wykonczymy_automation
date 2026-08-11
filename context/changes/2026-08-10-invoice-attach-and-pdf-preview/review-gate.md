# Review-gate ledger — invoice-attach-and-pdf-preview (EX-662) · 2026-08-11

Scope: the uncommitted EX-662 diff on `konradantonik/ex-662-invoice-attach-from-picker`
(branched off the EX-659 branch, so the base for review is `8d82c0d9`..working tree).

Files under review:

- `src/lib/actions/transfers.ts` (M)
- `src/__tests__/transfer-actions.test.ts` (M)
- `src/components/transfers/invoice-cell.tsx` (M)
- `src/components/forms/expense-form/use-invoice-files.ts` (M)
- `src/components/forms/expense-form/use-invoice-ingest.tsx` (M)
- `src/components/dialogs/invoice-upload-dialog.tsx` (D)
- `src/hooks/use-invoice-upload.ts` (new)
- `src/lib/invoices/ingest-files.ts` (new)
- `src/lib/invoices/blocked-files-message.tsx` (new)

Checks run (Step 1, parallel, read-only): `/10x-impl-review`, `/code-review`, `/tailwind-v4-audit`,
`feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit`
(flag-only). Step 2 (serial, mutating): `primitive-reuse-scan` + `/simplify`.

Step 0.5 (dispatched browser verification) **not run** — the pass needs the app + test DB up and
is the user's call; manual verification stays an open archive blocker (Step 4, blocker 2).

## Findings

- [x] 🟡 WARNING · fixed · code-review + impl-review · `src/hooks/use-invoice-upload.ts:36` ·
      orphan cleanup only covered a returned `success:false`, not a transport-level rejection of the
      action (network drop / 502) — the uploaded pages leaked in Blob referenced by nothing. Now
      wrapped in try/catch that discards then rethrows.
      test: no automated test · e2e — filed into EX-663; the leak is only observable at the real
      network + Blob boundary a unit test mocks away.
- [x] 🟡 WARNING · fixed · code-review + impl-review · `src/components/transfers/invoice-cell.tsx:69` ·
      `sr-only` clips the file input but keeps it focusable, so a second pick could start mid-upload;
      two concurrent `setTransferInvoices` read-modify-writes lose the first batch's pages. Added
      `disabled={isUploading}`.
      test: no automated test · e2e — filed into EX-663 (case 4); needs real concurrent in-flight
      uploads.
- [x] 🟡 WARNING · fixed · code-review · `src/hooks/use-invoice-upload.ts:51` · success was invisible
      (`router.refresh()` is not awaited, and the dialog's „Faktura dodana" toast died with it), so a
      slow refresh reads as a failed upload and invites a second pick of the same photo — which
      `next.includes(id)` cannot dedupe, since a re-upload mints a new media id. Success toast
      restored.
      test: no automated test · e2e — user-visible feedback, filed into EX-663 (case 1).
- [x] 🟡 WARNING · dropped · impl-review · `src/components/transfers/invoice-cell.tsx:34` · while
      uploading, the spinner branch replaces the whole trigger, so a row that already has pages loses
      its preview (and remove) for the duration. Transient, seconds long, and threading a `busy` flag
      through the shared `InvoicePreviewButton` costs more than it buys. Its missing `aria-label` WAS
      fixed.
- [x] 🔵 OBSERVATION · fixed · code-review + impl-review · `src/lib/actions/transfers.ts:339` ·
      the empty-batch shortcut returned `{ success: true }` _before_ `protectedAction`, so success no
      longer implied authorized. Moved inside the handler.
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/__tests__/transfer-actions.test.ts` · no case for
      duplicate ids _within_ one batch — the branch the batch signature newly introduces, and the one
      that breaks under the natural `filter(id => !current.includes(id))` rewrite. Added.
- [x] 🔵 OBSERVATION · fixed · impl-review · `plan.md:95` · Phase 2's gate
      (`vitest run src/__tests__/components/forms/expense-form`) exercised none of the moved code —
      it passed without being able to fail. Added `src/__tests__/lib/invoices/ingest-files.test.ts`
      pinning the positional contract (a blocked file leaves a hole at its own index) the form's row
      pairing rides on, and pointed the criterion at it.
- [x] 🔵 OBSERVATION · fixed · impl-review · `plan.md` · `ingest-files.ts` and the
      `use-invoice-files.ts` edit shipped without appearing in any phase's Changes Required, and
      `blocked-files-message.tsx` landed in `lib/invoices/` not the planned `components/invoices/`.
      Plan updated to match what shipped, with the placement rationale.
- [x] 🔵 OBSERVATION · fixed · impl-review · `context/changes/e2e-harness/research.md:96` · still
      cited the deleted `invoice-upload-dialog.tsx:37` as an E2E candidate. Repointed at
      `invoice-cell.tsx`.
- [x] 🔵 OBSERVATION · fixed · code-review · `change.md` · routing the table through
      `processUploadFile` narrows behaviour: a >4 MB invoice PDF that used to attach raw is now
      rejected. Intentional (the raw path could hit Vercel's uncatchable 4.5 MB 413) but user-visible
      on the one surface where PDFs are common — recorded in the change notes.
- [x] fixed · reuse-scan · `src/lib/invoices/blocked-files-message.tsx:13` · the blocked-file report
      (guard + toast + the same `TODO(EX-449)` comment) was written twice. Collapsed into
      `reportBlockedFiles(blocked)`; `blockedFilesMessage` is now private.
- [x] fixed · reuse-scan · `src/lib/utils/upload-file-client.ts:117` · the cryptic
      `resolveInvoiceMediaIds(1, new Map([[0, files]]))` single-row incantation had a second site.
      Added `resolveInvoicePageIds(files)` and routed both (`use-invoice-upload.ts`,
      `edit-transfer-form.tsx`) through it.
- [x] fixed · simplify · `src/lib/utils/upload-file-client.ts:23` · deleting the dialog removed
      `uploadFileClient`'s last external consumer — it survives only as a default arg, so the
      `export` was dead surface. Dropped.
- [x] fixed · simplify · `src/lib/actions/transfers.ts:339` · handler was a non-`async` arrow forced
      into `return Promise.resolve(...)`. Made `async`.
- [x] fixed · comment-noise · `use-invoice-upload.ts:13`, `ingest-files.ts:16`, `transfers.ts:329` ·
      three doc-comment paragraphs restated the code (what the hook is, what `processUploadFile`
      does, "appends in pick order" over a four-line append loop). Trimmed to the load-bearing why.
- [x] dropped · simplify · `src/lib/actions/transfers.ts:344` · the append loop could be
      `[...new Set(...)]`, but that also silently dedupes `current` — a behaviour delta — and every
      strictly-equivalent rewrite reads worse than the loop.
- [x] dropped · simplify · `src/components/transfers/invoice-cell.tsx:25` · the
      `[...(e.target.files ?? [])]` + `e.target.value = ''` pick idiom now appears 3× (two
      pre-existing). A `pickedFiles(e)` helper saves ~1 line per site while each site's rationale
      comment stays anyway — the params would be the code.
- [x] dropped · simplify · `use-invoice-files.ts:9` · `IngestResultT` could be
      `Pick<IngestOutcomeT, 'blocked'>`; cosmetic, and the literal states more plainly that the hook
      deliberately doesn't leak `processed`.
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/transfers/invoice-cell.tsx:18` ·
      row state is keyed by position (the table sets no `getRowId`), so `isUploading` belongs to a
      slot rather than a transfer. Pre-existing (`removedIds` has the same shape), unchanged by this
      diff, and only reachable if another cell's refresh reorders rows mid-upload.
- [x] dismissed · structure-scatter · `src/hooks/` holds both React hooks and Payload collection
      hooks (`hooks/transfers/*`) — a real naming collision, pre-existing, untouched by this diff and
      not this slice's to resolve.
- [x] dismissed · module-cohesion · `src/lib/actions/transfers.ts` (373 LOC) has a latent
      CRUD-vs-invoice-ops seam. Under both thresholds, seam predates the branch.
- [x] dismissed · simplify · `src/hooks/use-invoice-upload.ts:66` · `uploadFiles`' busy-flag envelope
      resembles `useInvoiceIngest.runIngest`, but the contracts diverge load-bearingly (boolean vs
      `Set<string>` of row ids; server round-trip + orphan cleanup vs local map write).
- [x] dismissed · tailwind-v4-audit · nothing to report — only token utilities
      (`text-muted-foreground`, `animate-spin`, `sr-only`); no `[var(--x)]`, no inline `style`, no
      arbitrary values.
- [x] dismissed · feature-first-structure + module-cohesion + structure-scatter · placement is
      correct and the diff is a net structural improvement: both helpers were promoted to
      `lib/invoices/` at the moment a second consumer appeared, `use-invoice-ingest` shed a
      three-kind mix, and a `components/dialogs/` file was deleted rather than added. JSX under
      `lib/` follows the existing `lib/export/print.tsx` precedent.
- [x] filed · gate · E2E for the whole picker→attach path — **EX-663** (`e2e-backlog`, project
      Wykonczymy). Four cases: two photos in one pick, re-pick after removal, oversize toast +
      no orphans, and no second pick while one is in flight.

## Simplify pass

Ran `primitive-reuse-scan` + `/simplify` serially after the fan-out — 4 applied, 3 dropped,
1 dismissed; every finding folded into `## Findings` above (tagged `simplify` / `reuse-scan`).
Two findings the pass parked as "outside the given file list" were **not** accepted as deferrals
(the gate's scope test is size/risk, not file-set) and were landed by hand: the
`resolveInvoicePageIds` dedup and the dead `uploadFileClient` export.

`src/components/forms/expense-form/use-invoice-ingest.tsx` → `.ts` — it no longer contains JSX after
the message renderer moved out.

## Tests & suite

Whole-tree gate re-run after the mutating pass, all green:

- `pnpm typecheck` — clean
- `pnpm lint` — 0 errors (81 pre-existing migration `db`-arg warnings)
- `pnpm test` — 1995 passed, 86 skipped
- `pnpm build` — succeeded

New specs: `src/__tests__/lib/invoices/ingest-files.test.ts` (3 cases), plus the duplicate-ids batch
case in `src/__tests__/transfer-actions.test.ts` (73 in that file).

## Archive blockers

1. ~~Open findings~~ — none; every box is checked.
2. **Manual verification — still owed.** Three checks from `plan.md`: two photos on one „+" attach
   both pages; a HEIC from an iPhone attaches from the table (fails today); an oversize photo gives
   the same Polish toast as the wydatek form. Now also worth confirming: the „Faktura dodana" toast
   fires and the row updates.
