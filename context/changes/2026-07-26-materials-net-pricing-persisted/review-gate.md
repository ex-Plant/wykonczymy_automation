# Review-gate ledger — EX-596 materials-net-pricing-persisted · 2026-07-26

**Scope:** `d2960a82^..HEAD` — 63 files, 1781+/426−. Deliberately wider than this change's four
phases: it folds in the parallel agent's commits on the same branch (`83c06cca`, `ee034fc8`,
`d6c952a4`, `7e0cea6d`, `52a2157f`, `21a82a04`) and the settled-materials work that opened the
session, because they touch the same Podsumowanie surface and nobody else is going to review them.

**Checks in the fan-out:** `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`,
`feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit`.
Step 0.5 (browser verification) skipped — no `verify-manual-checks` skill installed here; the manual
surface is registered in `context/foundation/manual-checks.md` instead.

**Hazard:** a second agent is working the same tree and committed twice during this gate. `/simplify`
must not touch its dirty files.

## Findings

- [x] 🟡 WARNING · fixed · code-review · `src/components/kosztorys/summary/tables/summary-breakdown-table.tsx:20`
      · the upper grid visibly didn't add up — „Robocizna" renders pre-rabat (`sumaPracPreRabat`)
      while „Łącznie" is the post-rabat `combined`, and `83c06cca` had moved the reconciling „Rabat"
      row into the lower table. Owner's call: put each row where it makes sense. Rabat moved up
      directly under Robocizna (it IS a term — pre-rabat − rabat + materiały = Łącznie), leaving the
      totals grid a clean Łącznie − Wpłaty = Do zapłaty. „Obniżka materiałów" is NOT a term (the
      Materiały row is already reduced by it), so it became a „w tym obniżka materiałów" sub-line
      under Materiały rather than a fake deduction row. Same fix applied to the tryb-mieszany block,
      which had the identical ordering.
      test: no automated test · — · row order in a presentational grid; the arithmetic it exposes
      (`computeSummarySplit`, `sumaPracPreRabat`) is already unit-covered.
- [x] 🔴 CRITICAL · fixed · code-review · `src/lib/queries/reference-data.ts:—` · `fetchInvestmentFinancials`
      was tagged `[transfers]` only, but the aggregate now reads `investments.materials_net_rate` /
      `settlement_mode` and the writers revalidate `investments` — the listing served a stale
      marża/bilans until an unrelated transfer happened to expire the tag. Also silently regressed
      settlement-mode flips. Now tagged with both.
      test: no automated test · — · the defect is in a cache-tag argument, not in logic a spec can
      observe; the listing↔detail parity script is the standing guard for the figures themselves.
- [x] 🔴 CRITICAL · fixed · code-review · `src/lib/db/map-category-costs.ts:124` · the v1 header's
      „Bilans inwestora" is the SUM of the visible tiles (`toggle-stat-buttons.tsx:33` reduces
      `amount`), and `materialsNetDiscount` had no tile — so the tile-sum bilans and `calculateBalance`
      diverged by the concession, and print/export inherited the low one. Added the „Obniżka
      materiałów" tile, as `totalRabat` already has.
      test: TDD · unit — `src/__tests__/map-category-costs.test.ts`, Σ tiles reconciles with
      `calculateBalance` on an investment carrying both rabat and a concession.
- [x] 🟡 WARNING · fixed · code-review · `src/scripts/audit-investment-parity.ts:92` · the detail path
      called `deriveFinancials` without `materialsNetRate` / `settlementMode`, so every investment with
      a rate set would report a false bilans+marża mismatch. Now passes both off the investment doc.
      test: no automated test · — · the script IS the parity harness; a test of the harness is the
      harness.
- [x] 🟡 WARNING · fixed · code-review · `src/components/kosztorys/summary/tabs/summary-expenses-tab.tsx:72`
      · on a brutto-settled investment the quoted „(−X zł)" was computed off the saved rate the server
      ignores — the readout contradicted both its own notice and the marża. Now quoted off the rate the
      server will honour, and the parenthetical drops entirely when inert.
      test: no automated test · — · presentational branch with no persisted state; covered by the
      manual-checks row for the brutto notice.
- [x] 🟡 WARNING · fixed · code-review · `src/components/kosztorys/summary/tabs/summary-expenses-tab.tsx:123`
      · the rate field committed any number the user typed; the action's schema caps at 100, so a
      fat-fingered 230 bounced back as a validation toast. Clamped to 0–100 at the commit.
      test: no automated test · — · one-line clamp on an input handler; the schema remains the
      authority and is already validated server-side.
- [x] 🟡 WARNING · fixed · code-review · `src/lib/kosztorys/format.ts:5` · an investment with no wpłaty
      rendered „-0,00" — a deduction row negates its amount, and `(-0).toLocaleString('pl-PL')` is
      `-0,00`. Fixed at the choke point with `n + 0`.
      test: no automated test · — · a formatter one-liner verified directly in node; dropped rather
      than pin a locale-string spec.
- [x] 🟡 WARNING · fixed · code-review · `src/components/investments/financial-stats.tsx:40` · both v1
      tooltips still recited the pre-change formulas, so the header explained a bilans and a marża it
      no longer computes. Both now name the concession.
