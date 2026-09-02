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

- [x] 🟡 WARNING · skipped · impl-review · `kosztorys_v2/page.tsx` · existence now comes from the `unstable_cache`d reference list, which serves one stale payload after a tag bust — so an investment created seconds ago can 404 until the next request. Not fixed: the alternatives are a per-request existence read (exactly the duplication this slice removed) or rendering a nameless editor off a stale list, and the window is one self-healing request. Recorded in the code comment rather than hidden.
      test: no automated test — a one-request cache window is not reproducible at any layer we run
- [x] 🔵 · dismissed · impl-review + code-review · `kosztorys/page.tsx:20-24` · the sheet lookup is issued for a session the guard will redirect. Verified benign: no leak (the redirect discards the render) and no dangling rejection either — `Promise.all` subscribes to every promise synchronously, so a later rejection is consumed. Cost is one round trip on an unauthenticated request.
- [x] dismissed · feature-first-structure · 0 findings.
- [x] dismissed · structure-scatter · 0 findings — and it disproved the "seven pages repeat the guard" premise: only `inwestycje/[id]/page.tsx:29-30` is an exact duplicate, the rest redirect to `'/'` or use a different role set. No further extraction owed.
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

_Trimmed at archive (2026-09-02): 23 `fixed` finding(s) removed — a fixed finding's durable record is its commit; what survives is the negative space git cannot hold. Pre-trim tally: 23 fixed, 5 other, 0 open._
