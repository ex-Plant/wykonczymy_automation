# Review-gate ledger — branch `liner_issues_fixing` (vs `staging`) · 2026-08-24

Scope: 20 commits, 64 files, +3582/-691. Spans changes:
`2026-08-19-kosztorys-page-fetch-dedup` (EX-720), `2026-08-24-parity-gross-deposit-fixture` (EX-725),
plus EX-709 / EX-717 / EX-718 / EX-722 / EX-724 / EX-726.

Fan-out: impl-review · code-review · tailwind-v4 · feature-first · module-cohesion · structure-scatter · comment-noise (7/7 reported).
Step 0.5 (browser verification pass) skipped — not requested this turn.

## Trimmed at archive (2026-08-24)

Tally before the trim: **39 fixed, 12 dismissed, 6 dropped, 2 skipped · 0 open**.

The 39 `fixed` findings are gone from the list below. A fixed finding's durable record is its commit
and the code it left behind — both re-readable, both re-verifiable. What survives here is the
negative space git cannot hold: the things deliberately **not** changed, and why. A `dropped`
efficiency finding looks identical to an overlooked one six months from now unless the measurement
that killed it is written down; nothing filed a tracked issue, so nothing needed a condensed line.

Every box was `[x]` when this ledger moved. Its closing line („Owed before archive: the 4 open `[ ]`
boxes…") described an earlier state of the same file and was dropped with the fixed findings.

Swept in when `sheet-compare-footer-inconsistency` was archived — the branch this ledger covers had
already merged to `staging`, so no archive run of its own would ever have reached it.

## Findings

<!-- Format: [box] [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — reason
     Correctness findings carry a `test:` sub-line. Most-severe first. -->

### Correctness / safety

- [x] 🔵 OBSERVATION · dismissed (fix reverted) · code-review · `src/app/(frontend)/inwestycje/[id]/kosztorys/page.tsx:30` · claimed `Promise.all([requireInvestmentOr404(id), sheetIdPromise])` leaves `sheetIdPromise` unhandled when the guard's control-flow throw settles first. **False.** `Promise.all` attaches a rejection handler to every element synchronously at call time, and nothing awaits between `sheetIdPromise`'s creation and the `Promise.all` — so there is no window in which it is handler-less. Verified empirically in node (`caught: NEXT_NOT_FOUND`, no unhandled-rejection line). Step 2 flagged the applied `.catch(() => {})` as ceremony whose comment stated a rule that is false; both reverted
      test: no automated test — there is no defect to guard
- [x] 🔵 OBSERVATION · dismissed (accepted, owner) · code-review · `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:39` · the existence check moved from a live `findByID` to the tag-cached `fetchReferenceData()`; a just-created investment can 404 on a valid URL during the staleness window. Accepted as the documented trade-off — the window is one request wide, self-heals, and the fix if it ever bites is a targeted `updateTag` on create, not a per-load query over 114 rows
      test: no automated test — cache-staleness window, an accepted trade-off not a guard

### Fixture / process integrity

- [x] dismissed · impl-review · plan B criterion 4.2 · "`pnpm lint` czyste" is `[x]` but lint exits 1 — both errors (`src/hooks/use-latest-request.ts:15`, untracked root `test.js:255`) are pre-existing and outside the diff, already recorded in EX-720's own `review-gate.md`

### Structure / placement

- [x] dismissed · module-cohesion · `src/lib/queries/balances.ts` · 13 exports held together by the caching mechanism rather than a domain, but every export is a uniform `unstable_cache` map — trajectory flag only, splitting now is churn
- [x] dismissed · feature-first · 11 of 12 added/renamed files · correct homes; all 6 new specs mirror their source path in full

### Comments

- [x] dropped · comment-noise · `__tests__/financial-golden-master-db.test.ts` · `DATASET_FLOOR` carries 3 stacked block comments, all load-bearing — accretion smell only, merging is churn
- [x] dismissed · comment-noise · `settlement-plane-warning.tsx:9` · vanished-prior-state about a deleted `WarningBanner` — pre-existing on `staging`, not this branch
- [x] skipped · comment-noise · `__tests__/lib/transfers/clear-fields-for-type.test.ts` · deploy-state snapshot goes stale once prod catches up — kept, it explains why #4302 was bookable at all

### Step 2 — simplify / reuse / efficiency / altitude (5-agent fan-out)

- [x] skipped · efficiency · `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:35` · `fetchReferenceData()` moved out of the fan-out into a serial `await`. Real, but the proposed fix costs five no-op `.catch()` calls — and there the ceremony would be **genuinely needed**, since an `await` would sit between the promises' creation and the `Promise.all` (unlike the sibling page's false positive above). Against that: `fetchReferenceData` is `cache()`d and `Navigation` in the layout starts the same promise concurrently, so the page's await usually joins one already in flight. Bad trade
- [x] dropped · efficiency · `src/app/(frontend)/inwestycje/[id]/kosztorys/page.tsx:32` · still pays the `findByID` that `kosztorys_v2` was taught to drop, for one field (`investment.name`) already in warm refData. Unblocked once the staleness trade-off was accepted (owner, 2026-08-24), then measured and dropped: `getInvestment` is already `unstable_cache`d per id AND already runs inside the `Promise.all`, so the saving is one parallel cache lookup. Against that, the substitution inlines the `requireManagementPage` + find + `notFound` pair that `requireInvestmentOr404` exists to hold, and trades a per-entity tag for refData's coarser one — this page would inherit a staleness window that buys it nothing. The `kosztorys_v2` case earned it: there the `findByID` was genuinely extra and all three of its facts were in refData the layout had already started
- [x] dropped · efficiency · `src/lib/queries/investment-transactions.ts:80` · `fetchMediaByIds` awaited as if it depended on `docs`; it doesn't (`fetchAllMedia()` takes no arguments). Pre-existing, and hoisting it costs the no-invoice case a sweep it currently skips — a wash
- [x] dropped · efficiency · `src/lib/queries/investment-transactions.ts:77` · `fetchExpenseCategories()` re-reads a table the page already holds. Pre-existing, both sides `unstable_cache`d, so warm it is one extra cache lookup
- [x] dropped · reuse · `kosztorys_v2/page.tsx:39` vs `[id]/page.tsx:55` · the two-line `find` + `notFound()` pair is duplicated. Two lines; a helper would carry the shared staleness caveat, but that caveat is itself an accepted trade-off rather than a rule
- [x] dropped · reuse · four DB specs each hand-roll their own `INSERT INTO transactions` column list · pre-existing, not introduced here
- [x] dismissed · reuse · `HintedValue` (`components/tables/investments.tsx:47`) vs `CellContent` (`components/ui/summary-grid.tsx:90`) · same „content + hint inline" shape, but `CellContent` is unexported, takes `LabelHintT[]`, and deliberately omits `justify-end` so it can't break the grid's `text-right`. Both `HintedValue` call sites already render `LabelHintIcon`, so the hint **registry** is in use and `hint: ReactNode` is only the slot. Widening a private summary-grid concern for five lines isn't worth it
- [x] dismissed · reuse-scan · diff matched against the primitive catalogue (`src/lib/utils`, `lib/constants`, `lib/kosztorys`, `lib/db`, `lib/queries`, `hooks`, `components/ui`, `types`) · no new symbol re-implements a catalogued one; targeted scan of all 63 changed files for hand-rolled money rounding / PLN formatting / plural / class-merge returned nothing

### Clean

- [x] dismissed · tailwind-v4 · 0 violations across all 12 changed `.tsx`; instrument validated (same greps return 21/88 repo-wide). `eslint` clean on all 12
- [x] dismissed · impl-review · SQL injection — every interpolation goes through drizzle's `sql` tagged template → bind params, incl. the `LIKE` pattern and `${row.date}::timestamptz`
- [x] dismissed · impl-review · layer boundaries, env access, test placement, breakpoints, `no-domain-drift`, migration `20260824_0` up/down parity, `deposit-plane-sums-v2 → v3` cache bump — all verified correct
- [x] dismissed · code-review · auth parity `requireManagementPage` vs the removed guard; SQL↔TS fold parity in `deposit-plane-sums.ts`; `strandedFromPlaneSums` GROSS-only call site; `derivePayoutsByWorker` row-set parity with the deleted `GROUP BY`; `withPayloadTransaction` `undefined` preserving drizzle's default. `tsc --noEmit` clean

## Simplify pass

Ran the Step 2 fan-out as 5 agents (simplification · reuse · efficiency · altitude · primitive-catalogue)
— 26 findings: **13 fixed, 1 open (needs your call), 2 skipped, 5 dropped, 5 dismissed** (incl. one
earlier `/code-review` fix reverted as a proven false positive). All folded into `## Findings` above;
no separate report. `tsc --noEmit` clean · `eslint` clean on all 17 touched files · 65 unit tests green
across the 5 affected specs.

## Tests & suite

**Authored this gate:** nothing new is owed. Every Step 2 finding was a reuse / simplification /
efficiency / altitude cleanup — not a regression-test candidate — and each landed under a spec that
already covers its behaviour (65 tests green across `deposit-planes`, `off-plane-deposits`,
`clear-fields-for-type`, `payouts-by-worker`, `subcontractor-summary`).

The one Step 2 change that touches a **guard** rather than production behaviour is the `AXES`
generalization in the golden master. Its brutto half was already instrument-validated during Step 1
(perturb a seeded id → guard fires → re-seed → green); the kosztorys half asserts the same shape
through the same code path, off a premise verified directly against the fixture (`#7` is the sole
kosztorys-carrying investment).

**Suite: not run — awaiting the go-ahead.** `tsc --noEmit` clean, `eslint` clean on all 17 touched
files, 5 affected specs green. `pnpm test:e2e` stays off the table unless explicitly asked.
