# Review-gate ledger — branch `liner_issues_fixing` (vs `staging`) · 2026-08-24

Scope: 20 commits, 64 files, +3582/-691. Spans changes:
`2026-08-19-kosztorys-page-fetch-dedup` (EX-720), `2026-08-24-parity-gross-deposit-fixture` (EX-725),
plus EX-709 / EX-717 / EX-718 / EX-722 / EX-724 / EX-726.

Fan-out: impl-review · code-review · tailwind-v4 · feature-first · module-cohesion · structure-scatter · comment-noise (7/7 reported).
Step 0.5 (browser verification pass) skipped — not requested this turn.

## Findings

<!-- Format: [box] [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — reason
     Correctness findings carry a `test:` sub-line. Most-severe first. -->

### Correctness / safety

- [x] 🔴 CRITICAL · fixed · impl-review · `src/scripts/seed-deposit-planes.ts` + `src/__tests__/financial-golden-master-db.test.ts` · the golden master keys comparability on a `sig` that STARTS WITH the row `id`; the seed inserted its six rows with no explicit id, so every re-run drew fresh ids from `transactions_id_seq`. Investments #6 and #7 — the only two carrying wpłaty brutto — hashed differently than the fixture, landed in `dataMoved`, and were `continue`d past the whole figure comparison. `pnpm test:parity` was green having compared **zero** of the brutto plane. Fixed in both halves: the seed writes a reserved fixed id block (`900_001+`, explicit ids never advance the sequence) and wipes on the marker ALONE so a moved target can't strand the previous run's rows; the spec now asserts the brutto axis in the **compared set**, not merely present in the DB. Re-verified end to end: 3-step reset → seed twice (`usunięto 6, wstawiono 6`, same ids) → `test:golden:update` → `test:parity` green with nothing skipped
      test: test-driven-debugging · integration — instrument validated by perturbing one seeded id in db-test: the guard failed with „1 of the fixture's wpłata-brutto investments fell out of the compared set", then went green on re-seed
- [x] 🟡 WARNING · fixed · code-review · `src/components/kosztorys/summary/tabs/summary-expenses-tab.tsx:82` · `hasBilledMaterials` tested the SUM of `materialsBreakdown` against zero; a CORRECTION cancelling a category (+500/−500) hid a non-empty breakdown behind „Brak wydatków inwestycyjnych na materiały.". Now `materialsBreakdown.length > 0` — keeps impl-review F5's aggregate-not-rows source, closes the hole
      test: no automated test · unit — the fix reduces the predicate to a bare length check and the repo has no component renderer (deliberate: React-free logic lives in `lib/`)
- [x] 🟡 WARNING · fixed · impl-review · `src/scripts/seed-deposit-planes.ts:72-79` · no DB-target guard; the unprefixed invocation the header advertised resolved to the **dev DB on 5433**, an exported prod URL to Neon. Now `SELECT current_database()` refuses anything but `wykonczymy-test`
      test: no automated test — the `current_database()` assert IS the guard
- [x] 🟡 WARNING · fixed · impl-review · `src/__tests__/lib/kosztorys/replace-tree-lost-write.test.ts` · no per-`it` timeout on a spec that deliberately holds `SELECT … FOR UPDATE` across two connections inside the serial integration leg. `{ timeout: 30_000 }` added, with the reason: a Payload upgrade taking `FOR KEY SHARE` on the second connection would otherwise hang the pre-push hook forever with no output
      test: no automated test — the timeout IS the guard
- [x] 🔵 OBSERVATION · dismissed (fix reverted) · code-review · `src/app/(frontend)/inwestycje/[id]/kosztorys/page.tsx:30` · claimed `Promise.all([requireInvestmentOr404(id), sheetIdPromise])` leaves `sheetIdPromise` unhandled when the guard's control-flow throw settles first. **False.** `Promise.all` attaches a rejection handler to every element synchronously at call time, and nothing awaits between `sheetIdPromise`'s creation and the `Promise.all` — so there is no window in which it is handler-less. Verified empirically in node (`caught: NEXT_NOT_FOUND`, no unhandled-rejection line). Step 2 flagged the applied `.catch(() => {})` as ceremony whose comment stated a rule that is false; both reverted
      test: no automated test — there is no defect to guard
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/__tests__/lib/auth/require-management-page.test.ts:7` · `redirect` was a bare `vi.fn()` returning `undefined`, so the guard **resolved** on the failure paths — the spec would still have passed if someone swapped `redirect(...)` for `return null as never`, sending an EMPLOYEE into the editor. The mock now throws `NEXT_REDIRECT` as the real one does, and both failure specs assert `.rejects.toThrow`. 4/4 green
      test: test-driven-debugging · unit — the hardened mock is the regression guard
- [x] 🟡 WARNING · fixed (toast, not the code set) · code-review · `src/lib/kosztorys/replace-tree-with-snapshot.ts:34` · `23505` sits in `CONCURRENT_WRITE_CODES`, so a **deterministic** unique violation was reported to the owner as „Ktoś zmieniał ten kosztorys w tym samym czasie". Ruled (owner): keep the retry set, fix the message. Investigating the reachable sources killed the proposed tree-validation: none of the three callers can post a dupe (`clearKosztorysAction` posts an empty tree, `reloadFromPresetAction` a payload serialized out of rows already under those constraints, the import assigns its own ordinals), and the deterministic `23505` that DID happen came from a half-succeeded bulk wipe — already fixed at source by one raw `DELETE` per table (`restore-kosztorys.ts:33`). So the only real harm was a message asserting a cause the pg code cannot prove: now `REPLACE_FAILED`, stating only that nothing was written and a retry is safe. Diagnosis is unaffected — the `console.error` below carries the code and constraint name (TODO EX-449)
      test: no automated test · unit — a toast string with no branch behind it; the `23505` path's real guard is `restore-replaces-whole-tree.test.ts`, which asserts the wipe cannot half-succeed
- [x] 🔵 OBSERVATION · dismissed (accepted, owner) · code-review · `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:39` · the existence check moved from a live `findByID` to the tag-cached `fetchReferenceData()`; a just-created investment can 404 on a valid URL during the staleness window. Accepted as the documented trade-off — the window is one request wide, self-heals, and the fix if it ever bites is a targeted `updateTag` on create, not a per-load query over 114 rows
      test: no automated test — cache-staleness window, an accepted trade-off not a guard
- [x] 🔵 OBSERVATION · fixed (semantics confirmed + pinned) · impl-review · `src/lib/transfers/clear-fields-for-type.ts` · EX-709 widened behaviour beyond the reported bug: the old handler reset ALL conditional fields on type change, the new one blanks only fields the new type doesn't carry — so switching between two types that both carry `sourceRegister` keeps the kasa, and between two settleable types keeps `settled`. Ruled intended (owner, 2026-08-24): the user should not re-enter a pick the new type still carries. Two cases added pinning it on `CORRECTION` ↔ `INVESTMENT_EXPENSE` (both settleable, both carry a kasa), so the unconditional clear cannot creep back — 12/12 green
      test: TDD · unit — retention semantics now asserted, not merely the patch shape

### Fixture / process integrity

- [x] fixed · impl-review · `src/__tests__/fixtures/financial-golden-master.json` · the earlier regeneration rebaselined 110 of 112 investments with 19 non-deposit figures moving, accepted unreviewed. Superseded: regenerated from a clean 3-step reset after the F1 fix, and this run moved **no figure at all** — the entire diff is inputHashes for `6`, `7` (fixed ids now) and `633` (a leftover investment from an earlier shared-DB spec run, gone with the fresh import), plus register `5`'s hash and `kosztorysItemCount 1001 → 1000`. Zero register/worker figure churn
- [x] fixed · impl-review · `context/foundation/manual-checks.md:1452` · the EX-720 section documented the db-test reset as **two** steps in the very branch whose `AGENTS.md` establishes it as **three** — corrected to name `pnpm seed:deposits:test`
- [x] fixed · impl-review · `context/changes/2026-08-24-parity-gross-deposit-fixture/plan.md` Phase 2 · plan specified `payload.create`; all six rows ship as raw SQL. Amendment note added with the reason (`afterChange` syncs to the owner's LIVE sheet, `afterDelete` has no `skipSheetSync`) plus the fixed-id/marker-wipe contract — so nobody "restores consistency" by writing fixture rows into the production sheet
- [x] fixed · impl-review · `context/changes/2026-08-19-kosztorys-page-fetch-dedup/plan.md` Phase 3 · the row-sourced gate the plan specified was an outright defect (`materialTransactions` is optional and `InvestmentSummaryPanel` never supplies it); amendment note added recording the shipped gate
- [x] dismissed · impl-review · plan B criterion 4.2 · "`pnpm lint` czyste" is `[x]` but lint exits 1 — both errors (`src/hooks/use-latest-request.ts:15`, untracked root `test.js:255`) are pre-existing and outside the diff, already recorded in EX-720's own `review-gate.md`

### Structure / placement

- [x] fixed · feature-first + scatter (2 audits converge) · `clear-fields-for-type.ts` · React-free transfer-domain logic, and the only flat source file under `components/forms/`. Moved with its spec to `src/lib/transfers/` (`__tests__/lib/transfers/`)
- [x] fixed · module-cohesion · `src/lib/db/sum-transfers.ts` · dead compat re-export of `deriveCategoryBreakdowns`/`deriveFinancials` deleted; all 6 consumers repointed at `@/lib/db/investment-financials`
- [x] fixed · module-cohesion · `src/lib/db/sum-transfers.ts` · the three un-summed row fetchers split out to `get-deposit-transactions.ts` / `get-payout-transactions.ts` — the names the test mirror was already using for sources that didn't exist. 410 → 314 LOC
- [x] fixed · module-cohesion · `src/lib/queries/investments.ts` · pure `isInvestmentId`/`parseInvestmentId` extracted to `lib/queries/investment-id.ts` (the module the spec already mirrored); the spec drops its `payload`/`@payload-config` stubs and keeps only `notFound`
- [x] fixed · scatter (adjacent) · `src/lib/queries/investments.ts` · `requireInvestmentOr404` now calls `requireManagementPage` instead of inlining its body
- [x] fixed · module-cohesion · `src/lib/kosztorys/deposit-planes.ts` · off-plane/stranded diagnostics split to `off-plane-deposits.ts`, next to `off-plane-deposit-copy.ts`; its specs split to match (11 + 18 green)
- [x] fixed · module-cohesion · `src/lib/kosztorys/replace-tree-with-snapshot.ts` · `CONCURRENT_WRITE_CODES`/`isConcurrentWrite` moved to `lib/db/with-payload-transaction.ts` and generalized (the comment no longer says „the wipe below"). `MAX_ATTEMPTS` and the Polish toast stay at the caller — those are kosztorys policy and copy, not Postgres infra
- [x] fixed · reuse (tailwind audit) · `src/components/tables/investments.tsx` · the twice-written `inline-flex items-center justify-end gap-1` + `LabelHintIcon` pair is now a local `HintedValue`, matching the file's existing `NoKosztorysData`/`NotApplicable` convention
- [x] dismissed · module-cohesion · `src/lib/queries/balances.ts` · 13 exports held together by the caching mechanism rather than a domain, but every export is a uniform `unstable_cache` map — trajectory flag only, splitting now is churn
- [x] dismissed · feature-first · 11 of 12 added/renamed files · correct homes; all 6 new specs mirror their source path in full

### Comments

- [x] fixed · comment-noise + impl-review F7 · `src/scripts/seed-deposit-planes.ts` · every comment was Polish against AGENTS.md's English-comments rule. Translated (not deleted — the content is load-bearing) and the header now also documents the identity-idempotency contract and the DB guard
- [x] fixed · comment-noise · `src/types/transfers.ts` · `SubcontractorPayoutRowT`'s comment read the type expression aloud — replaced with why the query never joins workers
- [x] fixed · comment-noise · `src/scripts/seed-deposit-planes.ts` · `// Kwota brutto z faktury.` over `amount` deleted in the rewrite
- [x] fixed · comment-noise · JSDoc leads re-saying the function name, trimmed to the why: `lib/auth/require-management-page.ts`, `lib/kosztorys/payouts-by-worker.ts`, `lib/queries/investment-transactions.ts`, `lib/db/get-payout-transactions.ts`, `lib/db/get-deposit-transactions.ts`, `__tests__/lib/db/get-payout-transactions.test.ts` (vanished-prior-state), `lib/kosztorys/replace-tree-with-snapshot.ts` (diff-relative „Now"), `components/kosztorys/summary/settlement-plane-warning.tsx`, `types/transfers.ts`, `lib/kosztorys/off-plane-deposits.ts`, `__tests__/financial-golden-master-db.test.ts`
- [x] fixed · comment-noise · `deposit-form.tsx` + `expense-form.tsx` · the „blanked, not reset" why was argued at 4 sites; both call sites are now bare pointers to `clear-fields-for-type`, which keeps the argument
- [x] fixed · comment-noise · `types/transfers.ts` + `payouts-by-worker.ts` · the null-worker payout rationale was argued in 3 homes; both now point at `get-payout-transactions.ts`, the query that actually omits the `worker_id IS NOT NULL` guard
- [x] dropped · comment-noise · `__tests__/financial-golden-master-db.test.ts` · `DATASET_FLOOR` carries 3 stacked block comments, all load-bearing — accretion smell only, merging is churn
- [x] dismissed · comment-noise · `settlement-plane-warning.tsx:9` · vanished-prior-state about a deleted `WarningBanner` — pre-existing on `staging`, not this branch
- [x] skipped · comment-noise · `__tests__/lib/transfers/clear-fields-for-type.test.ts` · deploy-state snapshot goes stale once prod catches up — kept, it explains why #4302 was bookable at all

### Step 2 — simplify / reuse / efficiency / altitude (5-agent fan-out)

- [x] fixed · altitude · `src/components/tables/investments.tsx:37` + `shape-investments.ts` + `types/table-rows.ts` · `hasKosztorysReading` re-derived „does this investment have a kosztorys" as `totalLaborCosts !== 0`. But „pomiar z natury" IS the etap sum (EX-494), so a rozpiska entered in full but not yet started sums to zero and was indistinguishable from no kosztorys at all — four v2 columns printed „brak danych" over real data and the v1/v2 rozjazd icon was suppressed exactly where a fresh kosztorys most needs flagging. Fixed at the source of the fact rather than at the cell: `selectKosztorysClientTotals` returns a row **iff** the investment has ≥1 item, `shapeInvestments` now holds that entry before flattening it and carries `hasKosztorys` on `InvestmentRowT`; the predicate reads it. Ruled by the owner (2026-08-24) since it changes what the listing shows
      test: TDD · unit — the spec that pinned the defect („cannot tell an absent kosztorys from one that sums to zero") inverted to assert the two now differ on presence and on nothing else; a second case keys presence by id. Red first (2 failing), then 24/24 green
- [x] fixed · reuse · `src/app/(frontend)/inwestycje/[id]/page.tsx:29` · inlined `requireManagementPage()`'s body verbatim — the last management page outside the helper this diff moved the others onto. Now calls it, so the „logged out ≠ error screen" redirect target has one home
- [x] fixed · reuse · `src/app/(frontend)/inwestycje/[id]/page.tsx:39` · `Number(id)` where `parseInvestmentId` exists — the module this diff created explicitly to own that rule. Also stops two queries firing against `investment: { equals: NaN }` before the later `notFound()`
- [x] fixed · reuse · `src/lib/kosztorys/investor-impact.ts:26` · re-declared `{count, amount}` inline instead of importing `StrandedDepositsT`, the named type this diff introduced for exactly that pair
- [x] fixed · reuse · `src/lib/kosztorys/payouts-by-worker.ts` + `subcontractor-summary.ts` · the three-branch worker-name fallback (incl. the literal `'Nieznany pracownik'`) was written twice, for two tables that render one above the other off the same roster. Extracted `resolveWorkerName`
- [x] fixed · reuse · `src/lib/kosztorys/off-plane-deposit-copy.ts:21` + `investor-impact.ts:31` · the same `['wpłata','wpłaty','wpłat']` declension triple in both sentences about the same rows on the same event. Exported `depositNoun`
- [x] fixed · reuse · `src/__tests__/helpers/deposit-rows.ts` (new) · the `cash`/`untagged`/`transfer` builders were copied verbatim into the second spec when `off-plane-deposits` was split out. Both specs assert the same module family, so divergeable fixtures would let them disagree about what a wpłata is
- [x] fixed · reuse · `src/components/kosztorys/summary/tabs/summary-expenses-tab.tsx:12` · dead `roundToCents` import left by the `hasBilledMaterials` rewrite — the only lint warning in the changed set
- [x] fixed · altitude · `src/__tests__/financial-golden-master-db.test.ts:436` · the compared-set coverage guard was hard-wired to the brutto axis while the kosztorys axis has the identical hole. Verified against the fixture: the kosztorys axis rests on **one** investment (`#7`), which survives only because it happens to also carry brutto — a coincidence that dies the moment a seed puts the two on different investments. Now an `AXES` table (name · figures guarded · re-seed command · `carriedBy`), so adding an axis is a row
- [x] fixed · simplify · `src/lib/queries/investments.ts:53` · `requireInvestmentOr404` returned a `user` field no caller reads. Dropped; the guard is still called for its redirect
- [x] fixed · simplify · `src/lib/kosztorys/replace-tree-with-snapshot.ts:61` · the retry wrapper destructured all six `OptionsT` fields only to rebuild the identical object for `attemptReplacement`. Passes `options` through
- [x] fixed · simplify · `src/lib/transfers/clear-fields-for-type.ts:39` · `staleFieldsForType(type, fields)` had exactly one possible argument, and `EXPENSE_CONDITIONAL_FIELDS` was a **third** parallel list of the same four keys already spelled in `EMPTY_VALUE` and `CARRIED_BY`. Param and constant dropped; the keys come off `CARRIED_BY`
- [x] fixed · efficiency · `src/__tests__/lib/db/deposit-plane-sums.test.ts:58` · N+1 introduced by this diff — one serial `getDepositTransactionsForInvestment` per investment over a **114-investment** fixture, on every pre-push run. Now one `Promise.all`; the comparison stays row-by-row
- [x] fixed · efficiency · `src/__tests__/financial-golden-master-db.test.ts:261` · three independent aggregates awaited serially (this diff added the third), directly below a block already using `Promise.all`. Folded into one
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

Owed before archive: the 4 open `[ ]` boxes are decisions, not work — each needs a ruling before its
test can be written.
