# Cron Lead Reconcile — Plan Brief

> Full plan: `context/changes/2026-08-10-cron-lead-reconcile/plan.md`

## What & Why

Lead delivery from Meta can fail silently: the webhook path logs a `console.error` and nothing else, so
a lost lead looks exactly like a quiet day. The recovery already exists — the „Pobierz zgłoszenia"
button sweeps Meta and inserts whatever the DB is missing — but it only runs when a human already
suspects something is wrong, which is precisely what a silent failure prevents. Put that sweep on a
daily schedule and make a non-zero recovery send mail.

## Starting Point

`reconcileLeads()` (`src/lib/actions/reconcile-leads.ts`) lists the page's lead forms, pulls the 30 most
recent leads per non-empty form, stores what's missing, and stamps every recovered row
`notifyStatus: 'skipped'` / `autoReplyStatus: 'skipped'` so a late backfill never mails a customer.
The cron rail exists too — `src/app/(payload)/api/cron/cleanup/route.ts` with `CRON_SECRET` fail-closed
auth, plus one entry in `vercel.json`.

EX-416 step 1 landed 2026-08-10: a System User → derived Page token with `expires_at: 0`. That removed
_expiry_ as a cause of lead loss. It did not remove _silence_ — revocation, app restriction, a Graph
outage, or a `callback_url` still pointing at a dev tunnel lose leads the same way.

## Desired End State

A daily cron runs the same sweep the button runs. When it recovers nothing, it is silent. When it
recovers anything, `LEADS_ALERT_EMAIL` gets mail, because a recovery is evidence the webhook is not
delivering. The button behaves exactly as before.

## Key Decisions Made

| Decision      | Choice                                               | Why                                                                                                           |
| ------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Cadence       | Daily, 04:00                                         | Meta retries a failed webhook for ~36h on its own; daily lands inside that window and costs 3 Graph calls/day |
| Placement     | Own route `/api/cron/leads-reconcile`                | Independent failure domain from cleanup — a Graph outage must not look like a snapshot-GC failure             |
| Alerting      | Mail only when `added > 0`                           | Otherwise the cron silently patches a broken webhook forever and nobody learns the webhook is broken          |
| Token monitor | Dropped                                              | The live token reports `expires_at: 0` — a monitor would guard a failure mode step 1 already removed          |
| Code shape    | Extract the sweep core; action and cron both call it | `reconcileLeads()` opens with `requireAuth`, which a cron can never satisfy — and the two must not drift      |
| Revalidation  | Stays in the callers, not the core                   | `updateTag()` throws in a Route Handler; the route needs `revalidateTag` — a runtime split, not a typed one   |
| Idempotency   | None added                                           | `storeLead` dedupes on `(source, externalId)`, so re-sweeping the same 30 leads daily is already a no-op      |

## Scope

**In scope:**

- `src/lib/leads/reconcile-sweep.ts` — the sweep body, context-free
- `reconcileLeads()` reduced to auth + call + `revalidateCollections`
- `/api/cron/leads-reconcile` route with fail-closed `CRON_SECRET` auth
- `notifyReconcileRecovery` in `src/lib/leads/notify.ts`
- Second `vercel.json` cron entry
- Unit specs for the sweep core and the route

**Out of scope:**

- The `form_id` bug — `GET /{leadgen_id}` without `?fields` never returns it, so the webhook path
  persists empty `formId`/`formQuestions`. Logged on EX-416; owes its own repro test.
- Repointing the Meta `callback_url` (still unverified whether prod or a dev ngrok tunnel)
- Any change to notify / auto-reply semantics, or to `PER_FORM_LIMIT`
- A token-expiry monitor (EX-416 step 3)

## Architecture / Approach

Split at the seam that already exists inside `reconcileLeads()`: auth, sweep, revalidation. Only the
middle is reusable, so it moves to `src/lib/leads/` as a plain `(payload) => { added, scanned }`
function that throws on failure. Each caller then adds only what its context requires — the action adds
`requireAuth` and `updateTag`, the route adds the bearer check, `revalidateTag`, and the alert. Nothing
about the sweep is duplicated, so the button and the cron cannot diverge.

The load-bearing constraint is the revalidation split: `updateTag()` is Server-Actions-only and throws
in a Route Handler. TypeScript will not catch it, so the core stays revalidation-free by rule.

## Phases at a Glance

| Phase                          | What it delivers                           | Key risk                                                              |
| ------------------------------ | ------------------------------------------ | --------------------------------------------------------------------- |
| 1. Extract the sweep core      | Reusable sweep; button behaviour unchanged | A silent behaviour change in the lift — existing spec must pass as-is |
| 2. Cron route, schedule, alert | Scheduled run + mail on recovery           | Revalidating with the wrong helper, which fails only at runtime       |

**Prerequisites:** none — no migration, no schema change, no new env var (`CRON_SECRET` and
`LEADS_ALERT_EMAIL` both already exist in all environments).
**Estimated effort:** one session across both phases.

## Open Risks & Assumptions

- Assumes the token minted on 2026-08-10 keeps its permissions. If Meta revokes them the cron starts
  returning 500 daily — visible in Vercel logs, but nothing pages anyone.
- The alert fires on _every_ recovery, including a legitimately late Meta delivery the webhook would
  have caught. Expected to be rare; if it turns noisy, the threshold moves off `> 0`.
- `PER_FORM_LIMIT = 30` bounds one run. An outage losing more than 30 leads on one form inside 24h
  would need a manual sweep or a limit bump — accepted at current volume (~94 leads lifetime on the
  only active form).
- Whether the webhook currently reaches prod at all is still unverified. The cron makes that question
  answerable — a steady stream of `added > 0` alerts is the answer.

## Success Criteria (Summary)

- A lead that never reached the webhook is in the DB within 24h, without anyone clicking anything
- Recovering a lead produces mail; a clean run produces nothing
- The route rejects any caller without the shared secret, including when the secret is unset
