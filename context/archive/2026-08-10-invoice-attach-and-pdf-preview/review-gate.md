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
is the user's call (see „Manual verification" at the bottom).

## Findings

**Trimmed at archive (2026-08-11).** Pre-trim tally: 14 fixed, 6 dismissed, 4 dropped, 1 filed ·
0 open. The 14 `fixed` findings were dropped here: each one's durable record is the commit that
landed it, readable from the code itself. What survives is the negative space git cannot hold — the
findings we decided _not_ to act on, and why.

- [x] 🟡 WARNING · dropped · impl-review · `src/components/transfers/invoice-cell.tsx:34` · while
      uploading, the spinner branch replaces the whole trigger, so a row that already has pages loses
      its preview (and remove) for the duration. Transient, seconds long, and threading a `busy` flag
      through the shared `InvoicePreviewButton` costs more than it buys. Its missing `aria-label` WAS
      fixed.
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

## Manual verification

Not run before archive (needs the app + test DB up). The checks moved to
`context/foundation/manual-checks.md` → „Dodawanie faktur wprost z „+" w tabeli wydatków (EX-662)",
which is where open verification work is tracked; they are not repeated here.
