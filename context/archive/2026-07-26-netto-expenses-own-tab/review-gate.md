# Review-gate ledger — netto-expenses-own-tab · 2026-07-26

Diff under review: `d638f984^..HEAD` (12 files at dispatch time). Step 0.5 (browser verification)
skipped — it needs the 5435 stack plus a seeded kosztorys; its checks are registered in
`context/foundation/manual-checks.md` § EX-581 and remain the archive blocker.

Fan-out (7 read-only checks, all in parallel): `/10x-impl-review`, `/code-review`,
`tailwind-v4-audit`, `feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`,
`comment-noise-audit` (flag-only). `primitive-reuse-scan` died on an API session limit on its first
dispatch and was **re-run after the merge to staging**; its five findings are folded in below.
That run also wrote `.reuse-scan.json` at the repo root — the primitive-homes map (`components/ui`,
`hooks`, `lib/**`, `types`), so the next scan reads the layout instead of re-deriving it.

Two things moved under the gate and are folded in rather than reviewed separately:

- The owner committed `79669e58` (plain „Kwota" headers, bold „Razem") and `da5d5ef2` on this branch
  after the fan-out snapshot. Both preserved; `change.md` now records the label ruling.
- The owner asked mid-gate for the netto tab to show **two amount columns** („Brutto" then „Netto")
  instead of one cell stacking both figures. Implemented; supersedes plan.md:56 and :137-139 and
  removed the taller netto row height that arrangement needed.

## Findings

The 10 `fixed` findings were trimmed at archive time — the fix is now just the code. What remains is
the set that records a _decision_ rather than an edit.

- [x] dismissed · reuse-scan · `src/lib/utils/investment-transfers-href.ts:15` · **not** a duplicate
      of `src/lib/utils/build-url-with-params.ts:5` — contracts verified against the source: that
      helper needs a `currentParams` string to merge overrides into (empty value deletes the key) and
      returns `URLSearchParams.toString()`, which percent-escapes the multi-type comma as
      `type=A%2CB`. Routing through it would rewrite the existing deposit links; that load-bearing
      difference is the one the new spec's `not.toContain('%2C')` assertion pins.
- [x] dismissed · reuse-scan · `src/lib/kosztorys/wydatki-datasets.ts:45` · `sumBilled` reinvents
      nothing: the repo ships no generic `sum`/`sumBy`, and its idiom is a field-specific inline
      reduce (15+ sites — `settlement.ts:97`, `summary-economics.ts:200`,
      `subcontractor-summary.ts:28`, …). This one is named only because a spec asserts its Σ invariant.
- [x] dismissed · reuse-scan · `src/lib/kosztorys/wydatki-datasets.ts:16` · `partitionWydatkiRows` vs
      `bucketDepositsByPlane` (`summary-economics.ts:193`) · both one-pass classifiers, but different
      contracts — that returns two sums keyed by VAT plane, this returns three row lists. No shared
      form to extract.
- [x] dropped · reuse-scan · `src/components/kosztorys/summary/blocks/subcontractor-summary.tsx:89` ·
      a fourth right-aligned `formatNet` cell, but `text-chart-green` and a lone occurrence — there is
      no duplication left to remove there.
- [x] 🟡 → dismissed · `src/lib/queries/reference-data.ts:310` · `type: doc.type` assigns from
      `Record<string, any>` with no coercion, unlike every sibling field. Benign: the query's own
      `where.type: { in: EXPENSES_TAB_TYPES }` makes an out-of-union value unreachable. The real hole
      was _absence_, which narrowing cannot fix — closed instead by declaring `type` as
      `TransferTypeT | undefined` in `src/types/reference-data.ts`.
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
agent must not touch those. Every fix above was applied directly — 10 fixed, 9 dismissed, 2 skipped,
4 dropped, 1 filed · 0 open.

## Tests & suite

- `pnpm exec tsc --noEmit` → clean
- `pnpm exec eslint` on the 6 touched source files → clean
- `pnpm exec vitest run` → **1664 passed, 57 skipped, 0 failed** (96 files passed, 22 skipped);
  +4 from the new href spec, net of the 5 specs relocated
- `test:e2e` not run — this slice adds no browser-level spec (see the skipped 3.4 finding)
- After the reuse-scan fix: `tsc --noEmit` clean, `eslint` on the touched component clean, and the
  three specs covering it → **274 passed**
