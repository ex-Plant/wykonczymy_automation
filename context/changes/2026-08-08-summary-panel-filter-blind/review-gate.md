# Review-gate ledger — summary-panel-filter-blind · 2026-08-08

Base: `staging` · Branch: `summary-panel-filter-blind` · Commits: `956f09d6`, `5bc89a25`, `cbdabcbe`, `e592c370`

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit`, `primitive-reuse-scan`.
No `verify-manual-checks` skill installed → Step 0.5 skipped.

## Findings

- [x] 🟡 WARNING · fixed · `impl-review` + `code-review` + `feature-first` · `src/lib/queries/investment-transactions.ts:74` · `fetchFilteredDepositTransactions` lost its only caller in Phase 1 and survived — an exported unbounded-`Where` deposit read with zero call sites, plus a doc comment on its sibling still routing readers to it. Deleted the function, rewrote the comment, dropped the now-unused `Where` / `getDepositTransactions` imports. Phase 3's own rationale covered it; the plan just never named it, and typecheck can't flag an unused export.
      test: no automated test · n/a — dead-code removal, gated on `tsc` per the repo's dead-code rule (grep confirmed zero callers first, typecheck confirmed the deletion).

- [x] 🟡 WARNING · skipped · `code-review` · `src/app/(frontend)/inwestycje/[id]/page.tsx:50` + `src/components/investments/investment-summary-panel.tsx:44` · Four aggregate round trips where two used to suffice — the page still fetches on `statsWhere`, the panel now fetches on `investmentWhere`, and the two can **never** share an `unstable_cache` entry even with zero URL filters (`buildTransferFilters` unconditionally emits `type: { not_in: ['CANCELLATION'] }`, so the key strings differ always). This is the cost the change deliberately bought: the page's `financials` still feeds `headerFields` and `TransfersSection.totalPayouts`, so neither fetch can be dropped. Fixing it means canonicalizing the `Where` before stringifying the cache key — a change to a shared cache primitive, out of this slice's scope.
      test: no automated test · n/a — a cost, not a defect; no behavior to guard.

- [x] 🔵 OBSERVATION · dismissed · `code-review` + `impl-review` · `src/components/investments/investment-summary-panel.tsx:44` · The panel's bare `Where` carries no `type` condition, so it drops the `not_in: ['CANCELLATION']` guard that `stripCancelledFilters`' doc block names as EX-574's protection. Traced and benign: `TRANSFER_TYPE_SPECS.CANCELLATION.financialBucket === 'none'`, so `sumBucket` in `deriveFinancials` never matches it and `deriveCategoryBreakdowns` filters to material buckets first. Reversed amounts land in no figure. Pre-existing shape — `kosztorys_v2/page.tsx:29` and `preview-kosztorys.ts:38` build the identical bare `Where`; the panel joins the pattern rather than inventing it.
      test: no automated test · n/a — no defect; the guard that matters is the spec table, already covered by the transfers unit specs.

- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/app/(frontend)/inwestycje/[id]/page.tsx:73` · Under an active filter the CSV/print export header (`headerFields`) reports filtered Robocizna/Wpłaty/Rabat while the panel above reports unfiltered ones, under identical labels. Benign and correct: the export emits the **filtered row set**, so a filtered header is internally consistent with what it heads. The panel answers a different question and says so.
      test: no automated test · n/a — verified-correct existing behavior.

- [x] 🔵 OBSERVATION · dismissed · `structure-scatter` · `src/components/investments/investment-summary-panel.tsx:57` vs `src/app/(frontend)/inwestycje/[id]/page.tsx:64` · The panel derives with `tree.materialsNetRate` / `tree.settlementMode`, the page with `investment.*` — two sources on one page. Same DB columns (`kosztorys.ts:75-76` and `reference-data.ts:112-113` both read `settlement_mode` / `materials_net_rate`), so no figure moves. The panel matches the kosztorys-plane precedent set by `kosztorys_v2/page.tsx:79`.
      test: no automated test · n/a — same column, no divergence possible.

- [x] filed EX-652 · `reuse-scan` + `feature-first` + `structure-scatter` · `src/components/investments/investment-summary-panel.tsx:43-58,86-90` · The `investmentWhere` + two fetches + `deriveFinancials` + `buildMaterialyBreakdown` block is now hand-assembled at three whole-investment sites (panel, `kosztorys_v2/page.tsx`, `preview-kosztorys.ts`), which already disagree — preview calls `deriveFinancials` with two args, so its client-share reading computes `materialsNetDiscount = 0`. **Not fixed here** because the obvious extraction serializes: the panel sources `materialsNetRate` / `settlementMode` from `getKosztorysTree`, which sits in the _same_ `Promise.all` as the two aggregates, so a fetch-and-derive helper can only run after the tree resolves — turning one parallel round of four queries into two serial rounds behind the page's long-pole query. Perf-changing + design-uncertain → its own review.

