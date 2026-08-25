# Review-gate ledger — cancellation-sum-overcount (EX-574) · 2026-07-28

Reviewed diff: `739788ac..HEAD` — `dc2bf98b`, `5ed00e78`, `27444def`, `3ccb4c88`.

Source files in scope:

- `src/lib/queries/transfer-filters.ts`
- `src/lib/db/where-to-sql.ts`
- `src/components/transfers/transfer-filters.tsx`
- `src/__tests__/lib/queries/transfer-filters.test.ts` (new)

Guard: the working tree carries a **parallel session's** uncommitted preview-mode work
(`preview-policy.ts`, share pages, summary panel, `playground/`). None of it overlaps this slice's
files — `/simplify` must not touch it.

Step 0.5 (browser verification pass) skipped: manual checks are non-blocking for Done as of
2026-07-28; they remain unticked in `context/foundation/manual-checks.md:641-657` and are surfaced at
Step 4.

## Findings

The gate closed 27 findings — 19 fixed, 5 dismissed, 2 dropped, 1 skipped, 0 open. The 19 `fixed`
ones were trimmed at archive: the fix is now just the code. Read them at `4aad203c`, or in the four
commits that carry them (`1bbc2cff`, `fd51e1d9`, `059de80c`, plus `dc2bf98b`…`27444def`). What
survives below is the decisions — the findings nobody acted on, and why.

- [x] skipped · `feature-first` · `src/__tests__/build-transfer-filters.test.ts` +
      `transactions-report-filters.test.ts` · Same source (`lib/queries/transfer-filters.ts`), two
      spec homes — the new mirrored one and the grandfathered top level. AGENTS.md explicitly
      grandfathers the top level, and `scripts/test-integration.sh` discovers specs by grepping the
      tree, so a blind move risks discovery. The slice added to the correct home; draining the tail
      is its own commit.
- [x] dropped · `code-review` · `src/components/transfers/transfer-filters.tsx:226` · The tooltip is
      gated behind `hasAnyFilter`, which excludes `showCancelled`/`cancelledTransactionAudit`, so in
      bare audit mode no tile renders at all. No tile means no misleading number — benign.
- [x] dropped · `code-review` · `src/components/transfers/transfer-filters.tsx:231` · Radix
      suppresses the focus-open on touch, so the note is hover-only on phones. App-wide
      `InfoTooltip` pattern, not this diff's defect.
- [x] dismissed · `impl-review` (F8) · `src/lib/db/where-to-sql.ts:72` · `like` passes `%`/`_`
      unescaped, but its sole producer is `normalizeAmountSearch`'s prefix mode behind `^\d+$`. Not
      reachable, and the inline comment already states the pre-validation contract.
- [x] dismissed · `impl-review` (F9) · Linear EX-574 · Sits at In Progress / `in review` while the
      plan says „→ Done". That is this project's convention — Done comes after the gate.
- [x] dismissed · `tailwind-v4-audit` · `src/components/transfers/transfer-filters.tsx` · Clean —
      the diff adds logic and a string prop, no styling, no responsive prefixes.
- [x] dismissed · `module-cohesion` + `structure-scatter` · Clean. The slice improved cohesion twice
      (the `OPERATORS` table, the collapsed `stripCancelledFilters`) and invented no new home.
- [x] dismissed · `simplify` (efficiency) · Clean — no new I/O, no added sequential awaits, no
      closure-captured long-lived objects. The one perf-shaped change is a wash: `renderField`
      allocates one fewer object per field than the wrap/unwrap it replaced.

## Simplify pass

Ran `/simplify` — 5 applied, 0 proposed, 1 dismissed; every finding folded into `## Findings`
above (tagged `simplify`). Both cleanup agents converged independently on the un-applied helper
extraction as the must-fix. No separate report file: the ledger is the record.

Scope guard held — nothing outside the slice's own files was touched, so the parallel session's
uncommitted preview-mode work is untouched.

## Tests & suite

- `pnpm typecheck` — clean.
- `pnpm test` — **1874 passed**, 70 skipped (139 files). The skips are the DB-backed specs that need
  the 5435 container; they run under `pnpm test:integration` on the pre-push hook.
- `pnpm lint` — **0 errors**, 86 warnings, all pre-existing `no-unused-vars` on the `db` arg in
  `src/migrations/*`. None in this slice's files.
- `pnpm build` — clean.
- `pnpm test:e2e` — **not run.** E2E is non-blocking for Done as of 2026-07-28, and this slice's
  browser coverage is already filed as **EX-627** (`e2e-backlog`).

New/changed specs this gate: `lib/db/where-to-sql.test.ts` (new, 20 cases),
`lib/queries/transfer-filters.test.ts` (10 cases), `sum-transfers.test.ts` (28), all green.
