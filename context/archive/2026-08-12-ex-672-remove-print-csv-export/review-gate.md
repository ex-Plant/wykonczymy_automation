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

_Fixed findings (16) trimmed on archive 2026-08-12 — the fixes are now just the code. What remains
are the decisions: what was consciously not done, and why._

- [x] 🔵 OBSERVATION · fixed (comment half) / skipped (behavior half) · `raporty/page.tsx:82` · the
      new `invoiceDownload` JSDoc told callers to set the flag "only where the table's own filter is
      a meaningful invoice scope", yet `/raporty` passes an unanchored `where`. **Pre-existing
      behavior** — the old toolbar carried the same button there — so gating the button would change
      what a user may do and is not a review-gate auto-apply. Rewrote the doc to describe what the
      flag _does_ and to name `/raporty` as the deliberate global case.

- [x] 🔵 OBSERVATION · dismissed · `src/types/export.ts:4` · `HeaderFieldT` lost its `export` (knip
      flagged the keyword once the four pages stopped importing it; the plan's ban was on deleting
      the _type_, not the keyword). Moot — the file was dissolved entirely.

- [x] comment-noise · dismissed · `src/components/transfers/invoice-download-button.tsx:27`,
      `src/types/export.ts:29` · both verified as earning their place — the audit called them the trim
      trap correctly avoided, not fallen into.

- [x] 🔵 OBSERVATION · dropped · `context/foundation/archive/shape-notes-2026-06-12-off-sheets-phase-1.md:161`
      · an archived shape-note still advertises `src/lib/export/` as a reuse target. Per the project's
      doc-lifecycle rule `archive/` is a frozen historical record, not current truth — knowingly left.

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
