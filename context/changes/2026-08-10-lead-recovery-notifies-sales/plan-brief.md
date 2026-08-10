# Recovered leads reach sales — Plan Brief

> Full plan: `context/changes/2026-08-10-lead-recovery-notifies-sales/plan.md`
> Deferred finding: `context/changes/2026-08-10-cron-lead-reconcile/review-gate.md` (EX-660)

## What & Why

The reconcile sweep stamps every lead it recovers `notifyStatus: 'skipped'` — a **terminal** state
meaning "we decided not to send". The sweep has no authority to decide that: it does not know
whether sales was told, and in fact sales was not. So a lead the webhook silently dropped is
recovered into the database and then hidden from the only people who could act on it. Worse,
`skipped` short-circuits `captureLead`, so a later webhook redelivery cannot rescue it either.

## Starting Point

Two paths write leads. The webhooks go through `captureLead`, which stores first and then runs two
independent channels — an internal notify to sales and a customer-facing auto-reply — recording a
per-channel status so Meta's retries never double-send. The backfill path (cron + the „Pobierz
zgłoszenia" button) bypasses all of that: it calls `storeLead` directly and hand-stamps both
channels `skipped`.

Earlier today a stopgap shipped on the EX-416 branch: the summary recovery mail now lists each
recovered lead's contact details, so a silenced lead is at least a call list rather than a number.
That was visibility, not a fix — and this change removes the reason it existed.

## Desired End State

The cron recovers 12 missed leads. Sales receives 12 ordinary „Nowe zgłoszenie" mails,
indistinguishable from webhook-delivered ones. No customer receives a days-late "Dziękujemy za
kontakt". Ops receives one summary mail whose message is the one that actually needs acting on:
the webhook is dead, check the token.

## Key Decisions Made

| Decision                        | Choice                                               | Why                                                                                                                                                             | Source     |
| ------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Which channel may be suppressed | Auto-reply only; notify never                        | A late notify to sales is always useful; a late auto-reply to a customer is embarrassing. Only the auto-reply decision is one a backfill can legitimately make. | Discussion |
| Where the decision lives        | Injected by the caller as an option on `captureLead` | The core owns the mechanism; only the caller knows _why_ it is running. Same split the sweep already uses for cache revalidation.                               | Discussion |
| Freshness window on auto-reply  | **No**                                               | A wrong threshold reintroduces exactly this defect, and the customer hears from sales regardless. Not worth the parameter.                                      | Plan       |
| Summary mail after the fix      | Ops-only, concise audit list                         | Sales now gets per-lead notifications, so the contact table is a duplicate; the mail returns to its real job as a "webhook is dead" signal.                     | Plan       |
| Branch                          | Same branch as EX-416 (PR #40 grows)                 | User's call — the files this touches have unmerged edits there.                                                                                                 | Plan       |

## Scope

**In scope:** `captureLead` options parameter; the sweep switching to `captureLead`; narrowing
`RecoveredLeadT`; reverting the recovery mail to an ops signal; the specs for all three.

**Out of scope:** any freshness window; a reaper for `pending` orphans older than Meta's window;
the webhook paths; Sentry wiring; E2E (no browser surface); backfilling leads already stamped
`skipped` in prod.

## Architecture / Approach

```
webhook  ──► captureLead(input)                          ──► notify ✔  auto-reply ✔
cron/btn ──► captureLead(input, { autoReply: 'skip' })   ──► notify ✔  auto-reply ✖ (skipped)
                                                              │
                                                              └─► summary mail ──► ops only
```

`captureLead` keeps sole ownership of the status writes. The sweep stops writing them, which is the
whole fix: it never again records a decision it did not make.

## Phases at a Glance

| Phase                        | What it delivers                                                 | Key risk                                                                                  |
| ---------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1. `captureLead` options     | Third parameter carrying `autoReply` policy + `skipRevalidation` | Defaults must leave both webhook callers byte-identical — guarded by their existing specs |
| 2. Sweep uses `captureLead`  | The `skipped` notify stamp is deleted                            | The sweep spec asserts the old stamp directly; it inverts rather than extends             |
| 3. Summary mail → ops signal | Recipient and copy revert; contact table drops                   | Partially reverts two commits from earlier today (expected — they were the stopgap)       |

**Prerequisites:** none — no migration, no schema change; `notifyStatus` already has every value needed.
**Estimated effort:** one session.

## Open Risks & Assumptions

- The cron now sends N mails per run instead of one. Each send writes its status immediately, so a
  mid-run crash will not re-send what already went out — but a large recovery batch is a heavier
  mail burst than today.
- If `notifyNewLead` fails for a recovered lead, it lands `notifyStatus: 'failed'` and surfaces
  nowhere except the admin panel. That is already true for webhook leads; this change extends the
  exposure rather than introducing it.
- Pending orphans older than Meta's 30-lead window remain stuck. Genuinely separate defect, not
  filed yet.

## Success Criteria (Summary)

- A lead recovered by the cron shows up in the sales inbox like any other lead.
- No customer receives an auto-reply from a backfill, at any lead age.
- The summary mail reads as an ops alert about the webhook, not as a call list.
