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

- [x] 🟡 WARNING · fixed · code-review + impl-review · `src/components/forms/hooks/use-roster.ts` ·
      clearing the investment mid-fetch left the spinner pinned forever and let the stale response
      repopulate a roster for the investment the user had just cleared — both paths raced on an
      un-bumped request id.
      `test: no automated test · e2e — no jsdom/testing-library in the repo, so a hook spec is
    impossible; filed as EX-638.`
- [x] 🟡 WARNING · fixed · code-review + impl-review · `src/components/forms/expense-form/expense-form.tsx` ·
      the roster was loaded from the pickers' `listeners`, so the two states that matter most — a
      restored draft mounting already PAYOUT + investment, and a reset re-applying the URL-prefilled
      investment — left the block mounted and empty. Now keyed off the current values.
      `test: no automated test · e2e — component-level; filed as EX-638.`
- [x] 🟡 WARNING · fixed · code-review · `src/components/forms/hooks/use-roster.ts` · a failed load
      left the id marked as loaded, so re-picking the same investment silently no-opped and the user
      was stuck with no roster and no way to ask again. Superseded by the keyed rewrite, which has no
      such guard to poison.
      `test: no automated test · e2e — filed as EX-638.`
- [x] 🟡 WARNING · fixed · code-review · `src/lib/kosztorys/subcontractor-summary.ts` · `due` is a
      repeated float multiply/add over the etap quantities while `paid` is a Postgres SUM, so paying
      out exactly the computed należne — the normal case — left `remaining` at ~−1e-13 and painted a
      square worker red as „nadpłata −0,00".
      `test: test-driven-debugging · unit — red repro in subcontractor-summary.test.ts, now green.`
- [x] 🟡 WARNING · fixed · code-review · `src/components/kosztorys/editor/grid/stage-header.tsx` ·
      the roster filter dropped deactivated workers unconditionally, so an etap's own assignee vanished
      from it the moment they were deactivated: the etap read as unassigned while the panel still
      credited them by name, and the reassignment confirm called them „nieznana osoba".
      `test: no automated test · e2e — filed as EX-638.`
- [x] 🟡 WARNING · fixed · simplify · `src/components/forms/hooks/use-saldo.ts` · carries all three
      of the `useRoster` bugs above, unfixed and pre-existing: an unconditional catch toast, a
      `resetSaldo` that neither disowns an in-flight fetch nor clears the loading flag, and a
      `fetchSaldo('')` that lets the superseded response win. Fixed in place — the sibling hook was
      where the bugs were copied from in the first place.
      `test: no automated test · e2e — filed as EX-638.`
- [x] 🔵 OBSERVATION · fixed · simplify (altitude) + code-review ·
      `src/lib/kosztorys/subcontractor-summary.ts` · the unattributed residual bucket came back as
      `no_stages`, and every renderer of that state says „ta osoba nie ma przypisanych etapów" — which
      is the bucket's own definition, not a finding. Fixed at the domain rather than in JSX, so the
      wypłata dialog's badge is fixed by the same edit and the panel's carve-out ternary is gone.
      `test: test-driven-debugging · unit — „the null bucket is only ever settled or overpaid".`
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
- [x] fixed · simplify (reuse) · `src/lib/kosztorys/subcontractor-summary.ts` · the float fix landed as
      a local `toGrosze`, reinventing `normalize` in `src/lib/utils/format-currency.ts`. Now calls it.
- [x] fixed · simplify (altitude) · `src/lib/kosztorys/subcontractor-summary.ts` · the float fix did
      not travel: the headline `remaining: dueNet - payoutsTotal` stayed raw and
      `subcontractor-headline-summary.tsx` paints it red on the identical `remaining < 0` test, so the
      red „−0,00" survived at the headline. Normalized there too.
- [x] fixed · simplify (efficiency) · `src/lib/kosztorys/subcontractor-summary.ts` · two Maps built
      over the same `payouts` array (amounts and names) → one map of rows.
- [x] fixed · simplify (simplification) · `src/components/forms/hooks/use-roster.ts` ·
      `loadRoster('')` and `resetRoster()` had become byte-identical.
- [x] fixed · simplify (altitude) · `use-roster.ts` + `expense-form.tsx` · the imperative
      load-and-reset pair was a bandaid over a value the component already has. Rewritten as
      `useRoster(investmentId)`, keyed — which deletes the effect, its `exhaustive-deps` escape hatch,
      the `loadedForRef` idempotency guard and both `resetRoster()` call sites, and makes the
      type-switch clear fall out for free.
- [x] fixed · suite · `src/components/forms/hooks/use-roster.ts` · the keyed rewrite above cleared the
      roster with a synchronous `setState` inside the effect, which the React Compiler lint rejects
      (cascading renders) — and it was a real one-frame flash of the previous investment's roster.
      Reworked to reconcile the key during render and disown superseded fetches through the effect's
      own cleanup, which also removed the request-id ref entirely.
- [x] fixed · simplify (simplification) · `src/components/kosztorys/editor/grid/stage-header.tsx` ·
      four derived worker lists collapsed to one filter
      (`isActiveRef(worker) || worker.id === stage.workerId`).
- [x] fixed · simplify (efficiency) · `src/components/kosztorys/summary/summary-panel-content.tsx` ·
      `stages={stages ?? []}` / `workers={workers ?? []}` minted fresh array identities every render,
      defeating memoization of the now-heavier `computeSubcontractorSummary`. The props are already
      optional — the coalescing was pure waste.
- [x] fixed · feature-first-structure · `src/components/forms/form-components/payout-roster-summary.tsx` ·
      `etapNoun` is a half-translated identifier, banned outright by AGENTS.md → `stageNoun`.
- [x] fixed · code-review · `src/components/forms/form-fields/entity-combobox-field.tsx` · the slice
      widened the component's `listeners` prop type with zero callers passing it. Reverted to its
      pre-slice shape rather than leave dead API surface, then deduped onto `isActiveRef`.
- [x] fixed · module-cohesion · `src/components/forms/form-fields/cash-register-field.tsx` · inline
      active-check deduped onto `isActiveRef` (the helper the slice introduced next door).
- [x] fixed · comment-noise · `payout-roster-summary.tsx` · JSDoc restating the signature, trimmed.
- [x] fixed · comment-noise · `src/lib/db/kosztorys-tree.ts` · stray commented-out `console.log`.
- [x] fixed · impl-review · `AGENTS.md` · the slice put an on-demand client read in `lib/queries`,
      which is correct but was nowhere written down — the layering rule only described mutations.
      Rule added so the next `'use server'` read doesn't land in `lib/actions`.
- [x] fixed · impl-review · `plan.md` · the `settlementState` narrowing read as drift from the plan;
      recorded as deliberate.
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
