# Review-gate ledger — netto-expenses-own-tab · 2026-07-26

Diff under review: `d638f984^..HEAD` (12 files at dispatch time). Step 0.5 (browser verification)
skipped — it needs the 5435 stack plus a seeded kosztorys; its checks are registered in
`context/foundation/manual-checks.md` § EX-581 and remain the archive blocker.

Fan-out (7 read-only checks, all in parallel): `/10x-impl-review`, `/code-review`,
`tailwind-v4-audit`, `feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`,
`comment-noise-audit` (flag-only). `primitive-reuse-scan` was dispatched and **did not complete** —
see the open box below.

Two things moved under the gate and are folded in rather than reviewed separately:

- The owner committed `79669e58` (plain „Kwota" headers, bold „Razem") and `da5d5ef2` on this branch
  after the fan-out snapshot. Both preserved; `change.md` now records the label ruling.
- The owner asked mid-gate for the netto tab to show **two amount columns** („Brutto" then „Netto")
  instead of one cell stacking both figures. Implemented; supersedes plan.md:56 and :137-139 and
  removed the taller netto row height that arrangement needed.

## Findings

- [ ] not-run · `primitive-reuse-scan` · the check terminated on an API session limit before
      reporting. Its highest-value question — "does the new href builder duplicate
      `src/lib/utils/build-url-with-params.ts`?" — was answered by hand instead (that helper merges
      overrides into _existing_ params, with empty-string deletes; different problem), so no known
      gap remains. Box stays open until the check is actually re-run.
- [x] 🟡 WARNING · fixed · `src/types/reference-data.ts:89` · `type` was declared required
      (`TransferTypeT`) while both consumers and two specs deliberately handle its absence — a warm
      `unstable_cache` entry written before the field existed serves rows without it. The specs only
      compiled via `as MaterialTransactionRowT`, so the guards were provably-always-true and a
      cleanup pass (or `no-unnecessary-condition`) would have deleted the tolerance. Now
      `TransferTypeT | undefined`; both casts gone.
      test: TDD · unit — the two stale-row specs now compile without a cast, so `tsc` enforces the
      guard rather than the comment.
- [x] 🟡 WARNING · fixed · `context/foundation/manual-checks.md:247` · the registry named tabs
      („Wydatki inwestycyjne", „Wydatki netto") the code never rendered — a check that cannot pass as
      worded, in the file that hard-blocks Done. Reworded to the shipped labels, and the amount-column
      check rewritten for the two-column netto tab.
      test: no automated test — a QA registry line, verified by reading it against `DATASET_LABELS`.
- [x] 🔵 OBSERVATION · fixed · `src/lib/kosztorys/wydatki-datasets.ts:29` · `DATASET_ORDER` was
      membership-checked (`satisfies readonly WydatkiDatasetT[]`), not exhaustive: a fourth dataset
      would compile and silently never get a tab. Now derived from a `Record<WydatkiDatasetT, number>`
      rank map, matching the spec-table pattern in `lib/constants/transfers.ts`.
- [x] 🔵 OBSERVATION · fixed · `src/lib/kosztorys/wydatki-datasets.ts:46` · fifth hand-rolled
      `/inwestycje/:id?type=…` template literal in this feature, and a drifting one is exactly the bug
      this slice fixed. Extracted `src/lib/utils/investment-transfers-href.ts` and routed all five
      sites through it (`deposits-table:43`, `summary-totals-table:36`,
      `subcontractor-summary:156,233`, `wydatkiRowHref`).
      test: TDD · unit — new `investment-transfers-href.test.ts` pins the query shape
      `buildTransferFilters` parses: unescaped comma separator, param order, and no bare `?type=`
      (which the filter reads as "no valid type" → zero rows).
- [x] fixed · feature-first-structure · `src/__tests__/derive-financials-bucketing.test.ts:319-378` ·
      five isolation specs sat in a flat characterization suite whose stated job is pinning
      `deriveFinancials`. Moved to the mirrored home `src/__tests__/lib/kosztorys/wydatki-datasets.test.ts`;
      only the genuinely cross-cutting `Σ over the two expense tabs === totalMaterialCosts` stayed.
