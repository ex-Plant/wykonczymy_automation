# Review-gate ledger — ex-672-remove-print-csv-export · 2026-08-12

Unit: branch `konradantonik/ex-672-remove-print-csv-export` vs `staging`.

Step 0.5 verification: **discharged by the user's own manual pass** (all 7 boxes in
`context/foundation/manual-checks.md § EX-672` ticked 2026-08-12). No dispatched browser pass.

Fan-out: `/10x-impl-review` (APPROVED — 0 critical, 2 warnings, 6 observations), `/code-review`
(read-only, diff-scoped — **no correctness bugs**), `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` (flag-only).
Dropped: `/tailwind-v4-audit` — no styling in the diff.

Both bug-finding checks independently verified the load-bearing invariant: the invoice-download
button's visibility set is **unchanged** (the four pages that passed `headerFields` now pass
`invoiceDownload: true`; `manager-dashboard.tsx` had none before and has none now), and no
reference to any deleted module survives anywhere in `src`, `e2e`, `scripts`.

## Findings

- [x] 🔵 OBSERVATION · fixed · `src/styles/globals.css:251` · the app-wide `@media print` block (hide
      `aside`/mobile nav, white body, kill shadows) was added by `c0db593d "feat: add print styles for
    worker report"` — the feature this slice removes. It never applied to the deleted export path
      (`buildPrintHtml` rendered a standalone iframe document with its own `@page`) and doesn't apply
      to the surviving invoice print (`invoice-preview-dialog.tsx:63` opens a fresh window). Surfaced
      rather than auto-applied because deleting it changes what a user sees on Ctrl+P; **owner ruled
      remove** (2026-08-12), so it goes with the feature it was written for.

- [x] 🟡 WARNING · fixed · `src/__tests__/investment-render-parity-db.test.ts:40` · the parity spec
      hand-rolled the balance formula it exists to guard, violating `lessons.md:23` rule 1 (a parity
      test must call the functions the surface renders). Now imports `computeSummary` from
      `components/ui/toggle-stat-buttons` — the actual rendered path — and the inert `BILANS_LABEL`
      guard and dead `visibility` param are gone with the copy. `computeSummary` was widened from
      `readonly StatEntryT[]` to the structural minimum `readonly { label, amount }[]` to accept
      `FinancialFieldT` directly.
      test: no automated test — the change _is_ the test hardening; `pnpm test:parity` re-proves
      equivalence against the golden master.

- [x] 🟡 WARNING · fixed · `src/lib/actions/fetch-transfers-for-invoices.ts:20` · comment still read
      "no place in CSV, print, or invoice ZIP output" — two of the three were deleted by this slice.
      Trimmed to name only the invoice ZIP.

- [x] 🔵 OBSERVATION · fixed · `src/components/ui/toggle-stat-buttons.tsx:29,44,57` · `onToggle` had
      zero passers after `FinancialStats` stopped wiring the store — a permanently-`undefined` prop
      behind a `?.()`. Prop, destructure and call deleted.

