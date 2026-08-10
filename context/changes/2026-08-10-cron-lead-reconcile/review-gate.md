# Review-gate ledger — cron-lead-reconcile · 2026-08-10

Slice: EX-416 step 2 — daily cron backstop for the Meta lead webhook.
Branch: `konradantonik/ex-416-cron-lead-reconcile` · worktree `.claude/worktrees/cron-lead-reconcile`
Base: `main` · 3 implementation commits (`85b44d73`, `c8189d37`, `4bd5d100`)

Checks in the fan-out: `10x-impl-review`, `code-review`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit`.
Dropped: `tailwind-v4-audit` (no UI in the diff), Step 0.5 verification pass (no
`verify-manual-checks` skill in this install).

`10x-impl-review` returned **no CRITICAL and no WARNING** — the code matches the plan,
the extracted core is behavior-identical to the pre-split action line for line, and every
Progress row's claim is true. Everything below came from `code-review` and the structural
audits, i.e. bugs the plan never specified.

## Findings

- [x] 🔵 OBSERVATION · deferred, filed **EX-660** · `code-review` · `src/lib/leads/reconcile-sweep.ts:72` · the sweep
      stamps every recovered lead `notifyStatus/autoReplyStatus: 'skipped'`, so a lead submitted
      minutes before the 04:00 run — whose webhook delivery is merely queued for retry — is
      permanently silenced: sales never gets `notifyNewLead`, the customer never gets the auto-reply.
      Fixing it means a freshness window (e.g. only stamp `skipped` when `submittedAt` is older than
      N hours), which is a product decision about how late is "too late to auto-reply" — behavior
      changing and genuinely uncertain, so not auto-applied. Filed as **EX-660** (project Wykonczymy).
      test: TDD · unit — a lead inside the freshness window is not stamped `skipped`; recorded in EX-660
- [x] 🟡 WARNING · fixed · `code-review` · `src/app/(payload)/api/cron/leads-reconcile/route.ts:33` ·
      a permanently failing cron was as silent as the broken webhook it exists to detect — a thrown
      sweep logged to `console.error` and 500'd with no mail. When the Page token dies (a dated risk:
      the pre-EX-416 token expired Sep 2026) the webhook and the sweep fail for the same reason, so
      leads are lost for weeks with zero alerts. Added `notifyReconcileFailure`, fired best-effort on
      the failure path; the 500 stays for Vercel's own signal.
      test: TDD · unit — sweep rejects → 500 **and** a failure alert was attempted
- [x] 🟡 WARNING · fixed · `code-review` · `src/lib/leads/reconcile-sweep.ts:36` · the per-form loop
      had no error isolation, so one form's Graph failure killed every form after it **and** discarded
      the leads already stored from earlier forms (the throw skipped both revalidation and the recovery
      alert). A rate-limit on form #3 meant forms #4..N were never swept — and, since form order is
      stable, never swept on any later day either. Each form's Graph work is now wrapped; failures are
      collected into `failedForms` and the sweep returns partial results instead of throwing.
      test: TDD · unit — form A succeeds with 1 lead, form B rejects → `added: 1` and B listed in `failedForms`
- [x] 🟡 WARNING · fixed · `code-review` · `src/lib/leads/reconcile-sweep.ts:10` · `PER_FORM_LIMIT = 30`
      was sized for a human clicking a button; as an unattended daily sweep it is a hard ceiling of 30
      recoverable leads per form per day with **no signal when it is hit**. A form taking 45 leads during
      a webhook outage loses the 15 oldest permanently, while the alert reads "Odzyskane: 30 z 30" —
      indistinguishable from a healthy full recovery. The sweep now flags a form whose page came back
      full (`saturatedForms`) and the alert says so. Pagination itself is deliberately not added.
      test: TDD · unit — a form returning exactly `PER_FORM_LIMIT` leads surfaces the saturation flag
- [x] 🔵 OBSERVATION · fixed · `code-review` + `impl-review` ·
      `src/app/(payload)/api/cron/leads-reconcile/route.ts:20` · `getPayload({ config })` sat outside
      the `try`, so a Payload/DB init failure escaped the handler's own catch — no
      `[cron/leads-reconcile]` log line, no controlled 500 body, and (after the fix above) no failure
      alert either. Moved inside the `try`. Same latent issue exists in the cleanup cron, left alone.
      test: no automated test — the branch is a one-line placement, and its observable effect (a
      logged, alerted 500) is already covered by the sweep-throws case
- [x] 🔵 OBSERVATION · fixed · `code-review` ·
      `src/__tests__/app/(payload)/api/cron/leads-reconcile/route.test.ts` · the spec mocked
      `next/cache` but never asserted `revalidateTag`, so deleting the revalidation call left all 7
      tests green while the leads dashboard served a stale cache after every recovery — leads
      recovered, nothing visible. Now asserted on both the recovery and the clean-run case.
      test: TDD · unit — the assertion IS the fix
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/__tests__/lib/leads/reconcile-sweep.test.ts:60` ·
      the `payload.update` assertion used `objectContaining` without `overrideAccess: true`, so dropping
      that flag stayed green — yet in the cron context there is no `req.user`, the leads collection's
      `update: isAdminOrOwnerOrManager` rule would reject the write, the lead would stay
      `notifyStatus: 'pending'`, and a later webhook redelivery would send the customer a days-late
      "Dziękujemy za kontakt". Now pinned.
      test: TDD · unit — the assertion IS the fix
