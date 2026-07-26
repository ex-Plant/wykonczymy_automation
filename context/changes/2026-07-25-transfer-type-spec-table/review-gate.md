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
- [x] 🔴 CRITICAL · fixed · code-review · `src/hooks/transfers/validate.ts:39-48` · a
      CANCELLATION took the blanket early return, so the auto-clear never ran and a REST /
      Local-API write could persist `source_register_id`. `sumRegisterBalance` has no
      CANCELLATION arm — the row lands in `ELSE -amount` and drains that register forever.
      The app's own cancellation path (`lib/actions/transfers.ts:193-207`) never sets it, so
      this is defence, not repair.
      test: test-driven-debugging · unit — red repro (`expected 3 to be null`) first, now green
- [x] 🟡 WARNING · fixed · code-review · `scripts/test-integration.sh` · the golden master
      was discoverable by the pre-push gate, where ten neighbouring specs create investments
      in the same shared 5435 DB. One leaked row makes it fail „dataset changed — regenerate",
      and following that advice would rebaseline against contaminated data and destroy the
      net. Excluded from discovery; it runs under `pnpm test:parity`. Softened from the
      review's wording after checking: the neighbours do clean up today, so the exposure is
      an *aborted* run leaving rows behind — defence, not a demonstrated failure.
      test: no automated test — the guard is the exclusion itself; 19 specs still discovered, all green
- [x] 🟡 WARNING · fixed · code-review · `src/__tests__/financial-golden-master-db.test.ts` ·
      `UPDATE_GOLDEN=1` against a half-restored container would silently overwrite the only
      record of the pre-refactor figures. Added `DATASET_FLOOR` + `assertNonTrivial()` as a
      precondition on the regenerate path (and as the sanity test).
      test: no automated test — the assertion IS the guard
- [x] 🟡 WARNING · fixed · impl-review · `src/__tests__/transfer-constants.test.ts:127` ·
      `expect(Object.keys(HELPERS)).toHaveLength(15)` is tautological against a hand-typed
      map — it stayed green while `financialBucketOf` shipped untested. Now derived from the
      module namespace, with one named+justified exclusion.
- [x] fixed · code-review · `src/lib/constants/transfers.ts:59` · bucket value `'rabat'`
      violated glossary rule 2 (a generic figure is English) → `'discount'`. `totalRabat`
      itself is pre-existing drift, out of this slice (EX-548 owns it).
- [x] fixed · impl-review · `plan.md:161,237,276`, `plan-brief.md:23`,
      `transfer-constants.test.ts:150` · „all 32 register balances" was wrong — the fixture
      carries 29 registers, plus a 36-worker axis nothing documented. Both corrected.
- [x] fixed · comment-noise · `src/lib/constants/transfers.ts:311-315` · vanished-state
      comment („These lived in transfer-rules.ts … so they moved back"). Deleted; the
      load-bearing half (every value here must stay eager) is kept and restated — the barrel
      re-export caused the cycle, not the split, so a second home buys nothing.
- [x] fixed · comment-noise · `src/hooks/transfers/validate.ts` · 8 restatement comments
      deleted, incl. `:67` which was factually stale (listed the types needing an investment
      and had never been updated for RABAT).
- [x] fixed · comment-noise · `src/__tests__/transfer-constants.test.ts:161` · „documents the
      agreement; it does not assert it must hold" was false — it *is* an assertion, and the
      one that goes red when INVESTMENT_EXPENSE_NET arrives. Reworded to say so.
- [x] fixed · impl-review · `change.md:30` · stale `TRANSFER_SPECS` name → `TRANSFER_TYPE_SPECS`.
- [x] fixed · impl-review · `change.md:3` · `status: planned` while all 13 plan boxes were
      checked → `implemented`.
- [x] fixed · structure-scatter · `AGENTS.md` · the „specs live under `src/__tests__`, never
      colocated" rule was unwritten, so it read as a feature-first violation to every reviewer.
      Stated, with the reason (`test-integration.sh` discovers by grepping that tree), the
      mirror-the-source-path convention, and the golden master's deliberate exclusion.
      (The reviewer's „flat" framing was wrong — `src/__tests__/lib/db/…` already mirrors.)
- [x] fixed · reuse-scan · `src/__tests__/financial-golden-master-db.test.ts:38` ·
      `round2` was copy-pasted from `investment-render-parity-db.test.ts:29`. Two suites
      comparing the same money with two private rounding helpers can disagree about whether
      a figure moved. Extracted to `src/__tests__/helpers/money.ts`, both now import it.
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
