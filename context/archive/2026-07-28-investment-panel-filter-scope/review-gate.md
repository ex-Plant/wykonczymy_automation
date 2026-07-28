# Review-gate ledger — investment-panel-filter-scope (EX-600) · 2026-07-28

Scope: this slice's files only. The commit range `7d69f875^..HEAD` also carries a parallel
agent's EX-430 / EX-632 work (`insert-rows`, `display-order`, `restore-rollback`,
`ex-430-harden-bulk-insert-restore/*`) — excluded from every check below.

Reviewed files:

- `src/lib/queries/transfer-filters.ts`
- `src/lib/db/sum-transfers.ts`
- `src/lib/queries/investment-transactions.ts`
- `src/app/(frontend)/inwestycje/[id]/page.tsx`
- `src/components/investments/investment-summary-panel.tsx`
- `src/components/kosztorys/summary/scope-marker.ts`
- `src/components/kosztorys/summary/summary-panel-content.tsx`
- `src/components/kosztorys/summary/grid/summary-row.tsx`
- `src/components/kosztorys/summary/tables/summary-breakdown-table.tsx`
- `src/components/kosztorys/summary/tables/summary-totals-table.tsx`
- `src/components/kosztorys/summary/blocks/brutto-netto-summary.tsx`
- `src/components/kosztorys/summary/blocks/mixed-summary.tsx`
- `src/components/kosztorys/summary/tabs/summary-overview-tab.tsx`
- `src/__tests__/lib/queries/transfer-filters.test.ts`
- `src/__tests__/lib/db/deposit-transactions-where-scope.test.ts`

Fan-out run: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit`. `tailwind-v4-audit`
returned zero findings.

## Findings

- [x] 🔵 OBSERVATION · dismissed · `code-review` · `sum-transfers.ts:311` · `getDepositTransactions`
      no longer hardcodes `investment_id`. Verified: `page.tsx:47` appends the page's investment
      **last**, so `?investment=99` cannot override it, and the share/`kosztorys_v2` path never enters
      through the filtered fetcher. Widened surface, no reachable defect.
- [x] 🔵 OBSERVATION · dropped · `code-review` · `investment-transactions.ts:74` · a caller passing a
      raw (un-stripped) `transferWhere` would hit the `cancelled != TRUE` three-valued-logic trap.
      No such caller exists and the seam has one call site; a defensive strip inside the query would
      silently rewrite a caller's intent. Noted in the comment instead.
- [x] 🔵 OBSERVATION · dropped · `code-review` · `transfer-filters.ts:212` · array-valued params
      (`?type=A&type=B`) report active while `buildTransferFilters` ignores them. Unreachable through
      the filter UI, which comma-joins into one param.
- [x] 🔵 OBSERVATION · skipped · `code-review` · `transfer-filters.ts:187` · `TRANSFER_FILTER_PARAMS`
      is hand-maintained against what `buildTransferFilters` reads, with no test pinning the pairing.
      Verified in sync today (14 keys). Deriving one from the other is a refactor of the builder, not
      a review fix.
- [x] dropped · `structure-scatter` · `investment-status-badge.tsx` / `cash-registers.tsx` ·
      `STATUS_LABELS` / `REGISTER_TYPE_LABELS` sit in component files against a 7-instance `lib/`
      convention. Pre-existing; this slice only imports one. Not worth the churn.
- [x] skipped · `module-cohesion` · `sum-transfers.ts` · 445 LOC / 10 query exports — a review-worthy
      refactor of a file this slice touched one function in.
- [x] dismissed · `feature-first-structure` · `scope-marker.ts` · flagged as a stray colocated `.ts`
      under `components/`; matches a 42-instance repo convention and has two consumers in two files,
      so it cannot live inline in either.

_The `fixed` findings were trimmed at archive — those fixes are now just the code. What stays is every finding that ended in a decision rather than an edit._

## Simplify pass

`/simplify` and `primitive-reuse-scan` are not installed in this session, so the pass was run inline
over the diff: the reuse/dedup surface the fan-out surfaced was comment duplication (fixed above) and
the two structure findings (one fixed, one dropped). No further dedup opportunity — the slice adds one
predicate, one query seam and one boolean prop, each with a single implementation.

## Tests & suite

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 errors (84 pre-existing warnings, all unused `db` args in `src/migrations/**`).
- `pnpm exec vitest run` — 1881 passed, 80 skipped (the DB-backed specs skip without
  `DB_POSTGRES_URL`; `deposit-transactions-where-scope.test.ts` runs under `pnpm test:integration`
  at the pre-push gate).
- `test:e2e` / `build` — not run; no browser-observable behaviour is asserted by an existing spec
  (EX-634 owns that) and the diff adds no build-surface change.
- Manual: signed off for the shipped Phase 2/3 behaviour. The gate's CRITICAL fix added three new
  cases to `manual-checks.md` (no-kosztorys investment, non-Podsumowanie tabs, `showCancelled`
  alone) — still unticked, and mirrored into EX-634 as spec cases 7–9.