- [x] fixed · simplify · `src/components/investments/financial-stats.tsx:80` · the new „Obniżka
      materiałów" tile is a credit but fell through the label filter into „Koszty inwestora" with a red
      border. Routed via a `CREDIT_LABELS` set (also collapsing the three-way `f.label === …` chain)
      and given its own tooltip.
- [x] fixed · simplify · `src/lib/db/investment-financials.ts:88` · the netto-concession arithmetic was
      written twice — once in `deriveFinancials`, once in `summary-economics`. The server term now
      imports the panel's function, so the marża and the row that explains it cannot drift.
- [x] fixed · module-cohesion · `src/lib/kosztorys/summary-economics.ts` · `materialyPair` is a
      half-translated identifier (AGENTS.md naming rule 3). Renamed repo-wide to `billedMaterialsPair`
      (11 sites); verified distinct from the existing `materialsPair`.
- [x] fixed · simplify · `src/components/kosztorys/summary/tabs/summary-expenses-tab.tsx:120` · the
      inert/non-inert readout was two mutually exclusive `&&` spans; collapsed to one.
- [x] fixed · code-review · `src/components/kosztorys/summary/settlement-plane-warning.tsx:17` · Polish
      declines the participle on the same 1/2–4/5+ split as the noun, so „5 wpłat są oznaczone" was
      broken at every count ≥5. Extracted `pluralForm` and added `oznaczoneVerb`.
- [x] fixed · comment-noise · `src/lib/db/calculate-margin.ts:11` · the formula comment restated the
      expression three lines below — deleted; the per-term rationale above it stays.
- [x] fixed · comment-noise · `summary-totals-table.tsx:11`, `summary-breakdown-table.tsx:14`,
      `summary-expenses-tab.tsx:49`, `investment-owner-figures.tsx:34` · four header comments narrating
      the JSX / carrying vanished-state ("now carries") — trimmed to the rationale that survives the
      strip test.
- [x] dismissed · code-review · `src/components/tables/investments.tsx:37` · `materialsNetRate` /
      `settlementMode` flagged as dead plumbing (no column reads them). False positive — the whole row
      is handed to `EditInvestmentDialog`, whose form needs both. Deletion gated on typecheck, which
      caught it; reverted and commented instead.
- [x] skipped · code-review · `src/lib/kosztorys/summary-economics.ts:—` · the settled-material netto
      defect (settled rows priced at brutto in the panel) is real and confirmed by the owner, but it is
      out of this change's scope and already tracked — **EX-595**.
- [x] filed · code-review · `src/app/(frontend)/raporty/page.tsx:—` · `/raporty` aggregates many
      investments, so it cannot apply a per-investment concession — its marża/bilans disagree with the
      per-investment pages. Banner shipped in Phase 4; the real fix is **EX-598**.
- [x] skipped · module-cohesion · `src/lib/actions/kosztorys.ts`, `src/lib/db` (pure derivations),
      `src/lib/kosztorys/settlement-mode.ts` placement, deposit-planes extraction · four structural
      splits proposed across the fan-out. All are review-worthy refactors touching files this change
      barely brushes; doing them inside a bug-fix gate would bury the diff.
- [x] skipped · module-cohesion · `src/components/kosztorys/use-kosztorys-editor.ts` · god-hook split —
      already deferred under **EX-515** with a recorded reason (cohesive stateful unit, needs a test
      harness first).

- [x] fixed · owner · `src/components/investments/investment-owner-figures.tsx:43` · the „Obniżka
      materiałów" stat next to Marża removed at the owner's call — the figure is already readable in
      Podsumowanie and the strip does not need a second copy. Prop dropped from the call site too.
- [x] fixed · owner · `src/components/investments/investment-owner-figures.tsx` · marża rendered as a
      bare number with badges beside it, so a −1 076 647,86 zł reading had nothing on screen to explain
      it — the settled-materials figure that drives it lives one tab away, in Wydatki. Rewritten as a
      waterfall: Robocizna − Wypłaty − Rabat − Materiały wliczone w robociznę − Obniżka materiałów −
      Strata = Marża, each deduction rendered negative, zero rows dropped. Component now takes the
      whole `financials` object and derives the margin itself.
      test: no automated test · — · presentational; `calculateMargin` is already unit-covered and the
      grid primitives are shared with the summary panel.

## Simplify pass

Ran serially against the triage — 4 applied (credit-label routing, the duplicated concession formula,
the `materialyPair` rename, the collapsed readout spans), 1 dismissed (the "dead" row fields). Every
finding folded into `## Findings` above; no separate report file. The one held-back proposal (the
breakdown-table sum) was resolved by the owner in-session and fixed.

## Tests & suite

- `pnpm typecheck` — clean (caught the dead-plumbing false positive on the way).
- `pnpm exec eslint <touched files>` — clean.
- `pnpm test` — 103 files / 1753 tests passed, 22 files / 57 tests skipped (DB-gated). Includes the
  new tile-sum reconciliation spec.
- `pnpm test:e2e`, `pnpm test:integration`, `pnpm build` — not run.
- Manual checks: all 11 rows under `## EX-596` in `context/foundation/manual-checks.md` are unticked.