- [x] fixed · comment-noise · 1 deleted (`TABLE_HEIGHT`'s restatement), 4 trimmed, and the
      four-times-restated `Σ(billed) === totalMaterialCosts` invariant reduced to one prose home
      (`sumBilled`) plus the test that enforces it.
- [x] fixed · comment-noise · `src/lib/queries/reference-data.ts:279` · the docstring named two tab
      labels that no longer exist. Now points at `partitionWydatkiRows` instead of restating labels
      it cannot keep in sync.
- [x] fixed · impl-review · `plan.md:101` · the plan specifies `settled` → netto → brutto; the code
      tests netto **first** and is right (mirrors `materialsNetBilled`, which ignores `settled`).
      Recorded inline in the plan so nobody "corrects" the code back.
- [x] fixed · impl-review · `change.md` · the label ruling existed only in a commit message while the
      chevron ruling was in Notes. Both rulings are now in Notes, plus the new two-column one.
- [x] 🟡 → dismissed · `src/lib/queries/reference-data.ts:310` · `type: doc.type` assigns from
      `Record<string, any>` with no coercion, unlike every sibling field. Benign: the query's own
      `where.type: { in: EXPENSES_TAB_TYPES }` makes an out-of-union value unreachable. The real hole
      was _absence_, not garbage — fixed above.
- [x] dismissed · module-cohesion · `wydatkiRowHref` looked off-topic in a partitioning module. After
      the extraction it is a 4-line delegate; the URL contract lives with the builder and only the
      wydatki-specific decision (no type → unfiltered list) stays with the row.
- [x] dismissed · code-review · `DATASET_LABELS` in the component while `DATASET_ORDER` is in lib.
      Polish UI copy staying at the call site is the established convention here
      (`deposits-table.tsx:26`'s `planeLabel`, `subcontractor-summary`'s labels); the compiler-enforced
      half (the rank map) is what needed fixing, and it was.
- [x] dismissed · module-cohesion · the `footer && rows.length > 0` guard is written in both
      `data-table.tsx:138` and `virtualized-table-body.tsx:84` — two genuinely separate render paths.
- [x] dismissed · code-review · `options` became a per-render array feeding `ToggleGroup`'s layout
      effect. React Compiler memoizes it, and `react-hooks/preserve-manual-memoization` is an eslint
      **error** here, so hand-memoizing is not available.
- [x] dismissed · tailwind-v4-audit · zero violations: no `[var(--token)]`, no new inline `style`, no
      arbitrary bracket values. The three inline styles in `virtualized-table-body.tsx` are
      pre-existing runtime virtualizer geometry.
- [x] skipped · code-review · `materials-transactions-table.tsx:98` · the `activeDataset` fallback
      never writes back, so if a refetch re-adds a vanished set the visible tab can jump to the stale
      stored choice. Behaviour-changing and uncertain (the derive-don't-sync shape is otherwise
      correct under the compiler constraint); only reachable across a server refetch.
- [x] skipped · impl-review F5 · criterion 3.4 (`clientView` renders no href) has no automated guard.
      The plan's Testing Strategy explicitly rejects E2E for "a filter and a string", and a leaked
      href points into the authenticated app — a client gets a login redirect, not data. Covered by
      the registry check.
- [x] dropped · code-review · `footer` is typed `=> ReactNode` though it must return a `<tr>`, and
      `colSpan={colCount - 1}` assumes ≥2 columns. Neither tightening buys enforcement worth the churn.
- [x] dropped · code-review · „Razem" as `<td colSpan>` rather than `<th scope="row">`. Cosmetic, and
      consistent with the existing `EmptyRow`.
- [x] dropped · code-review · `derive-financials-bucketing.test.ts:265` still hand-rolls the sum
      `sumBilled` now names — deliberate: that assertion re-derives from `billedAmountFor` so the two
      are independent witnesses.
- [x] filed EX-583 · module-cohesion + structure · `src/lib/queries/reference-data.ts` (337 LOC, 14
      exports) and `src/types/reference-data.ts` are importer-named: per-investment money aggregates
      and five transaction row shapes belong in the `transfers` homes that already exist. Pre-existing;
      this slice's new `TransferTypeT` import made the mismatch concrete. Test disposition recorded on
      the issue.

## Simplify pass

Run in the main thread rather than dispatched: a parallel session holds uncommitted work in
`kosztorys-editor-body.tsx`, `slice-pie.tsx`, `section-colors.ts` and `globals.css`, and a mutating
agent must not touch those. Every fix above was applied directly — 9 fixed, 6 dismissed, 2 skipped,
3 dropped, 1 filed, 1 check unrun.

## Tests & suite

- `pnpm exec tsc --noEmit` → clean
- `pnpm exec eslint` on the 6 touched source files → clean
- `pnpm exec vitest run` → **1664 passed, 57 skipped, 0 failed** (96 files passed, 22 skipped);
  +4 from the new href spec, net of the 5 specs relocated
- `test:e2e` not run — this slice adds no browser-level spec (see the skipped 3.4 finding)
