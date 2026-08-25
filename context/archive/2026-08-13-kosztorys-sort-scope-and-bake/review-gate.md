# Review-gate ledger — kosztorys-sort-scope-and-bake (EX-688) · 2026-08-13

Diff scope: `3077c20f..HEAD` (EX-688 only; EX-682/683 gated in its own run).
Fan-out: `/10x-impl-review`, `/code-review`, `feature-first-structure`, `module-cohesion-audit` +
`structure-scatter-audit`, `comment-noise-audit` (read-only, parallel). `tailwind-v4-audit` dropped —
no styling in the diff.

## Findings

_Trimmed at archive (2026-08-13): every `fixed` finding was dropped — its durable record is the
commit that fixed it, verifiable by reading the code. What survives below is the negative space git
cannot hold: what was looked at and deliberately **not** changed, and why._

Pre-trim tally: **11 fixed, 1 filed, 2 dropped, 2 dismissed · 0 open.**

- [x] 🔵 OBSERVATION · dismissed · code-review · `grid/sort-header.tsx` · Claim: dropping
      `size-4 shrink-0` from the sort caret renders it at 24px. False — `globals.css:11` sets
      `svg.lucide { width/height: 1rem; flex-shrink: 0 }` in `@layer base`.
- [x] filed · impl-review · `e2e/` · Browser-level E2E for the sort scopes + bake was never authored —
      **EX-689** (`e2e-backlog`, project Wykonczymy) carries the six scenarios and the test
      disposition (e2e: grid render + server action + reload persistence, no cheaper layer gives the
      reload signal).
- [x] dropped · module-cohesion · `src/lib/kosztorys/row-view.ts` · Proposal to split filter-vs-sort
      into two modules — ~90 lines, one coherent "how the grid views rows" concern; churn without a win.
- [x] dismissed · structure-scatter · `grid/kosztorys-v2-column-opts.ts` · Proposal to move `SortPickT`
      to `lib/kosztorys` — it is the column-opts contract type and only components import it;
      colocation is correct per the feature-first rule.
- [x] dropped · impl-review · `row-view-sort-scope.test.ts` vs `row-view-sort-within-sections.test.ts` ·
      Two of the scope spec's cases overlap the older within-sections spec; both are cheap and assert
      behaviour, not internals.

## Simplify pass

Ran the simplify pass serially after triage — 2 applied (`display-order-plan` inlining +
`sortRowsWithinSections` dedup), 0 proposed, 0 dismissed; both folded into `## Findings` above
(tagged `simplify`). No separate report file — this ledger is the record.

## Tests & suite

- `pnpm typecheck` — clean.
- `pnpm exec vitest run` on the four affected unit specs (`display-order-plan`, `row-view-sort-scope`,
  `row-view-sort-within-sections`, `section-band-rows`) — 24 passed.
- DB spec `kosztorys-renumber-kosztorys-order.test.ts` against the isolated 5435 `db-test` — 4 passed
  (RK1–RK4).
- Full suite (`lint` / `test` / `build`) and `pnpm test:e2e` — not run; awaiting the user's go.

## Archive gate

Archived 2026-08-13 on the owner's call, with the manual checks still open —
`context/foundation/manual-checks.md` carries 5 unticked boxes for EX-682/683 and 12 for EX-688.
Manual checks are non-blocking for archive here; the boxes stay in the registry until ticked.
