# Review-gate ledger — kosztorys-bridge (branch-wide) · 2026-07-19

Branch-wide gate on everything on `kosztorys-bridge` since it forked from `staging`
(merge-base `4a592961`). Scope: **81 files, +5524/−167** — bundles 5 change folders:

| change folder                               | prior gate                                                                             | notes                                                                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `kosztorys-bridge` (EX-530)                 | ✅ per-slice `review-gate.md` + owner-signed manual checks (registry L702, 2026-07-18) | P1–P5: Podsumowanie R/M, etap axis, komentarz col, zaliczki etap-tag, R+M footer; **real migration** `kosztorys_stage` on transactions |
| `robocizna-from-kosztorys` (EX-535/541/542) | ✅ per-slice `review-gate.md` (P1–P4)                                                  | recon indicator; EX-541 (client-view gate) + EX-542 (Suspense) landed AFTER that ledger — re-covered here                              |
| `kosztorys-summary-charts`                  | ❌ no gate                                                                             | Materiały breakdown + Podsumowanie pie charts                                                                                          |
| `investment-recon-suspense` (EX-542)        | ❌ no gate                                                                             | Suspense extraction (structural review done in-session)                                                                                |
| `kosztorys-client-share` (S-11)             | n/a                                                                                    | docs only, no code (deferred)                                                                                                          |

Plus: loose `feat(kosztorys)` grid-polish commits, 2 parallel-agent fixes
(`53fe1a6d` transfers clear-investment, `13a6d0c7` expense-form loop), temp seed scripts (EX-534).

Fan-out (read-only, parallel): 3× `/code-review` (transfers-plane / kosztorys-lib / editor-UI),
2× `/10x-impl-review` (kosztorys-bridge, robocizna plans), `/tailwind-v4-audit`,
`feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit` (diff-scoped),
`comment-noise-audit` (flag-only). Then `/simplify` + `primitive-reuse-scan` (mutating), tests,
manual checks.

**Trimmed at archive (2026-08-10).** The 7 `fixed` findings were removed: each one's durable record
is its commit, and a ledger line describing a change is strictly worse evidence than the change. What
survives is the negative space git cannot hold — what a reviewer looked at and chose **not** to act
on, and why — plus the one finding that was deferred and filed, since a filing leaves no commit.
Moved here from the `.review-gate/` fallback path, which had no lifecycle of its own. The
"**Do NOT archive**" note below was a standing directive about the _slice_, not this ledger.

Final tally before the trim: **7 fixed, 9 dismissed, 3 dropped, 2 skipped, 1 deferred+filed, 0 open.**

## Findings

- [x] deferred+filed · `code-review` · `src/lib/actions/transfers.ts` (`updateTransferAction`) · changing a deposit's `investment` can leave an orphaned `kosztorysStage` pointing at the old investment's etap — the create path validates stage↔investment membership but the update path doesn't re-check on investment change. Real but out-of-scope for this gate (behavior-changing on the update path). Filed **EX-543** (Low/Bug).
      test: test-driven-debugging · unit/integration — the stage↔investment re-validation guard is recorded in EX-543 and travels with the fix.
