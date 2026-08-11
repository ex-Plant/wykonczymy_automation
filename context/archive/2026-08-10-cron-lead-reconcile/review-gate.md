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

_Trimmed at archive (2026-08-11): pre-trim tally **21 findings — 14 fixed, 5 dismissed, 1 dropped,
1 deferred+filed, 0 open**. The 14 `fixed` rows were dropped because a fix's durable
record is its commit; what survives below is the negative space git cannot hold — what we decided
NOT to do, and why._

- [x] 🔵 OBSERVATION · deferred, filed **EX-660** · `code-review` · `src/lib/leads/reconcile-sweep.ts:72` · the sweep
      stamps every recovered lead `notifyStatus/autoReplyStatus: 'skipped'`, so a lead submitted
      minutes before the 04:00 run — whose webhook delivery is merely queued for retry — is
      permanently silenced: sales never gets `notifyNewLead`, the customer never gets the auto-reply.
      Fixing it means a freshness window (e.g. only stamp `skipped` when `submittedAt` is older than
      N hours), which is a product decision about how late is "too late to auto-reply" — behavior
      changing and genuinely uncertain, so not auto-applied. Filed as **EX-660** (project Wykonczymy).
      test: TDD · unit — a lead inside the freshness window is not stamped `skipped`; recorded in EX-660
      **Mitigation shipped after the gate:** the recovery alert now lists each recovered lead's
      name/email/phone/form instead of a bare count, so a silenced lead is a call list rather than a
      number. The defect stands — EX-660 stays open for the freshness window.
      **Resolved 2026-08-11 (EX-660), and the freshness window was rejected outright.** Once the
      internal notify runs unconditionally, a threshold has nothing left to decide — only the
      customer-facing reply degrades with age, so `captureLead` grew an `autoReply: 'skip'` option
      and the sweep stopped stamping statuses at all. The mitigation above was reverted with it:
      contact details left the alert, since sales now gets each lead the ordinary way. Lesson kept
      in `context/foundation/lessons.md` ("A backfill may not write a terminal status…").
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
