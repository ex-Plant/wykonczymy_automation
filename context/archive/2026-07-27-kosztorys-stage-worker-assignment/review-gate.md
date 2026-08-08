# Review-gate ledger — kosztorys-stage-worker-assignment (EX-613) · 2026-07-29

Diff under review: `afda6fc3~1..HEAD` (Phases 1–3, commits `afda6fc3`, `3f18d858`, `d9b3a06a`) plus the
gate's own working-tree fixes.

Fan-out (7 read-only checks): `/10x-impl-review` · `/code-review` · `tailwind-v4-audit` ·
`feature-first-structure` · `module-cohesion-audit` · `structure-scatter-audit` (diff-scoped) ·
`comment-noise-audit` (flag-only). Then `/simplify` (4 agents: reuse / simplification / efficiency /
altitude), serial and mutating.

## Findings

<!-- One checkbox per finding, every source folded in. Most-severe first; bug-finding checks keep
     their native severity, structural/style findings stay tag-free. -->

- [x] 🟡 WARNING · filed EX-640 · code-review · `src/lib/queries/subcontractor-roster.ts` ·
      `unassignedStageCount` credits work off `byWorker`, which the settlement fills only for etapy
      that have a plane — so an etap that is both unassigned and plane-less is invisible to the
      warning while its money is missing from every row. Deferred: the fix needs a product call on
      what the warning says when the two gaps overlap.
      `test: TDD · unit — recorded in EX-640.`
- [x] 🟡 WARNING · filed EX-641 · code-review · snapshot restore · a snapshot now carries `worker_id`,
      so restoring one whose etap names a since-**deleted** worker hard-fails on the FK instead of
      restoring with an empty assignment. Deferred: needs a deliberate null-and-warn vs. block-and-name
      decision plus a restore-path integration test.
      `test: TDD · integration — recorded in EX-641.`
- [x] 🔵 OBSERVATION · filed EX-639 · code-review · `src/lib/queries/subcontractor-roster.ts` reads
      the whole kosztorys tree uncached on every investment pick. Deferred: caching means choosing and
      verifying a tag set across every editor mutation.
      `test: no automated test — perf; measure before/after.`
- [x] 🔵 OBSERVATION · filed EX-643 · simplify (altitude) · `entity-combobox-field.tsx` /
      `cash-register-field.tsx` · the same „active filter hides the currently-selected value" hole
      fixed in `stage-header.tsx`, pre-existing at both. Deferred: neither field reads its own selected
      value at the filter point, so the fix threads state through two shared components.
      `test: no automated test · e2e — recorded in EX-643.`
- [x] filed EX-642 · impl-review · `stage-header.tsx` renders the assignee only inside the dropdown,
      so scanning the grid tells you nothing about who owns which etap. UX/design call, not a defect —
      but the most visible gap left in the shipped slice.
- [x] filed EX-644 · simplify (reuse) · `subcontractor-worker-totals.tsx` glosses every settlement
      state while `payout-roster-summary.tsx` explains only `no_stages`, so the same red figure reads
      as a debt in the dialog and a prepayment in the panel. Deferred: changes what the dialog renders.
- [x] filed EX-645 · module-cohesion · `settlement.ts` (three settlements in one module) and
      `expense-form.tsx` (a whole invoice-ingest subsystem inside the form component) each want a split.
- [x] filed EX-646 · simplify (altitude) · `use-kosztorys-editor.ts` · `handleRenameStage` /
      `handleSetStagePlane` / `handleSetStageWorker` are the same optimistic patcher three times.
      Deferred onto EX-515, which already owns that file and wants a test harness first.
- [x] filed EX-638 · e2e · the slice is browser-level and the repo has no jsdom/testing-library, so
      six of the fixes above have no unit-testable layer. Filed with the `e2e-backlog` label.
- [x] skipped · simplify (altitude) · a `useKeyedFetch` primitive unifying `useRoster` and `useSaldo` ·
      after this gate the two differ by design — the roster is keyed off form values, the saldo is
      driven imperatively by two different register pickers. Unifying them now would force the saldo
      into a shape it doesn't want.
- [x] dropped · simplify (reuse) · `NoStagesBadge` is a third copy of the hint-badge shape · the
      copies are six lines each and diverge in icon and aria-label (which the E2E asserts); a shared
      parameterized badge would cost more than it saves.
- [x] dropped · simplify (simplification) · the roster block synthesizes the selected worker's zero
      row client-side instead of the query returning it · three lines, no correctness cost.
- [x] dropped · simplify (efficiency) · `stage-header.tsx` re-filters the roster per column per
      render · React Compiler is on and the worker list is a handful of rows; no measurable cost.
- [x] dropped · simplify (simplification) · `resolvePayoutWorkerNames` resolves names that
      `computeSubcontractorSummary` resolves again · one redundant Map over a short array.
- [x] dismissed · structure-scatter-audit · `stage-header-copy.ts` reads as a competing home for
      copy · it is colocated next to its only consumer, which is exactly the repo's feature-first rule.
- [x] dismissed · tailwind-v4-audit · zero findings on the diff.

## Simplify pass

Ran `/simplify` — 7 applied, 4 dropped, 1 skipped, 4 filed (EX-643 · EX-644 · EX-645 · EX-646); each
finding folded into `## Findings` above tagged `simplify`, with its agent (reuse / simplification /
efficiency / altitude) in parentheses. No separate report file — this ledger is it, per the gate's
one-list rule.

Two of its findings mattered more than the rest, because they caught Step 1 fixes that had not
travelled: the float normalization was applied to the per-worker rows but not to the headline that
renders the identical red test, and the null-bucket carve-out was applied in the panel's JSX while the
wypłata dialog kept calling the residual bucket „ta osoba". Both were re-fixed one layer down, in
`subcontractor-summary.ts`, so each now has exactly one home.

## Tests & suite

- Whole-tree gate run before the gate opened: `typecheck` ✅ · `lint` ✅ (0 errors, 83 pre-existing
  warnings) · `test` ✅ 1900 passed / 85 skipped · `test:integration` ✅ 82 passed / 28 files · `build` ✅
- Tests added at the gate: `src/__tests__/lib/kosztorys/subcontractor-summary.test.ts` (float-noise
  settlement, null-bucket state) · `src/__tests__/lib/queries/subcontractor-roster.test.ts`
  (MANAGEMENT gate rejects before any figure is read).
- Full suite after every gate edit (2026-07-29): `typecheck` ✅ · `lint` ✅ (0 errors, 83 pre-existing
  warnings — same count as before the gate) · `test` ✅ 1903 passed / 85 skipped · `test:integration`
  ✅ 82 passed / 28 files · `build` ✅.
- `test:e2e` not run — the slice's browser coverage is filed as EX-638, and E2E is non-blocking for
  Done per the 2026-07-28 owner ruling.
