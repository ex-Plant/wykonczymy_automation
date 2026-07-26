# Review-gate ledger — kosztorys-invoice-note-and-preview (EX-585) · 2026-07-26

Diff scope: `1f5a90f7..HEAD` — `src/types/reference-data.ts`, `src/lib/queries/reference-data.ts`,
`src/lib/utils/invoice-note.ts`, `src/components/ui/invoice-preview-trigger.tsx`,
`src/components/dialogs/invoice-preview-button.tsx`, `src/components/transfers/invoice-cell.tsx`,
`src/components/kosztorys/summary/tables/materials-transactions-table.tsx`,
`src/__tests__/lib/utils/invoice-note.test.ts`.

Checks that ran (Step 1, parallel, read-only): `/10x-impl-review`, `/code-review`,
`tailwind-v4-audit`, `feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`,
`comment-noise-audit`. No Step 0.5 verification pass — this repo has no `verify-manual-checks` skill;
its manual checks live in `context/foundation/manual-checks.md` and are still owed by a human.

## Findings

- [x] dismissed · impl-review · `src/lib/queries/reference-data.ts:fetchMaterialTransactionsForInvestment` · `invoiceNote` reaches the unauthenticated `/k/<token>` client share view
      The exposure ruling that cleared invoice data for the client view was reasoned about **AI-extracted**
      invoice fields (numer faktury + pozycje). `invoiceNote` is a plain hand-editable textarea on the
      transfer form, so it can carry internal staff remarks. Raised because the answer is a business
      decision, not a code one — **owner ruled 2026-07-26: accept, the note is client-safe.** No code
      change; the column ships to the share view as-is.

- [x] 🔴 CRITICAL · fixed · code-review · `src/components/ui/invoice-preview-trigger.tsx:20-34` · the transfers „Faktura" icon lost its horizontal centering
      The extraction replaced `Button` (`inline-flex`) with a block-level `flex` element, so in the
      transfers table's `text-center` `<td>` the icon jumped to the left edge — a real visual regression
      this slice introduced. Fixed by composing the compact branch from `buttonVariants({ variant: 'ghost',
      size: 'icon' })` + `mx-auto`, which also restores the focus ring, radius and hover box the hand-rolled
      class list had dropped.
      test: no automated test · e2e — a pure layout regression; jsdom can't see centering. Folded into EX-570.

- [x] 🟡 WARNING · fixed · code-review · `src/components/ui/invoice-preview-trigger.tsx:26` · compact variant collapsed to zero size when the caller passed no `className`
      `InvoiceCell` renders it with no `className`, so the compact branch had no width/height at all and
      relied on the icon's intrinsic size. `buttonVariants({ size: 'icon' })` now supplies the 36px box as
      the default; `cn()` is tailwind-merge, so a caller's `size-7` still wins.
      test: no automated test · e2e — same layout-only class as above; covered by EX-570.

- [x] 🟡 WARNING · fixed · code-review · `src/components/kosztorys/summary/tables/materials-transactions-table.tsx:66-84` · the Notatka tooltip was keyboard-unreachable, and clicking it navigated the row
      `HintTooltip` wraps children in a `<span>` — no tab stop — so the full note (which exists nowhere
      else on the page) was mouse-only. And a plain `<span>` inside a linked row meant a click to read the
      note navigated away. Switched to `SimpleTooltip` + a real `<button>`, which fixes both: it is
      focusable, and `DataTable`'s row-link handler already skips clicks landing on a `button`.
      Rejected the alternative of adding `tabIndex={0}` to the shared `HintTooltip` — that would add a tab
      stop to every hint tooltip in the app to fix one cell.
      test: no automated test · e2e — keyboard focus + click-doesn't-navigate are browser facts. Folded into EX-570.

- [x] 🔵 OBSERVATION · dismissed · code-review · `.../materials-transactions-table.tsx:42` · `ROW_HEIGHT = 44` is arguably one px short of what a row renders
      `<tr>` carries `border-b` under `border-collapse`, which the 36 + 8 arithmetic in the comment doesn't
      account for. **Pre-existing, not introduced here** — the wypłaty list has the identical 36-vs-37 gap
      and has shipped fine. Changing a virtualizer's `estimateSize` on unverified arithmetic is exactly how
      you introduce the drift you were trying to avoid, so the number stands and the comment was softened
      to say the estimate must track whatever the tallest cell actually renders. The three row-height
      entries already in `manual-checks.md` are this finding's real guard.
      test: no automated test · e2e — measured, not computed; belongs to the manual checks + EX-570.

- [x] fixed · primitive-reuse-scan · `src/components/ui/invoice-preview-trigger.tsx:31` · third copy of the `mimeType.startsWith('image/')` icon derivation
      `InvoicePreviewButton` and `LineItemInvoiceField` each computed `isImage` and passed it down.
      The trigger now takes `mimeType` and derives the icon once; both callers pass the raw field.

