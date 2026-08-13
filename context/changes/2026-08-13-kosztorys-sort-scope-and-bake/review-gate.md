# Review-gate ledger — kosztorys-sort-scope-and-bake (EX-688) · 2026-08-13

Diff scope: `3077c20f..HEAD` (EX-688 only; EX-682/683 gated in its own run).
Fan-out: `/10x-impl-review`, `/code-review`, `feature-first-structure`, `module-cohesion-audit` +
`structure-scatter-audit`, `comment-noise-audit` (read-only, parallel). `tailwind-v4-audit` dropped —
no styling in the diff.

## Findings

- [x] 🔴 CRITICAL · fixed · code-review · `src/lib/actions/kosztorys.ts:~640` · The whole-kosztorys
      write dropped the schema's duplicate-index refine (correct: indices repeat across sections) but
      put nothing back for the within-section case, so two rows of one section could land on the same
      index and the reloaded order became non-deterministic — the ownership guard now also selects
      `section_id` and rejects a repeated `section:index` slot, no extra round trip.
      test: test-driven-debugging · integration — RK4 in `kosztorys-renumber-kosztorys-order.test.ts`
      (red before the guard, green after) + RK1 extended to assert the persisted `display_order`
      values, not just the id sequence.
- [x] 🔴 CRITICAL · fixed · code-review · `src/components/kosztorys/editor/use-kosztorys-editor.ts` ·
      The bake fired the server action and ignored its result — one stale id (a row deleted in another
      tab) rejects the whole write, and the grid kept showing an order no reload could reproduce, with
      no message. `runKosztorysRenumber(refs, revertTo)` now awaits, rolls the optimistic re-lay back
      and toasts a warning.
      test: no automated test · — covered indirectly by RK2/RK4 (the server-side rejection paths); the
      rollback itself is UI state, folded into EX-689's E2E scope.
- [x] 🟡 WARNING · fixed · impl-review · `src/lib/kosztorys/row-ops.ts` · The optimistic apply ran one
      full pass over the sheet per section (~40 passes on a 1000-row kosztorys) — replaced by a single
      grouped pass (`applyKosztorysOrder`); the now-callerless `applySectionOrder` deleted (gated on
      `pnpm typecheck`).
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/kosztorys/editor/grid/sort-header.tsx` ·
      Claim: dropping `size-4 shrink-0` from the sort caret renders it at 24px. False — `globals.css:11`
      sets `svg.lucide { width/height: 1rem; flex-shrink: 0 }` in `@layer base`.
- [x] fixed · code-review · `sort-header.tsx:55` · Trailing space in the „Sortuj rosnąco " label.
- [x] fixed · module-cohesion · `kosztorys-row-actions-menu.tsx:48` + `kosztorys-v2-columns.tsx:235` ·
      The menu took `sortScope: SortScopeT | null` but only ever read its nullness — narrowed to
      `sortActive: boolean`, `SortScopeT` import dropped.
- [x] fixed · comment-noise · `sort-header.tsx:18,21,29` · Comment claimed the item bakes „THIS menu's
      sort" (it bakes the whole sheet) and that every label spells out its scope (the global pair no
      longer does); the tooltip-composition rationale duplicated `HeaderMenu`'s own. Rewritten/trimmed.
- [x] fixed · comment-noise · `kosztorys-v2-columns.tsx:201`, `kosztorys-v2-column-opts.ts:67` ·
      Restated the code (which items are disabled) or narrated a per-section variant that no longer
      exists. Deleted/trimmed.
- [x] fixed · simplify · `src/lib/kosztorys/display-order-plan.ts` · `planSectionRenumber` had no
      caller left but `planKosztorysRenumber` (the section-scoped bake was removed) and drove the same
      O(sections × rows) filter-per-section as the row-ops smell above — inlined into one
      `groupBySection` pass; its spec's unique cases (gaps in `before`, `desc`) folded into the
      `planKosztorysRenumber` describe.
- [x] fixed · simplify · `src/lib/kosztorys/row-view.ts:66` · `sortRowsWithinSections` hand-rolled the
      section grouping that `row-ops.groupBySection` already exports — deduped.
- [x] fixed · impl-review · `context/changes/…/change.md`, `plan.md:359` · Docs described the retracted
      design (bake greyed out under a global sort, „Utrwal kolejność", a menu spec pointing at the
      deleted `sort-lock-hints.test.ts`). `change.md` gained a „Korekta druga" recording the
      always-enabled decision and the tooltip removal; Progress 3.1 rewritten.
- [x] filed · impl-review · `e2e/` · Browser-level E2E for the sort scopes + bake was never authored —
      filed **EX-689** (`e2e-backlog`, project Wykonczymy) with the six scenarios and its test
      disposition.
- [x] dropped · module-cohesion · `src/lib/kosztorys/row-view.ts` · Proposal to split filter-vs-sort
      into two modules — ~90 lines, one coherent "how the grid views rows" concern; churn without a win.
- [x] dismissed · structure-scatter · `kosztorys-v2-column-opts.ts` · Proposal to move `SortPickT` to
      `lib/kosztorys` — it is the column-opts contract type and only components import it; colocation
      is correct per the feature-first rule.
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

Blocked. Every finding box is checked, but the manual checks are not: `context/foundation/manual-checks.md`
still carries 5 unticked boxes for EX-682/683 and 12 for EX-688, and unticked manual checks block
`Done`/archive.
