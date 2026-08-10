# Cron Lead Reconcile Implementation Plan

## Overview

Promote the existing manual lead-reconcile sweep to a scheduled daily cron, so a silent lead-delivery
failure self-heals instead of waiting for a human to notice something is wrong and click a button.

## Current State Analysis

The sweep itself already exists and is correct:

- `src/lib/actions/reconcile-leads.ts` — `reconcileLeads()`: lists forms, pulls `PER_FORM_LIMIT = 30`
  recent leads per non-empty form, parses each with `leadSchema`, stores via `storeLead`, and stamps
  a newly created row `notifyStatus: 'skipped'` / `autoReplyStatus: 'skipped'` so a late recovery
  never sends a customer "thanks for your inquiry" mail.
- `src/lib/leads/fetch-recent-leads.ts` — `listLeadForms()` / `fetchRecentLeads()` over the bulk
  `/leads` edge, which returns `field_data` inline (no second per-lead call).
- `src/components/leads/reconcile-leads-button.tsx` — the „Pobierz zgłoszenia" button.
- `src/__tests__/leads/reconcile-leads.test.ts` — existing spec coverage for the action.

Two facts shape the work:

1. **`reconcileLeads()` cannot be called from a cron.** It is `'use server'` and opens with
   `requireAuth(MANAGEMENT_ROLES)`; a Vercel cron carries `Authorization: Bearer $CRON_SECRET`, not a
   session, so the guard rejects it.
2. **The revalidation call is context-bound.** `revalidateCollection('leads')` defaults to
   `updateTag()`, which throws in a Route Handler (`AGENTS.md`, and the warning on
   `src/lib/cache/revalidate.ts:4`). A cron route must use `revalidateTag(CACHE_TAGS.leads, 'default')`.

The cron rail is already proven by `src/app/(payload)/api/cron/cleanup/route.ts`: `CRON_SECRET`
fail-closed auth (an unset secret rejects everything), `getPayload`, do work, return JSON. Its auth
gate is covered by `src/__tests__/lib/actions/cron-cleanup-route.test.ts`.

EX-416 step 1 (a System User → derived Page token, `expires_at: 0`) landed 2026-08-10 and removed
_expiry_ as a cause of lead loss. It did not remove _silence_.

## Desired End State

A daily cron sweeps Meta for leads the DB is missing and inserts them, and — when it actually
recovers something — emails `LEADS_ALERT_EMAIL`, because a recovery means the webhook is not
delivering and somebody needs to know. The manual button keeps working, unchanged from the user's
point of view.

Verified by: the route rejects an unauthenticated request; a run with a stubbed Graph inserts the
missing leads and sends exactly one alert; a run that finds nothing sends none.

### Key Discoveries:

- `reconcileLeads()` mixes three concerns — auth, sweep, revalidation — and only the middle one is
  reusable (`src/lib/actions/reconcile-leads.ts:34`).
- `storeLead` dedupes on `(source, externalId)` and returns `{ lead, created }`
  (`src/lib/leads/store-lead.ts:18`), so a cron re-running over the same 30 leads daily is idempotent
  by construction — no cursor or watermark needed.
- `notifyShapeAlert` (`src/lib/leads/notify.ts:59`) is the existing shape for an ops alert: plain HTML
  to `serverEnv.LEADS_ALERT_EMAIL`, no branded template. The new alert follows it, not the
  customer-facing `renderBrandedEmail` path.
- The sweep already skips forms with `leadsCount === 0`, so the daily Graph cost is bounded by the
  number of _active_ forms (currently 1 of 5).

## What We're NOT Doing

- **No `debug_token` expiry monitor** (EX-416 step 3). The live token reports `expires_at: 0`; a
  monitor for it would be dead code guarding a failure mode step 1 removed.
- **No change to the webhook path.** The `form_id` bug found on 2026-08-10 is logged on EX-416 and
  owes its own repro test — deliberately out of scope here.
- **No change to notify/auto-reply semantics.** Recovered leads stay `skipped`; the customer never
  hears from a backfill.