- [x] fixed · module-cohesion · `src/hooks/use-invoice-zip.ts` · hook lived under `src/components/transfers/` but has two consumers in different features
      `git mv`'d to `src/hooks/`; both importers repointed. Flagged by `structure-scatter-audit` as the one
      real scatter the slice created — EX-585 gave the hook its second, cross-feature consumer.

- [x] fixed · comment-noise · `src/lib/utils/invoice-note.ts:1-6` · comment claimed the note *is* an AI-written invoice number
      It is free text a human can type. Reworded to say line 1 is the AI scan's *shape*, not a guarantee —
      and the export was renamed `invoiceNumberFromNote` → `firstNoteLine` so the name stops asserting
      something the function can't know. Test file renamed with it.

- [x] fixed · comment-noise · `src/types/reference-data.ts` · `MaterialTransactionRowT`'s doc comment repeated the same "AI-written invoice number" overclaim
      Corrected in step with the util above.

- [x] fixed · code-review · `src/components/ui/invoice-preview-trigger.tsx:5` · `aria-label` read as a verb phrase („Podgląd faktury" as an action) and the props type wasn't exported
      Reworded to name the target file, and `InvoicePreviewTriggerPropsT` is now exported so
      `InvoicePreviewButton` can `Pick<>` its pass-through props instead of redeclaring them.

- [x] dropped · tailwind-v4-audit · — · no v4 violations in the diff
      No `var(--x)` in arbitrary values, no dynamic class-name construction, no inline `style`. Nothing to fix.

- [x] dismissed · feature-first-structure · `src/components/ui/invoice-preview-trigger.tsx` vs `src/components/dialogs/invoice-preview-button.tsx` · the invoice code spans four directories
      Verified legitimate rather than scattered: `ui/` holds the presentational trigger, `dialogs/` the
      stateful trigger+dialog pair, `transfers/` and `forms/` the feature call sites. Each tier has a
      different reuse radius, which is the paradigm this repo already uses everywhere else.

- [x] filed EX-586 · skipped · `src/components/transfers/invoice-cell.tsx:26,48-83` and `src/components/forms/form-fields/line-item-invoice-field.tsx:56-85` · third copy of the trigger+state+dialog triad (incl. a verbatim copy-pasted comment)
      Not auto-applied: collapsing them onto `InvoicePreviewButton` means moving `previewOpen` inside a
      shared component whose `onReplace` currently depends on closing that state first — behavior-changing
      and uncertain, so it earns its own review rather than a review-gate edit.

- [x] filed EX-587 · skipped · `src/lib/queries/reference-data.ts` · 342 LOC, 14 exports, three unrelated topics, filename names its importer
      Pre-existing; EX-585 added two lines inside one existing fetcher. Splitting it ripples across every
      consumer of eleven fetchers — a standalone refactor, not a gate fix.

- [x] filed EX-570 · deferred · — · browser-level coverage for the Notatka column and the per-row preview
      EX-570 is this slice's existing `e2e-backlog` issue; extended by comment rather than duplicated.
      It now also owns: multi-line note → line 1 + tooltip, keyboard reach, click-doesn't-navigate,
      preview opens for image and PDF, spacer on invoice-less rows, virtualized row alignment, `clientView`.

## Simplify pass

`/simplify` is a built-in slash command and is not invocable as a tool from this context, so the
equivalent mutating pass was run **inline in the main thread** instead: the reuse/dedup/comment
findings above were applied directly, plus a `primitive-reuse-scan` (which produced the `mimeType`
dedup and EX-586). Every result is folded into `## Findings` above — 8 applied, 1 proposed,
2 dismissed, 1 dropped, 3 skipped/deferred (all filed). No separate `/simplify` report file exists.

## Tests & suite

- `pnpm typecheck` — pass, 0 errors.
- `pnpm lint` — pass, 0 errors / 88 warnings, all pre-existing in `src/migrations/*`.
- `pnpm test` — pass, 92 files / 1146 tests (20 files, 51 tests skipped), 31.75s.
- `pnpm test:e2e` — skipped by the user; the slice's browser risk is filed as EX-570.
- `pnpm build` — skipped by the user; typecheck + lint cover the compile surface for a UI-only diff.
- No new automated tests authored: every correctness finding above is layout/keyboard/navigation
  behavior that only a browser can observe. The one unit-testable surface (`firstNoteLine`) already
  has 6 specs, carried over intact through the rename.

## Archive gate

**Blocked — not archivable.** All findings are closed (0 open `[ ]`), but one blocker remains:

- The EX-585 section of `context/foundation/manual-checks.md` has 14 unticked boxes. Manual checks
  passing is a hard blocker for `Done`, so EX-585 stays in progress with the `in review` label and the
  change stays at `status: implemented`. Run those checks, then `/10x-archive`.
