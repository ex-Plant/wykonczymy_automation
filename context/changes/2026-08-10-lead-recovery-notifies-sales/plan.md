# Recovered leads reach sales — Implementation Plan

## Overview

The reconcile sweep stamps every recovered lead `notifyStatus: 'skipped'`. That is a **terminal**
state meaning "we decided not to send", and the sweep has no authority to decide it — it does not
know whether sales was told. The consequence: a lead the webhook never delivered is silently
invisible to the sales team, and because `skipped` short-circuits `captureLead`, a later webhook
redelivery cannot rescue it either.

This change stops the sweep from writing that state. Recovered leads go through `captureLead` with
the **auto-reply** channel suppressed, so sales gets a normal per-lead "Nowe zgłoszenie" while the
customer gets no days-late "Dziękujemy za kontakt". The summary recovery mail then reverts to the
role it was built for: an ops signal that the webhook is dead.

Filed as **EX-660**, deferred out of the EX-416 review gate.

## Current State Analysis

Delivery today has two paths into `leads`:

| Path                                          | Entry point                | Notify        | Auto-reply |
| --------------------------------------------- | -------------------------- | ------------- | ---------- |
| Webhook (`facebook-leads`, `wpforms`)         | `captureLead`              | sent          | sent       |
| Backfill (cron + „Pobierz zgłoszenia" button) | `storeLead` + manual stamp | **`skipped`** | `skipped`  |

`captureLead` (`src/lib/leads/capture-lead.ts:42`) gates both channels on `pending`:

```ts
const runNotify = created || lead.notifyStatus === 'pending'
const runAutoReply = created || lead.autoReplyStatus === 'pending'
if (!runNotify && !runAutoReply) return { lead, created }
```

So `skipped` is terminal by construction. That is correct behaviour for a settled channel — it is
what stops Meta's retries from re-mailing a customer — but it means the sweep's stamp permanently
closes the notify channel for a lead nobody was ever told about.

`runLeadReconcileSweep` (`src/lib/leads/reconcile-sweep.ts:96-112`) does the stamping itself, then
collects each recovered lead's full contact details so the summary mail can carry them. That
detail-carrying was a **stopgap** shipped earlier today (`86be52a2`, `ea4088b0`) precisely because
the mail was the only place a silenced lead surfaced. This change removes the reason for it.

### Key Discoveries

- `captureLead` does **not** currently forward `skipRevalidation` to `storeLead`
  (`capture-lead.ts:40`), and its own `payload.update` (`capture-lead.ts:63`) has no
  `context: { skipRevalidation: true }`. The sweep needs both — it does one revalidation for the
  whole run, and the collection's `afterChange` hook would otherwise fire per lead.
- `captureLead` has exactly two existing callers, both webhooks
  (`src/app/(frontend)/api/webhooks/facebook-leads/route.ts:108`,
  `src/app/(frontend)/api/webhooks/wpforms/route.ts:68`). Neither changes behaviour.
- The sweep has two consumers — the cron route and the server action behind „Pobierz zgłoszenia"
  (`src/lib/actions/reconcile-leads.ts:26`). The change hits both identically: the manual button
  also stops silencing sales.
- `notifyStatus`/`autoReplyStatus` already carry every value needed (`pending`/`sent`/`failed`/
  `skipped`). **No migration, no schema change.**
- Free side-effect: a lead orphaned at `pending` by a crash between store and status-write is
  currently never revisited, because the sweep bails on `if (!created) continue`. Routing through
  `captureLead` makes the sweep retry its pending channels — so any orphan still inside Meta's
  30-lead window self-heals. This does **not** discharge the general pending-reaper problem (an
  orphan older than the window stays stuck); that stays out of scope.

## Desired End State

The cron runs, finds 12 leads the webhook missed, and:

- sales receives 12 ordinary „Nowe zgłoszenie" mails, indistinguishable from webhook-delivered ones;
- no customer receives an auto-reply;
- ops receives one summary mail: "webhook nie dowozi, sprawdź token", with a concise list of what
  was recovered as an audit trail;
- a webhook redelivery of any of those 12 mails nobody a second time — `notifyStatus: 'sent'` and
  `autoReplyStatus: 'skipped'` are both terminal, so `captureLead` returns early.

Verified by: the unit suite, plus one manual run of „Pobierz zgłoszenia" against a lead present in
Meta but absent from the local DB.

## What We're NOT Doing

- **No freshness window.** A lead recovered 6 minutes after submission still gets no auto-reply.
  Decided: the cost of a wrong threshold is exactly the defect being fixed, and the customer will
  hear from sales anyway.
- **No pending-orphan reaper.** Sweeping `pending` leads older than the Meta window is a separate
  defect and a separate change.
- **No change to the webhook paths.** `facebook-leads` and `wpforms` keep today's behaviour.
- **No Sentry work.** The existing `TODO(EX-449) SENTRY-REQUIRED` markers stay as they are.
- **No E2E.** This slice has no browser surface — cron, mail, and a server action already covered
  at unit level.

## Implementation Approach

Inject the auto-reply decision as a **policy the caller supplies**, rather than teaching
`captureLead` about backfills. `captureLead` owns the mechanism (store-then-notify, retry,
per-channel status); the caller owns the question "does it still make sense to thank this customer?",
because only the caller knows why it is running. Same split the sweep already uses for cache
revalidation, and for the same reason: the core cannot know its own calling context.

## Phase 1: `captureLead` takes an options argument

### Overview

Give `captureLead` a third parameter carrying the auto-reply policy and `skipRevalidation`, with
defaults that leave both webhook callers byte-identical in behaviour.

### Changes Required

#### 1. Capture core

**File**: `src/lib/leads/capture-lead.ts`

**Intent**: Accept per-call options so a backfill caller can suppress the customer-facing channel
and bypass the per-row revalidation hook, without any caller being able to suppress the _sales_
channel — that one is not negotiable and gets no option.

**Contract**:

```ts
export type CaptureLeadOptionsT = {
  /** 'skip' stamps autoReplyStatus 'skipped' without sending — for backfills, where a
   *  days-late "Dziękujemy za kontakt" is worse than none. Notify has no such option. */
  autoReply?: 'send' | 'skip'
  skipRevalidation?: boolean
}

export async function captureLead(
  payload: Payload,
  input: StoreLeadInputT,
  options?: CaptureLeadOptionsT,
): Promise<{ lead: Lead; created: boolean }>
```

Defaults `{ autoReply: 'send', skipRevalidation: false }`. `skipRevalidation` forwards to
`storeLead`'s existing options **and** onto the trailing `payload.update` as
`context: { skipRevalidation: true }`. When `autoReply: 'skip'` and the channel is eligible to run,
the status resolves to `'skipped'` with no send attempted — the existing phone-only branch already
produces that value, so the two collapse into one path.

#### 2. Capture-core spec

**File**: `src/__tests__/leads/capture-lead.test.ts`

**Intent**: Pin the two properties the rest of the change leans on — that `autoReply: 'skip'` never
sends to the customer but always attempts the sales notify, and that the option cannot leak into the
notify channel.

**Contract**: New cases alongside the existing ones: (a) `{ autoReply: 'skip' }` on a created lead →
`sendAutoReply` not called, `notifyNewLead` called once, final statuses `sent`/`skipped`;
(b) default options → today's behaviour unchanged (guards the two webhook callers);
(c) `{ skipRevalidation: true }` reaches both `storeLead` and the `payload.update` context.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/leads/capture-lead.test.ts` passes
- `pnpm exec vitest run src/__tests__/leads/webhook-route.test.ts src/__tests__/leads/wpforms-route.test.ts` passes unchanged (the default-options guard)

#### Manual Verification

- None for this phase — no caller uses the new option yet.

---

## Phase 2: The sweep captures instead of storing-and-stamping

### Overview

Replace `storeLead` + the manual `skipped` stamp with `captureLead(…, { autoReply: 'skip',
skipRevalidation: true })`, and narrow `RecoveredLeadT` to what the ops mail still needs.

### Changes Required

#### 1. Sweep core

**File**: `src/lib/leads/reconcile-sweep.ts`

**Intent**: Stop writing a terminal notify state the sweep has no authority to write; let
`captureLead` decide each channel from what actually happened. Delete the `payload.update` stamp
block entirely — it becomes dead once `captureLead` owns the status write.

**Contract**: `storeLead(payload, input, { skipRevalidation: true })` →
`captureLead(payload, input, { autoReply: 'skip', skipRevalidation: true })`. `if (!created)
continue` stays — it guards the `recovered` list, not the notification (a redelivered lead's pending
channels are now `captureLead`'s business, not the sweep's).

`RecoveredLeadT` narrows to `Pick<Lead, 'id' | 'name' | 'formName' | 'submittedAt'>` — the ops mail
is an audit trail, not a call list, so `email`/`phone` no longer belong in it.

The docblock's "Backfill is SILENT by design: it stores via `storeLead` (never `captureLead`)"
becomes false and must be rewritten to state the new rule: silent to the **customer**, never to
sales.

#### 2. Sweep spec

**File**: `src/__tests__/lib/leads/reconcile-sweep.test.ts`

**Intent**: The existing spec asserts the exact `payload.update` stamp — including the comment
explaining why `overrideAccess` is load-bearing. That assertion is now wrong; replace it with the
`captureLead` call contract.

**Contract**: Mock `@/lib/leads/capture-lead` in place of `@/lib/leads/store-lead`. Assert
`captureLead` is called with `{ autoReply: 'skip', skipRevalidation: true }`, and that no direct
`payload.update` stamp happens. Update the `recovered` shape case to the narrowed type.

#### 3. Downstream consumers of the result shape

**File**: `src/app/(payload)/api/cron/leads-reconcile/route.ts`,
`src/lib/actions/reconcile-leads.ts`, `src/components/leads/reconcile-leads-button.tsx`

**Intent**: These read `recovered.length` only, so they need no logic change — but the narrowed
`RecoveredLeadT` must typecheck through them, and the two specs that build `recoveredLead(id)`
fixtures need their fixtures narrowed to match.

**Contract**: Fixture factories in `src/__tests__/app/(payload)/api/cron/leads-reconcile/route.test.ts`
and `src/__tests__/leads/reconcile-leads.test.ts` drop `email`/`phone`.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/lib/leads/reconcile-sweep.test.ts` passes
- `pnpm exec vitest run src/__tests__/leads/reconcile-leads.test.ts` passes
- `pnpm exec vitest run "src/__tests__/app/(payload)/api/cron/leads-reconcile/route.test.ts"` passes
- Mutation check: revert `autoReply: 'skip'` to the default in place and confirm a spec goes red

#### Manual Verification

- Delete one lead locally that still exists in Meta's recent window, click „Pobierz zgłoszenia", and
  confirm the sales inbox receives an ordinary „Nowe zgłoszenie" for it. **Caution:** this sends a
  real mail to `LEADS_NOTIFY_EMAIL` and reads live Meta data.
- Confirm the customer address receives nothing for that lead.
- Confirm the recovered row in the admin panel shows `notifyStatus: sent`, `autoReplyStatus: skipped`.

---

## Phase 3: The summary mail reverts to an ops signal

### Overview

Sales now gets each lead individually, so the summary mail's contact table is a duplicate. Return it
to `LEADS_ALERT_EMAIL` with a concise audit list and copy that is true again.

### Changes Required

#### 1. Recovery alert

**File**: `src/lib/leads/notify.ts`

**Intent**: `notifyReconcileRecovery` goes back to a single ops recipient and drops the claim that it
is "the only trace" — which stops being true the moment Phase 2 lands. It keeps the count, a concise
per-lead line (name / form / date), the saturation warning, and the "check the token" instruction.

**Contract**: `to: serverEnv.LEADS_ALERT_EMAIL` (not the array). Per-lead rows narrow to name,
formName, submittedAt — no email, no phone. The bold "Ten mail to jedyny ślad — odezwij się do nich
ręcznie" paragraph is replaced with one stating that sales already received a normal notification for
each and that the actionable item here is the **webhook**, not the leads. The docblock's EX-660
paragraph is rewritten to record the new division of labour.

#### 2. Notify spec

**File**: `src/__tests__/leads/notify.test.ts`

**Intent**: The `notifyReconcileRecovery` block currently asserts both recipients and the presence of
email/phone in the body. Both assertions invert.

**Contract**: `expect(arg.to).toBe('ops@example.com')`; assert the body contains the lead's name and
form but **not** its email or phone; keep the escaping case and the derive-count-from-list case.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/leads/notify.test.ts` passes
- Mutation check: restore the second recipient in place and confirm the spec goes red

#### Manual Verification

- The manual sweep from Phase 2 delivers exactly one summary mail, to the ops address only, and its
  body no longer instructs the reader to call the leads by hand.

---

## Testing Strategy

### Unit Tests

- `captureLead` under each option combination, including the default that guards the webhook callers
- The sweep's call contract into `captureLead` (mocked), and that it no longer stamps statuses itself
- `notifyReconcileRecovery` recipient and body contents

### Integration Tests

None added. `notifications.db.test.ts` and `store-lead.db.test.ts` cover the persistence layer this
change does not touch.

### Manual Testing Steps

1. Confirm a lead exists in Meta's recent window but not in the local DB (delete it locally if needed).
2. Click „Pobierz zgłoszenia" in the dashboard.
3. Sales inbox: one „Nowe zgłoszenie" for that lead.
4. Customer address: nothing.
5. Ops inbox: one summary mail, ops-only, no contact details, no "call them yourself" instruction.
6. Admin panel: the row shows `notifyStatus: sent`, `autoReplyStatus: skipped`.

## Migration Notes

None — no schema change. Leads already stamped `skipped` by previous cron runs stay stamped; this
change does not backfill them. If any exist in prod, they were surfaced by the stopgap mail from
`86be52a2` and are handled by hand.

## Whole-tree Gate

Run once, after Phase 3.

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## References

- Deferred finding: `context/changes/2026-08-10-cron-lead-reconcile/review-gate.md` (EX-660 line)
- Redelivery/idempotency rationale: `src/lib/leads/store-lead.ts:32-46`
- Webhook silent-failure background: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: `captureLead` takes an options argument

#### Automated

- [x] 1.1 capture-lead spec passes — adad7f1e
- [x] 1.2 webhook-route + wpforms-route specs pass unchanged — adad7f1e

### Phase 2: The sweep captures instead of storing-and-stamping

#### Automated

- [x] 2.1 reconcile-sweep spec passes — 8da9ca7e
- [x] 2.2 reconcile-leads spec passes — 8da9ca7e
- [x] 2.3 cron route spec passes — 8da9ca7e
- [x] 2.4 Mutation check: reverting `autoReply: 'skip'` turns a spec red — 8da9ca7e

### Phase 3: The summary mail reverts to an ops signal

#### Automated

- [x] 3.1 notify spec passes
- [x] 3.2 Mutation check: restoring the second recipient turns a spec red