- [x] 🔵 OBSERVATION · fixed · `src/components/ui/data-table/data-table.tsx:38-42,104` · the `toolbar`
      render prop's third arg `sorting` existed only so the deleted `TransferExportToolbar` could
      feed `sortTransferRows`; all seven surviving consumers call `(table, cv)` or `()`. Param and
      argument dropped. (`SortingState`/`sorting` remain load-bearing for the table's own state.)

- [x] 🔵 OBSERVATION · fixed (comment half) / skipped (behavior half) · `raporty/page.tsx:82` · the
      new `invoiceDownload` JSDoc told callers to set the flag "only where the table's own filter is
      a meaningful invoice scope", yet `/raporty` passes an unanchored `where`. **Pre-existing
      behavior** — the old toolbar carried the same button there — so gating the button would change
      what a user may do and is not a review-gate auto-apply. Rewrote the doc to describe what the
      flag _does_ and to name `/raporty` as the deliberate global case.

- [x] 🔵 OBSERVATION · dismissed · `src/types/export.ts:4` · `HeaderFieldT` lost its `export` (knip
      flagged the keyword once the four pages stopped importing it; the plan's ban was on deleting
      the _type_, not the keyword). Moot — the file was dissolved entirely, see below.

- [x] structure · fixed · `src/lib/export/` · **all three organization audits converged
      independently**: neither survivor was export code. `invoice-zip.ts` carries the _invoice_
      domain and all four of its consumers are invoice consumers → `src/lib/invoices/`;
      `download.ts` has zero domain knowledge and is the same kind of one-liner as the 35 files in
      `src/lib/utils/` → `src/lib/utils/trigger-download.ts`. Directory deleted. Its spec moved to
      the mirrored path `src/__tests__/lib/invoices/invoice-zip.test.ts`.

- [x] structure · fixed · `src/types/export.ts` · same convergence from the cohesion side: its two
      exports shared no reason to change, coupled only through the deleted print pipeline.
      `FinancialFieldT` → `src/types/investment-financials.ts` (next to `CategoryCostT`, which
      `map-category-costs.ts` derives it from); `TransferTableConfigT` is one component family's
      props contract, not a cross-cutting type → new `src/components/transfers/transfer-table-config.ts`.
      File deleted.

- [x] structure · fixed · `src/lib/actions/export.ts` · correctly tiered but stale-named — one
      surviving caller, and the last thing in the repo named for a capability that no longer exists.
      Renamed `fetch-transfers-for-invoices.ts`.

- [x] comment-noise · fixed · `src/__tests__/investment-render-parity-db.test.ts:29` · `// This is NOT
    extractFigures-vs-extractFigures` — `extractFigures` exists nowhere in the repo; the comment was
      the only hit. Phantom deleted.

- [x] comment-noise · fixed · `src/types/transfers.ts:10`, `src/__tests__/map-category-costs.test.ts:151`,
      `src/__tests__/lib/invoices/invoice-field.test.ts:48` · three comments outside the diff still
      enumerated CSV/print as live consumers. Enumerations trimmed; each comment's actual rationale kept.

- [x] comment-noise · fixed · `context/foundation/roadmap.md:509` · a **Risk** field stated as
      strikethrough-plus-correction is the prose form of a vanished-state comment. Rewritten flat.

- [x] comment-noise · fixed · `context/foundation/manual-checks.md` · one _unticked_ check was half
      struck through (a human would have had to execute a partly-crossed-out instruction), and one box
      was ticked for something that cannot be checked. Strikethrough dropped from the first, the second
      deleted — the EX-672 section already covers the absence.

- [x] comment-noise · fixed · `context/foundation/lessons.md:227` · "There it was accepted" read
      awkwardly after the tense shift → "In that case it was accepted".

- [x] comment-noise · dismissed · `src/components/transfers/invoice-download-button.tsx:27`,
      `src/types/export.ts:29` · both verified as earning their place — the audit called them the trim
      trap correctly avoided, not fallen into.

- [x] 🔵 OBSERVATION · dropped · `context/foundation/archive/shape-notes-2026-06-12-off-sheets-phase-1.md:161`
      · an archived shape-note still advertises `src/lib/export/` as a reuse target. Per the project's
      doc-lifecycle rule `archive/` is a frozen historical record, not current truth — knowingly left.

- [x] simplify · fixed · `src/components/transfers/transfer-table-config.ts:5` · `TransferQueryT`
      re-declared `{page, limit}`, which is `PaginationParamsT` (`src/lib/utils/pagination.ts:8`) —
      and the value flowing in _is_ `parsePagination()`'s return. Now `PaginationParamsT & { where }`.

- [x] simplify · fixed · `src/lib/actions/fetch-transfers-for-invoices.ts:21` · `exportWhere` →
      `invoiceWhere`; the last symbol implying a generic export surface.

- [x] simplify · fixed · `src/components/transfers/invoice-download-button.tsx:17,27` · "Job 1 of the
      export" narrated the deleted layer, and the unpaginated-fetch fact was stated twice.

- [x] simplify · fixed · `src/components/transfers/transfer-table-config.ts:21` · my own replacement
      JSDoc said "before adding a fifth call site" — already false, `manager-dashboard.tsx:33` is the
      fifth and deliberately opts out.

- [x] simplify · fixed · `src/components/ui/toggle-stat-buttons.tsx:31` · `computeSummary`'s comment
      justified a production signature by naming the parity spec. Rewritten to the intrinsic reason
      (the sum reads no styling), which is the honest one.

- [x] simplify · fixed · `src/components/ui/toggle-stat-buttons.tsx:136` · `ToggleStatButtonsPropsT`
      exported with no consumer — invisible to knip, which ignores type exports under `components/ui/**`.

- [x] simplify · fixed · `src/app/(frontend)/kasa/[id]/page.tsx:70` · `excludeColumns: []` was a no-op.

- [x] simplify · fixed · `context/foundation/lessons.md:577` · an "Applies to" still named
      `src/lib/actions/export.ts`.

- [x] simplify · skipped · `transfer-table-config.ts:16` · `showTotalAmount` is read at
      `transfer-table-server.tsx:21` but set by **zero** call sites — a pre-existing dead knob gating a
      live `fetchFilteredByType` skip branch. Deleting it changes a query path and deserves its own review.

- [x] simplify · skipped · `transfer-table-config.ts:12,14` · `totalFilteredAmount`/`listsCancelled`
      are server-derived yet share the caller's config bag, so a page can set a field the server
      overwrites. Splitting the type is a review-worthy refactor, not a gate fix.

- [x] reuse-scan · dropped · `src/components/ui/toggle-stat-buttons.tsx:11` · `StatEntryT` is
      structurally `FinancialFieldT` + styling, but expressing that would make a `components/ui`
      primitive import `types/investment-financials` — and the same component serves the
      non-financial dashboard tiles. The coupling would cost more than the duplication.

- [x] simplify · dropped · `src/lib/utils/trigger-download.ts` · fell to one consumer, but is still a
      correctly-named generic util in the right home.

- [x] simplify/reuse-scan · dismissed · `invoiceDownload` is not ceremony (`manager-dashboard.tsx:33`
      deliberately opts out) · dropping `sorting` left nothing unused across the 7 toolbar call sites ·
      zero dangling references repo-wide to any deleted path or symbol · zero orphaned dependencies
      (`jszip`/`zustand` survive elsewhere) · `trigger-download` has no twin · `invoice-zip.ts` moved
      verbatim beside its siblings.

## Simplify pass

Ran `/simplify` + `primitive-reuse-scan` — 9 applied, 0 proposed, 2 skipped, 2 dropped, 13 dismissed;
each finding folded into `## Findings` (tagged simplify / reuse-scan). 0 open.
Report: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.tWVHJMVs3L.md`

## Tests & suite

Whole-tree gate, re-run after every gate fix landed:

- `pnpm exec tsc --noEmit` — clean
- `pnpm lint` — 0 errors (79 pre-existing warnings, all in `src/migrations/`)
- `pnpm test` — 2110 passed / 102 skipped (137 files)
- `pnpm test:parity` — 3/3 passed. **This is the load-bearing one**: the golden master passing
  unchanged after the spec swapped its private copy of the balance formula for the rendered
  `computeSummary` is the proof the two were equivalent.
- `pnpm test:integration` — 99 passed (32 files)
- `pnpm build` — succeeds

**E2E: not owed.** Pure removal, and print/CSV had zero prior browser coverage — recorded in the
plan's Testing Strategy, so there is no E2E-backlog issue to file.

No new regression test authored: the fan-out produced **no correctness findings**. The one WARNING
that touched test code made an existing guard stronger rather than pinning a bug.
