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