- **No cursor, watermark, or full-history backfill.** `PER_FORM_LIMIT = 30` per run stays as is.
- **No repointing of the Meta `callback_url`.** Separate item, tracked on EX-416.

## Implementation Approach

Split `reconcileLeads()` at its natural seam: the sweep body becomes a plain async function in
`src/lib/leads/`, and the two callers wrap it with what each context needs — the action adds auth and
`updateTag`, the cron route adds secret verification, `revalidateTag`, and the alert. Neither caller
duplicates sweep logic, so the button and the cron can never drift.

## Critical Implementation Details

**The revalidation call must not move into the extracted core.** `updateTag()` throws in Route
Handler context, so the core stays revalidation-free and each caller revalidates in its own idiom —
`revalidateCollection('leads')` in the action, `revalidateTag(CACHE_TAGS.leads, 'default')` in the
route. Putting either inside the core breaks the other caller at runtime, not at compile time.

---

## Phase 1: Extract the sweep core

### Overview

Move the sweep out of the server action into a context-free function both callers can use, with the
action's observable behavior unchanged.

### Changes Required:

#### 1. New sweep core

**File**: `src/lib/leads/reconcile-sweep.ts`

**Intent**: Hold the sweep body lifted verbatim from `reconcileLeads()` — list forms, skip empty ones,
fetch recent leads, parse, store, stamp `skipped` on newly created rows, count. No auth, no
revalidation, no `ActionResultT` wrapper; it throws on Graph failure and lets the caller decide.

**Contract**: `runLeadReconcileSweep(payload: Payload): Promise<{ added: number; scanned: number }>`.
Takes an already-resolved `Payload` so the caller owns `getPayload`. Keeps `PER_FORM_LIMIT` as a
module constant here.

#### 2. Action becomes a thin wrapper

**File**: `src/lib/actions/reconcile-leads.ts`

**Intent**: Reduce to its action-only concerns — `requireAuth(MANAGEMENT_ROLES)`, `getPayload`, call
the core, `revalidateCollection('leads')` when `added > 0`, and map a thrown error to
`{ success: false }` via `getErrorMessage`.

**Contract**: `reconcileLeads(): Promise<ReconcileLeadsResultT>` — unchanged signature and unchanged
result shape, so `reconcile-leads-button.tsx` needs no edit.

#### 3. Spec for the core

**File**: `src/__tests__/lib/leads/reconcile-sweep.test.ts`

**Intent**: Cover the sweep's own contract with Graph helpers and `storeLead` stubbed: skips forms
with `leadsCount === 0`, skips leads failing `leadSchema`, counts only newly created rows in `added`,
and stamps `skipped` statuses on a created row but not on an existing one.

**Contract**: Mirrors the source path per `AGENTS.md`. Mock boundaries match the existing
`src/__tests__/leads/reconcile-leads.test.ts`.

### Success Criteria:

#### Automated Verification:

- New sweep spec passes: `pnpm exec vitest run src/__tests__/lib/leads/reconcile-sweep.test.ts`
- Existing action spec still passes unchanged: `pnpm exec vitest run src/__tests__/leads/reconcile-leads.test.ts`

#### Manual Verification:

- „Pobierz zgłoszenia" in the app still reports the same added/scanned counts as before the split

---

## Phase 2: Cron route, schedule, and recovery alert

### Overview

Add the scheduled caller and make a non-zero recovery visible to the team.

### Changes Required:

#### 1. Recovery alert

**File**: `src/lib/leads/notify.ts`

**Intent**: Add an ops alert stating how many leads the sweep recovered and that a recovery implies
the webhook is not delivering. Sent only when `added > 0`. Best-effort like `notifyShapeAlert` — a
mail failure must not fail the cron, since the leads are already persisted.

**Contract**: `notifyReconcileRecovery(payload: Payload, context: { added: number; scanned: number }): Promise<void>`.
Plain HTML to `serverEnv.LEADS_ALERT_EMAIL`, Polish subject, no `renderBrandedEmail` (ops mail, not
customer mail).