- [x] fixed · `comment-noise` · `src/components/kosztorys/summary/grid/summary-row.tsx:46` · Comment described a hover-only tooltip icon the JSX no longer has — vanished-state left behind by two successive refactors (the hint rework, then this change's `<sup>*</sup>` removal from the same block). Deleted; the remainder was narration of the two lines under it.

- [x] fixed · `comment-noise` · `src/components/kosztorys/summary/grid/summary-row.tsx:39` · `emphasize keeps the summary rows bold now that the shared gridlines…` — vanished-state "now that", and `emphasize → 'medium'` sits one line below. Trimmed to the `share` sentence, which does earn its place (explains an unrendered field).

- [x] fixed · `comment-noise` · `src/components/kosztorys/summary/tables/summary-totals-table.tsx:11` · `, now that Rabat sits with the Robocizna it reduces` — history tail. Rewritten to state the current invariant without the "used to be".

- [x] fixed · `comment-noise` · `src/components/kosztorys/summary/summary-panel-content.tsx:221` · `it used to live here, and growing it squeezed…` — vanished-state. Trimmed to the constraint that still binds.

- [x] fixed · `comment-noise` · `src/components/kosztorys/summary/summary-panel-content.tsx:235` · Last two sentences were a verbatim duplicate of the prop doc at `:76`. Cut; the `preview`-gate + collapsed-by-default rationale kept.

- [x] fixed · `comment-noise` + `impl-review` · `src/components/investments/investment-summary-panel.tsx:34` · Said "both fetches" when the change made it four, and its tail duplicated `page.tsx:113`. Rewritten.

- [x] dropped · `comment-noise` · `src/lib/queries/transfer-filters.ts:83,91,101,111,125,135,149,170` · Nine label comments that restate the block under them (`// Date range`, `// Other category filter`, …). Real STRIP-TEST violations, but all pre-existing and outside every changed hunk — the diff only deleted `hasActiveTransferFilters`. Fixing them would balloon a filter-blindness diff with unrelated churn for zero behavior.

- [x] dismissed · `comment-noise` · `src/components/kosztorys/summary/blocks/mixed-summary.tsx:66` · Flagged as possibly inaccurate ("the one deduction step left" with allegedly two deduction rows). Read the block: it has exactly one deduction row (`Wpłaty netto`, `axis="net"` throughout). Comment is correct.

- [x] dropped · `impl-review` · `context/changes/2026-08-08-summary-panel-filter-blind/plan.md:124` · Criterion 1.1's grep wording reads stricter than the plan's own "leave `statsWhere` alone" instruction. Cosmetic wording in a plan that is about to be archived as history — not worth an edit.

- [x] filed EX-634 · `impl-review` + gate Step 3 · E2E owed by this browser-level slice. EX-634 already existed but described EX-600's now-deleted two-plane behavior; **rewritten** to spec the replacement: filter-blindness of every panel figure, absence of scope markers, Wpłaty parity with `kosztorys_v2` under a filter, and both verdicts rendering under a filter while `preview` still suppresses them.
      test: e2e — deferred with its spec into EX-634 (label `e2e-backlog`).

- [x] dismissed · `tailwind-v4-audit` · 0 findings across all 9 touched components — no `var()`-in-brackets, no inline `style`, no arbitrary values. The only responsive utility in scope (`lg:flex-row`) is untouched context and consistent across all four summary tabs.

- [x] dismissed · `module-cohesion-audit` · 0 splits. `investment-summary-panel.tsx` is a data-loading container that delegates every derivation to `lib/` — one reason to change, not a grab-bag. `transfer-filters.ts` got _more_ cohesive: the two deleted exports were its only off-topic pair.

## Simplify pass

Ran the mutating pass in the main thread (`/simplify` is a built-in command, not invocable as a skill)
plus `primitive-reuse-scan` — **7 applied, 1 filed (EX-652), 2 dropped, 5 dismissed**; every finding
folded into `## Findings` above. No separate report file.

## Tests & suite

- `pnpm typecheck` — pass
- `pnpm lint` — pass (0 errors; pre-existing warnings only)
- `pnpm test` — pass
- `pnpm build` — pass
- `pnpm test:e2e` — not run; this slice's browser coverage is filed as EX-634
