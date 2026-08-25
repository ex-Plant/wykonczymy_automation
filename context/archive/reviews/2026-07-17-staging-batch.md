# Review-gate ledger — branch `staging` batch → origin/staging · 2026-07-17

Unit of work: the **12 commits** `origin/staging (942f4df) .. HEAD (f800bfe)` — that day's fresh
batch on top of the last push to staging. 53 files, +751 / −395. No single 10x change folder →
fallback branch-diff scope.

Commits (EX): 3e90f50 EX-465 · ae0baf7 EX-464 · 3263436 EX-492 · d51acaf EX-440 ·
9dbe3b1 EX-445 · d2e93f4 EX-439 · 3db0724 leads-doc · 2c60752 EX-481 · 8f3f4ab EX-486/487 ·
92223f3 EX-496 · c554845 EX-482 · f800bfe EX-504.

Surviving checks (fan-out): `/code-review` (diff-scoped), `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit` (diff-scoped), `tailwind-v4-audit`,
`comment-noise-audit` (flag-only, diff-scoped). `/10x-impl-review` **dropped** — the batch has no
single anchoring `plan.md`.

Step 0.5 (browser verification): **skipped by user decision** (2026-07-17) — fan-out only.

**Trimmed at archive (2026-08-10).** The 9 `fixed` findings were removed: each one's durable record is
its commit, and a ledger line describing a change is strictly worse evidence than the change. What
survives is the negative space git cannot hold — what a reviewer looked at and chose **not** to act
on, and why. The two fixed findings that had first been _filed_ are kept in condensed form, since a
filing leaves no commit of its own. Moved here from the `.review-gate/` fallback path, which had no
lifecycle of its own.

Final tally before the trim: **9 fixed (2 of them previously filed), 4 dismissed, 2 dropped, 0 open.**

`/code-review` found **zero CRITICAL/WARNING correctness bugs**. It verified transactions
(EX-440/464), the localStorage store unification (EX-481, stale-closure fix confirmed), the sort
comparator (EX-486/487, all 13 computed cases match their renderers), optimistic revert (EX-496), the
`schema_version` gate (EX-439, drops no valid data), and the bulk-insert primitives (EX-504,
positional id remap preserved). feature-first, structure-scatter and tailwind: no findings — the
`types/` → `lib/kosztorys/` move RESOLVES prior scatter.

## Findings

- [x] fixed (was filed EX-522) · simplify(simplification) · `use-kosztorys-editor.ts` (~518/552/578/604) · 4 setting handlers shared the optimistic→await→refresh-or-rollback+toast skeleton. Extracted a **tail-only** `optimisticSettingSave(persist, revert, errorMessage)`; each handler keeps its own optimistic apply + pre-patch capture + `revert` closure, since revert semantics differ per handler.
      test: TDD · unit (renderHook) — owed under **EX-521** (the hook has no harness yet); the extraction is typecheck-guarded + behavior-preserving.
- [x] fixed (was filed EX-523) · simplify(altitude) · `with-payload-transaction.ts:16` · default `context = { skipRevalidation: true }` leaked kosztorys policy into the generic primitive; a future caller omitting the arg would silently inherit it. Default dropped (param now required); all 5 call sites pass it explicitly.
- [x] 🔵 OBSERVATION · dismissed · code-review · `investments.ts:88` · the guard redirects failed auth to `/zaloguj` vs the two pages' old `redirect('/')`. Verified an improvement (`/` itself requires auth; `/zaloguj` is the real login route other pages use). Intentional, no action.
- [x] dismissed · comment-noise · `create-json-map-store.ts:29` · FLAGGED borderline (catch-block comment vs the header) — kept as an intentional-swallow marker.
- [x] dismissed · comment-noise · `kosztorys.ts:19` · FLAGGED — the schema↔type "single source" note is load-bearing (the schema doesn't reference the type structurally); keep.
- [x] dismissed · feature-first + structure-scatter · `src/types/leads.ts` still holds a feature type while kosztorys colocates · both auditors raised this as a repo-wide convention divergence NOT introduced by this batch → out of scope, not filed (cosmetic, dropped as too minor to file).
- [x] dropped · simplify(reuse) · `ui/data-table/column-visibility-storage.ts` · pre-existing TanStack-table localStorage code could later delegate to the new `createJsonMapStore` primitive — out of scope (not in this diff), optional consolidation, dropped rather than manufacturing backlog.
- [x] dropped · simplify(simplification) · `use-kosztorys-editor.ts:166` · `reconcileSort(sort, …) !== sort` reads awkwardly; inlining the predicate would decouple the call site from the unit-tested helper. Minor readability, not worth the churn or the decoupling.

## Simplify pass

Ran `/simplify` — **2 applied** (`parseInvestmentId` extraction, `nextSectionDisplayOrder` dedup),
**2 deferred+filed** (EX-522 optimistic-save helper, EX-523 transaction default — both since fixed in
the follow-up pass, condensed above), **2 dropped**. No separate report file (agents returned inline).
The batch was already net-positive on all four angles — the loudest finding was duplication the
gate's own parallel-fetch fix had just introduced. typecheck clean after every edit.

## Tests & suite

**No tests authored this gate — recorded decision, not omission:**

- The batch's genuinely new logic shipped WITH its unit tests: `create-json-map-store.test.ts`
  (EX-481) + `kosztorys-sort-value.test.ts` (EX-486/487), both added in these 12 commits.
- `parseInvestmentId` (extracted this gate) — a 2-line id-validity guard lifted verbatim from two
  pages that already shipped without a unit test on it; no `next/navigation`/`notFound` mock harness
  exists in the suite. Standing one up for a 2-line guard is disproportionate (the same call the
  prior gate made on `handleRenameSection`). Disposition: no automated test.
- `nextSectionDisplayOrder` (extracted this gate) — behavior-preserving SQL extraction (identical
  query string), typecheck-guarded signatures. No new test owed.
- No new browser-level flow introduced; editor E2E obligations already filed EX-510/EX-511 (prior
  gate). No new E2E owed.

**Full suite (user chose fast legs: typecheck + lint + unit; e2e/build skipped):**

- [x] `pnpm typecheck` — clean.
- [x] `pnpm lint` — 0 errors, 85 warnings (all `src/migrations/*` unused-arg Payload boilerplate,
      pre-existing, not batch-authored). Pass.
- [x] unit suite — **1017 passed, 1 failed**. The 1 failure (`leads/notifications.db.test.ts`,
      off-by-one `expected 76 to be 77`) is **not this batch**: it touches zero leads logic and
      **passes 2/2 in isolation**. Cause = shared 5433 dev-DB cross-contamination between `.db`
      specs (known; the pre-push `test:integration` gate uses the isolated 5435 db-test). Not a
      merge blocker.
- [ ] `pnpm test:e2e` — skipped by user decision (no new browser flow this batch; editor E2E
      obligations already filed EX-510/EX-511).
- [ ] `pnpm build` — skipped by user decision (fast legs only).