- [x] skipped · `module-cohesion` · `src/components/kosztorys/use-kosztorys-editor.ts` · the hook is a large cohesive stateful unit (EX-515 already split v2-rows/columns/constants out); extracting `stageQtyTotals`/`remainingTotals` deserves its own review + test harness, not an in-gate edit. Tracked under the deferred EX-515 hook split.
- [x] skipped · `simplify` · `kosztorys_v2/page.tsx` threads `investmentRobocizna`/`investmentRabat` through 6 hops to the editor body · consistent (the v2 page's fetch is also investment-wide, so no correctness issue); mirroring the investment page (compute recon in the editor's own async boundary) is a larger refactor deserving its own review.
- [x] dismissed · `tailwind-v4-audit` · `kosztorys-totals-panel.tsx:74` · `size-4 shrink-0` on the chevron is **load-bearing** — `size-4` overrides lucide's default 24px, `shrink-0` guards it in the baseline-flex trigger. Not redundant.
- [x] dismissed · `tailwind-v4-audit` · `kosztorys-totals-panel.tsx:69` · raw `rgba()` in the `shadow-[…]` arbitrary value — the audit's own carve-out: one-off elevation shadow, no recurring token warranted.
- [x] dismissed · `comment-noise` · money-axis / settlement / reconciliation FLAGGED comments (4 sites) · re-read each: all carry domain/why (sheet-name mapping, EX-535 rationale, net↔net invariant) — not restatement. Kept.
- [x] dismissed · `code-review` · `src/__tests__/lib/kosztorys/reconciliation.test.ts:124` · the `vatRate 0` test is weak (recon is net↔net, so vat can't affect it) but is cheap documentation of the net-only invariant. Kept, not churned.
- [x] dismissed · `impl-review` · robocizna plan Phase 5 shows unstarted-at-HEAD · Phase 5 (retire `LABOR_COST`) is intentionally parked behind the domain blockers EX-536/EX-539, not a drift.
- [x] dismissed · `simplify` · `investment-recon-block.tsx:41` · fetches the full type distribution + `deriveFinancials` to read two scalars. Reusing `deriveFinancials` is the idiomatic, drift-proof choice; the query is investment-scoped, cached, and behind `<Suspense>`. A bespoke 2-type aggregate would be more code for a mild off-critical-path win.
- [x] dismissed · `simplify` · `computeDoZaplatyRM` derived in both `kosztorys-totals-panel.tsx` and `kosztorys-podsumowanie.tsx` · one shared pure fn, drift-proof; the panel needs the value for its collapsed headline before the child mounts. Prop-drilling it down would trade one cheap line for threading.
- [x] dismissed · `simplify` · `zaliczki.ts:17` `sumZaliczkiByStage` re-filters `!isDepositType` that SQL already guarantees · defensible as a self-contained pure fn (its stated intent). Kept.
- [x] dropped · `code-review` · gross totals derive from a single per-investment `vatRate` denormalized onto every row → latent if rows ever carry mixed VAT, but benign today (all equal by construction). Too speculative to fix now.
- [x] dropped · `code-review` · a negative „poza etapem" quantity can render an odd pomiar edge · cosmetic, unreachable via the UI (qty inputs clamp ≥ 0).
- [x] dropped · `module-cohesion` · the `columnTotals` memo inlines per-etap loop logic that could live in settlement · minor; the memo is grid-presentation glue, not domain math worth relocating.

## Simplify pass

Ran `/simplify` — 4 cleanup agents (reuse / simplification / efficiency / altitude). 2 applied,
0 proposed-open, 4 dismissed, 1 skipped. Reuse scan found zero violations (the diff is
reuse-conscious). The altitude scan confirmed both recon surfaces share one path and the `validate.ts`
auto-clear generalizes cleanly.

## Tests & suite

- Applied fixes verified: `tsc --noEmit` **clean**; `vitest run src/__tests__/lib/kosztorys/
validate-hook.test.ts` → **240 passed / 11 skipped** (the 11 are pre-existing DB-integration /
  nodemailer-gated specs, unrelated to this diff), incl. the 2 new W3 guards.
- Full suite (`typecheck && lint && test && test:e2e && build`): _NOT run — owed an explicit go._

## Archive gate

**Do NOT archive** (standing user directive at the time). All review + simplify findings were at a
terminal resting place — **0 open `[ ]` boxes**: the one deferred finding (`updateTransferAction`
orphan) is filed as **EX-543**, and the deferred recon E2E as **EX-544** (`e2e-backlog`).

### Manual verification (light pass)

Ran the `verify-manual-checks` light smoke against the 5435 `db-test` DB (OWNER session), logged in
`context/foundation/manual-checks.md` → `## robocizna-from-kosztorys + summary-charts +
recon-suspense (branch-wide gate re-cover)`. **3/3 surfaces rendered clean, 0 blocking findings:**

- **W1 verdict-stability — PASS** (the headline check): on `/inwestycje/117` the recon block stayed
  byte-identical after applying `?type=LABOR_COST` (page stats shifted, recon didn't) → the
  false-scream-under-filter bug is fixed, and the verdict is URL-filter-independent by construction.
- **W2 Suspense** — neutral „Wczytywanie z kosztorysu…" fallback, `zgodne` never appears
  pre-resolve (no false green cue), no layout jump on resolve.
- **kosztorys-summary-charts** — Materiały breakdown + per-etap „Suma transzy" + Udział % shares
  render, **0 console errors**. (No literal SVG pie in this view — the „section chart" is the
  Udział % table; the offer-view pie's absence is not a defect.)
- One **non-blocking process finding** (unchecked in the registry): `perf-seed-kosztorys.ts` Payload
  boot hung >5 min / 0 rows against the 5435 test DB — worked around with a direct-SQL small seed.
  Needs a human to confirm whether that's a real regression in the documented seed path.
- **No domain sign-off made** — the 117/14 recon figure mismatches are fixture-shape mismatches by
  design; whether a given robocizna/rabat figure is domain-correct stays an **owner** call.

Independently blocking a hypothetical archive at the time (for the record):

- EX-536 + EX-539 — parked Urgent domain blockers on the robocizna slice (Phase 5 `LABOR_COST` retire).
- Owner sign-off on the recon domain semantics for the three re-covered slices.
- Full suite (lint/e2e/build) not yet run.
