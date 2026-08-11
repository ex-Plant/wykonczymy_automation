# Review-gate ledger — robocizna-from-kosztorys (EX-535) · 2026-07-19

Slice diff scope: 10 files, +870/−33 vs `13a81a1f^` (base `ba6674ed`).
Commits: `13a81a1f` (p1) · `8a00f85b` (p2) · `e4285319` (p3) · `d40be6fc` (p4).
Fan-out: `/10x-impl-review`, `/code-review`, `/tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` (all read-only);
then `/simplify` (reuse/simplification/efficiency/altitude, mutating).

## Findings

<!-- ONE checkbox per finding. severity tag = bug-finding checks only. source ∈ impl-review | code-review | comment-noise | structure-scatter | simplify. Most-severe first. -->

- [x] 🔵 OBSERVATION · dismissed · `impl-review` (F2) · `reconciliation.ts` · Recon bakes in the net-entry assumption that EX-536/EX-539 question. Not hidden — documented, tracked, and both blockers gate archive. No code owed.
- [x] 🔵 OBSERVATION · noted (Step 4) · `impl-review` (F5) · Manual Phase-2 checks not yet aggregated / some not E2E-covered → handled by the manual-verification gate (see Tests & suite). Not a code finding.
- [x] dropped · `comment-noise` · `kosztorys-podsumowanie.tsx` (5 borderline flags) · Vanished-state / duplicate-rationale nits the auditor left in place; not worth the churn.
- [x] filed EX-540 · `simplify` (efficiency) · `page.tsx:70` · `getKosztorysTree` fetched unconditionally on every investment-detail render for 2 scalars (5 queries; wasted entirely for kosztorys-less investments). Both candidate fixes carry a measurement tradeoff → deferred to EX-540.
- [x] dismissed · `simplify` (simplification) · `kosztorys-podsumowanie.tsx:98` · Proposed dropping `|| reconciliation.rabat.mismatch` from `showRabat` as redundant. Kept: it's a defensive term directly encoding "never hide a mismatch"; removing it trades an explicit guarantee for a fragile derivation on a financial-scream surface.
- [x] dropped · `simplify` (simplification) · `kosztorys-podsumowanie.tsx:182,216` · Repeated `x.mismatch ? mismatchTooltip(...) : undefined` ternary. Too minor to warrant a helper; the two sites thread a string through `RowOptsT.mismatch`, so no clean shared form.
- [x] dismissed · `simplify` (altitude F2/F3) · `kosztorys-podsumowanie.tsx:54` · `RowOptsT` color-flag overlap (`danger`/`mismatch`) and `noShareCell` vs `hideShare` are genuinely distinct, well-commented semantics — not smells.

**CLEAN (no findings):** `/tailwind-v4-audit`, `feature-first-structure`, `module-cohesion-audit`; `simplify` altitude confirmed `faceValue`/`moneyPair` split is at the right layer.

## Simplify pass

Ran `/simplify` — 1 applied (badge extraction), 1 filed (EX-540), 2 dismissed, 1 dropped; each folded into ## Findings (tagged simplify). No separate report file (inline fan-out).

## Tests & suite

- Moved `reconciliation.test.ts` → 11/11 green post-move.
- Phase-4 E2E `e2e/kosztorys-reconciliation.spec.ts` (4 tests) authored + green cold in Phase 4; badge extraction is behavior-preserving and the E2E asserts the shared aria-label on both surfaces, so it covers the /simplify change — no new test owed.
- typecheck: clean. lint: 0 errors (85 pre-existing warnings, none in touched files).
- Unit suite (`pnpm test`): 1065 passed, 40 skipped, 0 failed.
- `test:e2e` + `build`: deferred by user (cold e2e ~6min); Phase-4 cold e2e run stands as the authoritative browser pass.

## Archive gate

Archived 2026-07-26: EX-536 and EX-539 (the two domain blockers named above) are Done in Linear.
Manual verification (impl-review F5) was never recorded in `manual-checks.md` — archived anyway on
explicit user go-ahead; treat as deferred, not confirmed. EX-540 stays filed/open; EX-541 stays Done.