- [x] fixed · `feature-first-structure` + `code-review` ·
      `src/app/(payload)/api/cron/leads-reconcile/route.ts:14` · the fail-closed `CRON_SECRET` gate was
      a byte-for-byte copy of the cleanup cron's, comment included — two homes for one security
      primitive. Extracted to `src/lib/cron/verify-cron-request.ts`; both crons call it, and its
      fail-closed contract now has a single spec instead of two duplicated 401 blocks.
- [x] fixed · `structure-scatter` · `src/__tests__/lib/actions/cron-cleanup-route.test.ts` · the two
      cron route specs sat in mutually exclusive homes; the pre-existing one was filed under
      `lib/actions/` though its subject is neither a lib module nor an action. AGENTS.md states the
      mirror rule outright, so the new spec's location is the rule and the old one was the outlier —
      moved to `src/__tests__/app/(payload)/api/cron/cleanup/route.test.ts`.
- [x] fixed · `structure-scatter` · `src/__tests__/leads/reconcile-leads.test.ts` · after the split this
      spec still asserted the sweep's contract through the action, duplicating 3 of the new core spec's
      cases and mocking three modules the action no longer imports. Keeping it unchanged was the plan's
      proof of behavior identity; that proof has served its purpose, so it is now trimmed to what the
      action actually owns — auth rejection, `revalidateCollection` gating, error shaping — mocking the
      sweep directly.
- [x] fixed · `code-review` · `src/app/(payload)/api/cron/leads-reconcile/route.ts:31,35` · two
      `console.error` calls destined for Sentry lacked the `// TODO(EX-449) SENTRY-REQUIRED:` marker
      AGENTS.md prescribes. The sweep-failure log is the strongest candidate in the repo for one — it is
      the only record that the backstop itself is dead.
- [x] fixed · `impl-review` · `src/lib/actions/reconcile-leads.ts:12` · the action re-declared the sweep's
      `{ added, scanned }` payload instead of composing `ActionResultT<ReconcileSweepResultT>`; the two
      would have silently drifted the moment the sweep's result grew — which it did, in this very pass.
- [x] fixed · `comment-noise` · `src/lib/leads/reconcile-sweep.ts:8` · "How many recent leads to pull per
      form" restates `PER_FORM_LIMIT` + its call site; only the sentence explaining the _value_ survives
      the strip test.
- [x] fixed · `comment-noise` · `src/__tests__/lib/leads/reconcile-sweep.test.ts:5` · the header's
      "Contract under test:" enumeration was a table of contents of the `it()` titles below it — it would
      drift the moment a case was added. The clauses that are genuinely invisible in the code (the shared
      caller, the deliberately-unmocked schema/normalize path) stay.