#### 2. Cron route

**File**: `src/app/(payload)/api/cron/leads-reconcile/route.ts`

**Intent**: Mirror the cleanup route's shape — fail-closed `CRON_SECRET` check, `getPayload`, run the
sweep, `revalidateTag(CACHE_TAGS.leads, 'default')` and fire the alert when `added > 0`, return the
counts as JSON.

**Contract**: `GET(request: NextRequest)` → `200 { ok: true, added, scanned }`, or `401 { error: 'Unauthorized' }`
on a missing/mismatched bearer, or `500` when the sweep throws (a Graph outage must be a visible
failure, not a silent `ok: true`).

#### 3. Schedule

**File**: `vercel.json`

**Intent**: Add a second cron entry, daily, offset from the 03:00 cleanup so the two don't contend.

**Contract**: `{ "path": "/api/cron/leads-reconcile", "schedule": "0 4 * * *" }`.

#### 4. Route spec

**File**: `src/__tests__/app/(payload)/api/cron/leads-reconcile/route.test.ts`

**Intent**: Cover the auth gate (no header / wrong secret / unset `CRON_SECRET` all reject) and the
alert rule — alert fires once when `added > 0`, never when `added === 0`.

**Contract**: Mirrors the source path per `AGENTS.md`, with the mock strategy of
`src/__tests__/lib/actions/cron-cleanup-route.test.ts` (stub `@payload-config`, `payload`, and the
sweep core).

### Success Criteria:

#### Automated Verification:

- Route spec passes: `pnpm exec vitest run "src/__tests__/app/(payload)/api/cron/leads-reconcile/route.test.ts"`
- `vercel.json` holds exactly two cron entries with distinct paths

#### Manual Verification:

- Hitting `/api/cron/leads-reconcile` locally without a bearer returns 401
- Hitting it with the correct `CRON_SECRET` returns counts, and a run that recovers a lead delivers
  the alert mail to `LEADS_ALERT_EMAIL`
- The Vercel dashboard lists the new cron after deploy, and its first run logs a 200

---

## Testing Strategy

### Unit Tests:

- Sweep core: empty-form skip, schema-failure skip, `added` counts only created rows, `skipped`
  stamping applied to created rows only
- Cron route: fail-closed auth (three rejection cases), alert fires only on `added > 0`, sweep throw
  surfaces as 500

### Integration Tests:

None. Both new units are pure orchestration over already-covered pieces; `storeLead`'s DB behavior is
covered where it lives.

### Manual Testing Steps:

1. Click „Pobierz zgłoszenia" and confirm counts match pre-refactor behavior
2. `curl` the cron route with no header → 401
3. `curl` with `Authorization: Bearer $CRON_SECRET` → 200 with counts
4. Delete one recent lead row locally, re-run, and confirm it returns plus one alert mail

## Performance Considerations

One run costs one `leadgen_forms` call plus two calls per _active_ form (leads + questions). With one
active form that is three Graph calls a day — negligible against rate limits, and the reason daily is
sufficient rather than hourly.

## Migration Notes

None — no schema change, no data migration, no prod migration owed.

## Whole-tree Gate

Run once, after the final phase:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full suite passes: `pnpm test`
- Build succeeds: `pnpm build`

## References

- Ticket: EX-416 (step 2)
- Existing sweep: `src/lib/actions/reconcile-leads.ts`
- Cron pattern: `src/app/(payload)/api/cron/cleanup/route.ts`
- Revalidation split: `src/lib/cache/revalidate.ts:4`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Extract the sweep core

#### Automated

- [x] 1.1 New sweep spec passes — 85b44d73
- [x] 1.2 Existing action spec still passes unchanged — 85b44d73

### Phase 2: Cron route, schedule, and recovery alert

#### Automated

- [x] 2.1 Route spec passes — c8189d37
- [x] 2.2 `vercel.json` holds exactly two cron entries with distinct paths — c8189d37
