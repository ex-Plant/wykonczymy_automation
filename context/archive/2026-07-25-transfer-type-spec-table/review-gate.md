# Review-gate ledger — 2026-07-25-transfer-type-spec-table · 2026-07-25

Diff under review: `faecd048^..HEAD` (5 commits, 22 files).
Fan-out: `/10x-impl-review`, `/code-review`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit`.
Dropped: `tailwind-v4-audit` (no CSS/JSX in the diff), Step 0.5 verification pass
(no `verify-manual-checks` skill installed; the slice is backend-only apart from an
admin-panel field condition).

## Findings

- [x] dismissed · code-review · `src/__tests__/fixtures/financial-golden-master.json` ·
      „the fixture commits real client names next to real money" — false positive. The
      client names in a drift line („#107 Gabi Działka · balance: …") are read from the DB
      at runtime; the committed JSON is keyed by id only (`grep` for any of them: 0 hits).
      The figures themselves are real, which is the point of a golden master.
- [x] dropped · reuse-scan · `src/__tests__/transfer-spec-table.test.ts:23` · a local
      `sorted()` one-liner; centralizing a 1-line array copy-and-sort is churn, not reuse.
- [x] dismissed · module-cohesion · `src/lib/constants/transfers.ts` · „four concerns in one
      file, split it" — a review-worthy refactor, and the plan chose one home deliberately
      (decision 1): the eager-module-load constraint is exactly what a split reintroduces.
- [x] dismissed · impl-review · `isSheetTransferTabType` structural-vs-test soundness — the
      consistency test binds it to the `transfersSheetTab` column; the concern is covered.
- [x] dismissed · code-review · `transfer-spec-table.test.ts:99-110` · „the eager-load guard
      should import `sync-sheet` for real" — the spread cannot fail if its two inputs are
      non-empty, so asserting the inputs IS the guard; exporting `SHEET_SYNCED_TYPES` purely
      for a test would add API surface for nothing.

## Simplify pass

Ran the mutating pass in-thread (`/simplify` scope) plus `primitive-reuse-scan` against the
resolved primitive homes (`src/lib/utils`, `src/lib/constants`, `src/lib/db`, `src/hooks`,
`src/types`) — 1 reuse finding fixed (`round2`), 1 dropped, no reinvention of an existing
`src/lib` primitive found. Every finding is folded into `## Findings` above (tagged
`reuse-scan`); there is no second report.

## Tests & suite

- `pnpm typecheck` — green
- `pnpm lint` — 0 errors (87 pre-existing warnings, all in `src/migrations/*`)
- `pnpm test` — 93 files, 1508 passed, 53 skipped (DB-gated), 0 failed
- integration @ 5435 — all 19 discovered specs green (ran the script's own command directly;
  `bash scripts/test-integration.sh` aborts in this worktree on a `wykonczymy-test` container
  name already held by the main checkout's compose project — pre-existing, unrelated)
- `pnpm test:parity` specs — golden master + render parity green, fixture regenerated once
  for the `bilans`→`balance` / `marza`→`margin` rename (drift was exactly 200 lines, all
  key renames, 0 figures moved)
- `pnpm build` — green
- `pnpm test:e2e` — **not run**. Same container-name conflict, and the slice has no browser
  surface (its one UI effect is an admin-panel field condition disappearing).
