# Review-gate ledger — kosztorys-page-fetch-dedup (EX-720) · 2026-08-24

Scope: commits `f6a759fa`, `85275f84`, `07797100`, `6b37c4bf`, `a09d4e39` on `liner_issues_fixing`.
Deliberately **not** the branch diff against `staging` — a parallel agent's work (deposit planes,
replace-tree, migration `20260824_0_drop_kosztorys_client_view_hidden_columns`) sits on the same
working tree and is not this slice's.

Checks that survived detection: `/10x-impl-review` (plan.md present), code review (diff-scoped,
read-only), `comment-noise-audit` (flag-only), the three file-organization audits (merged into one
agent — the structural surface is one new module and one renamed export).
Dropped: `tailwind-v4-audit` — the slice changes no styling.
Step 0.5 verification pass: **not run** — `verify-manual-checks` drives a browser against the app;
the slice's manual checks are registered in `context/foundation/manual-checks.md` and are the
archive blocker, unticked.

## Findings

Correctness findings carry a `test:` sub-line; structural/comment cleanups do not.

- [x] 🔴 CRITICAL · fixed · impl-review + code-review · `(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:75` · `if (!investment) notFound()` was unreachable — `getKosztorysTree` throws for a missing investment from inside the `Promise.all` two statements earlier, so a bad id rendered `error.tsx` (and per `lessons.md:1336` still answered 200) instead of the 404 page. Phase 1 removed the only branch that could win that race. Existence now resolves BEFORE the fan-out.
      test: test-driven-debugging · e2e — page-level ordering, only observable as a response status; filed EX-728
- [x] 🔴 CRITICAL · fixed · impl-review · `components/kosztorys/summary/tabs/summary-expenses-tab.tsx:83` · Phase 3 moved `hasBilledMaterials` onto `materialTransactions`, which is optional and which `InvestmentSummaryPanel` never supplies — so on `/inwestycje/<id>` → Podsumowanie → „Wydatki" the breakdown table vanished and „Brak wydatków" printed over an investment with real wydatki. The numeric equivalence the plan relied on holds only given the same rows; it does not hold when one plane's rows are absent. Gate now reads `materialsBreakdown` — the array the two gated blocks actually render.
      test: test-driven-debugging · e2e — prop-wiring across a host boundary, invisible below the render; filed EX-728 (+ manual check added for that host)
- [x] 🟡 WARNING · skipped · impl-review · `kosztorys_v2/page.tsx` · existence now comes from the `unstable_cache`d reference list, which serves one stale payload after a tag bust — so an investment created seconds ago can 404 until the next request. Not fixed: the alternatives are a per-request existence read (exactly the duplication this slice removed) or rendering a nameless editor off a stale list, and the window is one self-healing request. Recorded in the code comment rather than hidden.
      test: no automated test — a one-request cache window is not reproducible at any layer we run
- [x] 🟡 WARNING · fixed · impl-review · `types/transfers.ts:58-66` · both docblocks still described the deleted `GROUP BY` query, "the page enriches" and an editor prop chain that Phase 2 removed — the exact failure this change's own `lessons.md` entry warns about, committed two commits before that entry was written. Rewritten to describe `derivePayoutsByWorker`.
      test: no automated test — comment accuracy
- [x] 🟡 WARNING · fixed · impl-review · `__tests__/lib/db/get-payout-transactions.test.ts` · the spec deleted in Phase 2 was the only one asserting the payout `WHERE` excludes cancelled rows, non-`PAYOUT` types and other investments' payouts — and that WHERE now feeds both the wypłaty list and „Pozostało do wypłaty", so one dropped predicate moves money on two surfaces with zero test pressure. Ported the exclusions onto the surviving spec (6 rows inserted, 3 returned — instrument validated).
      test: test-driven-debugging · integration — DB-backed, asserts the query's own filter semantics
- [x] 🔵 · fixed · code-review · `summary-expenses-tab.tsx:85` · `isEmpty` suppressed „Brak wydatków" on the strength of `listedTransactions`, a block itself gated on `showTransactions` — a host that hides the list would render the tab completely blank. Term is now `!(showTransactions && listedTransactions.length > 0)`. Behaviour-identical on today's hosts; correct under a future one.
      test: no automated test — folded into the same render path as EX-728's second scenario