- [x] fixed · `impl-review` · `context/changes/2026-08-10-cron-lead-reconcile/plan.md:82,113` · the plan's
      Contract named `revalidateCollections(['leads'])`; the real helper is `revalidateCollection('leads')`.
      Drift in the plan, not the code — corrected so the archived record can't send a future reader
      "fixing" the code toward a helper the action never used.
- [x] dismissed · `code-review` ·
      `src/__tests__/app/(payload)/api/cron/leads-reconcile/route.test.ts:44` · "fails closed when
      CRON_SECRET is unset" asserts the vitest env stub's lazy proxy, not the real `env/server`, which
      parses eagerly and would throw at import. Both behaviours are fail-closed, there is no reachable
      hole, and the case mirrors the pre-existing cleanup spec — benign, and now owned by the shared
      `verify-cron-request` spec anyway.
- [x] dismissed · `structure-scatter` · `src/__tests__/lib/leads/reconcile-sweep.test.ts` · flagged as a
      second home for leads specs versus the legacy `src/__tests__/leads/`. The audit reported that no
      mirror rule is written down; it is — AGENTS.md's Testing section states it explicitly, in full,
      with an example. The new file follows the rule and the 13 legacy files are the outliers; migrating
      them is its own change, not this slice's.
- [x] dismissed · `feature-first-structure` ·
      `src/app/(payload)/api/cron/leads-reconcile/route.ts` · flagged as possibly belonging in
      `(frontend)` alongside the lead webhook. False positive: placement here goes by handler kind, and
      `(payload)/api/cron/` is the established cron home. Moving it would create the scatter.
- [x] dismissed · `module-cohesion` · `src/lib/leads/notify.ts` · flagged for mixing ops alerts with the
      customer-facing auto-reply. The seam is real but pre-existing, and this diff added to the ops side
      — 129 LOC and 4 (now 5) exports against thresholds of 400 and 6. Splitting costs more than it
      returns until a second customer-facing template appears.
- [x] dismissed · `module-cohesion` · `src/lib/leads/reconcile-sweep.ts:12` · `ReconcileSweepResultT`
      beside its function tripped the mixes-kinds heuristic; it is the function's own return contract,
      which the skill counts as one kind.
- [x] dropped · `comment-noise` · `src/app/(payload)/api/cron/leads-reconcile/route.ts:11` · half
      framework narration, half the load-bearing fact that the schedule lives in `vercel.json`. Rewording
      to save four words isn't worth the churn.

## Simplify pass

Ran `/simplify` over the slice — findings folded into `## Findings` above tagged by source; no separate
list. `primitive-reuse-scan` ran as part of the same mutating pass: its only hit was the duplicated cron
auth gate, already recorded above as fixed.

## Tests & suite

Test count over the slice went 17 → 29 across five specs (sweep 5→9, cron route 7→7 but rewritten,
action 5→5 rewritten, plus a new 5-case spec for the shared cron auth gate).

Each new guard was **mutation-checked** — the fix was reverted in place and the spec confirmed to go
red, so none of them is a test that would pass on broken code:

| Mutation                                        | Failing spec                     |
| ----------------------------------------------- | -------------------------------- |
| per-form `catch` rethrows instead of collecting | 2 failed (partial-failure cases) |
| `overrideAccess: true` dropped from the stamp   | 1 failed (silent-backfill case)  |
| saturation flag never set                       | 1 failed (saturation case)       |
| failure alert not sent on a thrown sweep        | 1 failed (route failure case)    |

Whole-tree gate, run once after the fixes:

- `pnpm typecheck` — clean
- `pnpm lint` — 0 errors, 87 warnings (all pre-existing, none in touched files)
- `pnpm test` — 868 passed, 29 skipped (69 files passed, 12 skipped)
- `pnpm build` — succeeded; both `ƒ /api/cron/cleanup` and `ƒ /api/cron/leads-reconcile` present
- `pnpm test:e2e` — not run; this slice has no browser surface (see below)

**E2E obligation: none owed.** The slice adds a cron Route Handler and a lib module — no new UI flow.
The one UI touch is a toast string in `reconcile-leads-button.tsx`, which carries no multi-boundary
browser risk.
