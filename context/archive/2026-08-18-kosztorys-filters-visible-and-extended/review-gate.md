# Review-gate ledger — 2026-08-18-kosztorys-filters-visible-and-extended · 2026-08-18

Base: `acf21753^` · branch `kosztorys-filters-visible-and-extended` · 5 commits.
Step 0.5 (verification pass) skipped — it drives the browser, which is not run unprompted.
Sprawdzenia ręczne żyją w `context/foundation/manual-checks.md` — rejestr, nie blokada archiwizacji.

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` — all seven applied.

## Findings

_Findings zamknięte jako `fixed` usunięto przy archiwizacji (2026-08-18): trwałym zapisem poprawki
jest jej commit, a to, czego git nie utrzyma, to decyzje o niezrobieniu. Tally przed cięciem:
10 fixed, 1 filed, 1 dropped, 1 dismissed, 5 skipped · 0 open._

<!-- [box] [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — reason -->

- [x] dismissed · code-review · `src/components/kosztorys/editor/toolbar/active-filters-model.ts:69` ·
      the `PROBLEM_CONDITIONS` loop can push more than one chip although at most one is ever engaged.
      Benign and deliberate — written as a loop so the bar does not silently drop a second one if the
      exclusivity ever changes; the comment already says so.
- [x] dropped · comment-noise · `src/__tests__/lib/kosztorys/row-conditions.test.ts` · the shared
      `subjects` array makes each case's precondition invisible at the assertion. Real, but the fix is
      a fixture rewrite across 51 cases for no behavioural gain.
- [x] skipped · impl-review · `src/lib/kosztorys/row-conditions.ts:258-374` · the four rate-source
      conditions carry no `revealsColumns`, so narrowing by „stawka wykonawcy" can hide the column
      that decides it. Real, but which columns each should reveal is a design call for the owner,
      not a mechanical fix — behaviour-changing and uncertain.
- [x] skipped · efficiency · `src/components/kosztorys/editor/use-kosztorys-editor.ts` ·
      `conditionCounts` runs one whole-dataset pass per registry entry on every edit; six new entries
      widen it. A review-worthy refactor (single fused pass) on the hottest path EX-496 was reverted
      over — not something to land inside a review gate.
- [x] skipped · module-cohesion · `src/lib/kosztorys/row-conditions.ts` · the file is both the
      registry (the data) and its query layer (`applyRowConditions`, `countMatching`,
      `sectionIdsWhereAllMatch`, …). A defensible split, but it is its own review-sized change.
- [x] skipped · module-cohesion · `src/components/kosztorys/editor/kosztorys-editor-body.tsx` ·
      god module. Pre-existing and far wider than this diff; EX-521 owns the editor-split arc.
- [x] skipped · feature-first · `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts` ·
      `guideX` (a drag-guide pixel offset) sits in the view-state hook among reading state. Real
      smell, pre-existing, out of this slice's scope.

- [x] filed EX-715 · deferred · code-review · browser-level coverage for the chip bar, the search
      debounce race and the client-share fold path — the slice's E2E obligation, filed to the
      `e2e-backlog` in project "Wykonczymy" rather than authored here (a run is ~1h and is never
      started unprompted).
      test: e2e — the four risks and the fixture requirements are written into the issue.

## Simplify pass

Ran `/simplify` (4 agents: reuse / simplification / efficiency / altitude) over `acf21753^..HEAD`
plus the working tree — 5 applied, 0 proposed, 4 skipped as review-sized or pre-existing. Every
finding is folded into `## Findings` above, tagged `simplify` / the audit that raised it; there is no
second list. No separate report file was written — this ledger is the report.

## Tests & suite

- `pnpm typecheck` — clean.
- `pnpm lint` — 2 errors, both outside this diff: `src/hooks/use-latest-request.ts:15` (file untouched
  by the slice) and `test.js:255` (untracked scratch file, no git history).
- `pnpm test` — `2 failed | 2468 passed | 134 skipped (2604)`. Both failures are the known
  `LABOR_COST` / `RABAT` pair from the transfer dialog (`src/__tests__/transfer-rabat.test.ts`,
  `src/__tests__/components/forms/expense-form/draft-type-coercion.test.ts`). **Verified pre-existing:**
  reproduced with the working tree stashed, and `git diff --name-only acf21753^..HEAD` touches no
  expense-form or transfer path.
- `pnpm test:e2e` — not run (never started unprompted; the slice's browser coverage is filed as EX-715).
- `pnpm build` — not run; `typecheck` + `lint` cover the same tree and the slice adds no build-time surface.