- [x] 🔵 · fixed · code-review · `kosztorys/page.tsx:17-19` · "reads with overrideAccess and never throws" overstated — `payload.find` still rejects on a DB failure. Reworded to the claim that is actually true: no access-control throw of its own.
- [x] 🔵 · fixed · code-review · `kosztorys_v2/page.tsx:31-32` · "requireAuth is a `cache()`d JWT decode with no round trip" is false on a cold instance (`getSecretKey()` → `getPayload({config})`) — an unverified perf claim in a comment, in the slice whose own lesson is about exactly that. Claim deleted rather than re-derived.
- [x] 🔵 · fixed · impl-review · `plan.md:369` · criterion 4.1's literal grep never passes (hits survive in `context/reference/superpowers/archive/**`, another in-flight change's docs, and the plan quoting itself). Criterion amended to `src/**` with the exclusion stated, instead of leaving a checked box whose stated test fails.
- [x] 🔵 · fixed · impl-review · `plan.md:47` · "seven reads instead of nine" — the pre-change array held 8 promises and the old `[PERF]` string was already wrong. Amended; delivered end state is refData up front + a 5-promise fan-out.
- [x] 🔵 · fixed · impl-review · `__tests__/lib/auth/require-management-page.test.ts:29` · `resolves.toBeUndefined()` pinned the mock's fall-through, not the guard's contract (the real `redirect` throws `NEXT_REDIRECT`; the double returns). Replaced with a bare `await` — which still fails if the guard throws — leaving `expect(redirect).toHaveBeenCalledWith('/zaloguj')` as the assertion that matters.
- [x] 🔵 · fixed · impl-review · `context/foundation/manual-checks.md` · the wydatki checks only ever exercised the editor host, so the 🔴 above would have passed every one of them. Added a line for the investment-page Podsumowanie.
- [x] 🔵 · dismissed · impl-review + code-review · `kosztorys/page.tsx:20-24` · the sheet lookup is issued for a session the guard will redirect. Verified benign: no leak (the redirect discards the render) and no dangling rejection either — `Promise.all` subscribes to every promise synchronously, so a later rejection is consumed. Cost is one round trip on an unauthenticated request.
- [x] fixed · module-cohesion · `lib/kosztorys/payout-worker-names.ts` · filename stopped describing the module once the export became `derivePayoutsByWorker` and the headline job became grouping + summing. Renamed to `payouts-by-worker.ts` (+ spec, + 3 import sites).
- [x] dismissed · feature-first-structure · 0 findings.
- [x] dismissed · structure-scatter · 0 findings — and it disproved the "seven pages repeat the guard" premise: only `inwestycje/[id]/page.tsx:29-30` is an exact duplicate, the rest redirect to `'/'` or use a different role set. No further extraction owed.
- [x] fixed · comment-noise · `require-management-page.test.ts:18-21` · deleted — third copy of the redirect-vs-throw rationale, written as vanished state.
- [x] fixed · comment-noise · `kosztorys_v2/page.tsx` (payout + deposit promises) · deleted — restated the function names.
- [x] fixed · comment-noise · `kosztorys_v2/page.tsx:72-73` · deleted with the block the 🔴 fix removed.
- [x] fixed · comment-noise · `payouts-by-worker.test.ts:30-31` · deleted — duplicated the source's null-bucket rationale.
- [x] fixed · comment-noise · `payouts-by-worker.test.ts:52-53` · deleted — "Float addition is new here — the old figure was a SQL SUM" is textbook vanished state.
- [x] fixed · comment-noise · `summary-expenses-tab.tsx` · the flagged comment was replaced wholesale by the 🔴 fix.
- [x] fixed · comment-noise · `require-management-page.ts:8-15` · trimmed — kept the contract, dropped the `Promise.all` race retelling.
- [x] fixed · comment-noise · `payouts-by-worker.ts:9-18` · trimmed — the history of the deleted query became a forward-looking directive ("never re-split this").
- [x] fixed · comment-noise · `db/kosztorys-tree.ts:18-25` · 8 lines → 5. The measurement transcript was vanished state wearing evidence as a costume; kept the directive, the bimodal-latency quirk and the archive citation.
- [x] fixed · comment-noise · `db/sum-transfers.ts:341-346` · trimmed the trailing names-resolve-at-the-block sentence (also newly inaccurate).
- [x] fixed · comment-noise · `queries/investment-transactions.ts:20-22` · trimmed to the load-bearing half — why no `users` tag.
- [x] dropped · comment-noise · cross-cutting · the 5 commits created 3 new duplications (null-worker why ×4, redirect-vs-throw ×3, "rows feed both the list and the Σ" ×3). The deletions above collapse each to one home; the two surviving null-worker copies guard two different mechanisms (a missing SQL predicate, a grouping that could fold the bucket) and are kept deliberately.

## Simplify pass

Findings above are the simplify pass — this gate's mutating step ran as the fix-first triage rather than
as a separate `/simplify` invocation, and every applied edit is one checkbox in `## Findings` (sources
`comment-noise` / `module-cohesion`). No held-back proposals: nothing was left in a "needs your call"
state.

## Tests & suite

- Whole-tree gate already run at end of implementation (before this review):
  `pnpm typecheck` green · `pnpm test` 2705 passed / 143 skipped · `pnpm build` green ·
  `pnpm test:parity` green · `pnpm lint` **2 errors, both pre-existing and outside this slice**
  (`src/hooks/use-latest-request.ts` "Cannot access refs during render", last touched by `8e47fb80`;
  gitignored root `test.js`). Re-run after `/simplify`.
- Re-run after the gate's fixes: `pnpm typecheck` green · `pnpm test` **2705 passed / 146 skipped** ·
  `pnpm test:parity` green · `pnpm build` green. The DB-backed `get-payout-transactions.test.ts` was
  run against the 5435 `db-test` container directly (2 passed) — the new exclusion case inserts 6 rows
  and asserts 3 come back, so the instrument is validated rather than vacuously green.
  `pnpm lint` not re-run: its 2 errors are the same pre-existing ones outside this slice, and no lint
  rule touches the edits made here.
- **Not run:** `pnpm test:e2e` — never run unprompted (~1h). The two browser-level guards this gate
  found are filed as **EX-728** (`e2e-backlog`), not silently dropped.
