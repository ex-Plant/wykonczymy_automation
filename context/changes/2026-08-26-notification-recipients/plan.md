# Notification recipients move from env vars to a DB list, edited in the app — Implementation Plan

## Overview

Four notification streams currently address themselves from env vars, one address each. They become
three DB-backed lists that hold **more than one person**, are **visible on the page whose
notifications they are**, and are edited **in the app** — never in `/admin`.

The four env vars (`FLEET_NOTIFICATION_EMAIL`, `ADMIN_EMAIL`, `LEADS_NOTIFY_EMAIL`,
`LEADS_ALERT_EMAIL`) are dropped at the end. `LEADS_REPLY_FROM` stays: it is a **from**-address, an
SPF/DKIM-authenticated sender identity, not a recipient list.

## Current State Analysis

### The four env vars and their five senders

| Stream       | Sender                    | File                          | Today's `to:`                                                       |
| ------------ | ------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| Fleet digest | `notifyFleetDigest`       | `src/lib/fleet/notify.ts:84`  | `[FLEET_NOTIFICATION_EMAIL, ADMIN_EMAIL]` — one send, two addresses |
| Nowy lead    | `notifyNewLead`           | `src/lib/leads/notify.ts:22`  | `LEADS_NOTIFY_EMAIL`                                                |
| Ops alert    | `notifyShapeAlert`        | `src/lib/leads/notify.ts:60`  | `LEADS_ALERT_EMAIL`                                                 |
| Ops alert    | `notifyReconcileRecovery` | `src/lib/leads/notify.ts:90`  | `LEADS_ALERT_EMAIL`                                                 |
| Ops alert    | `notifyReconcileFailure`  | `src/lib/leads/notify.ts:141` | `LEADS_ALERT_EMAIL`                                                 |

`sendAutoReply` (`src/lib/leads/notify.ts:170`) is **out of scope** — it mails the lead, from
`LEADS_REPLY_FROM`.

Only two distinct addresses exist across all four vars today, and they are **the same on every
environment** (owner, 2026-08-26): `bartek@wykonczymy.com.pl` and `admin@wykonczymy.com.pl`. So the
seed is a literal, not a read of anything.

### Throwing on an empty list is free

Every ops-alert call site already `.catch()`-wraps its send — `wpforms/route.ts:47,61`,
`facebook-leads/route.ts:82,102`, `leads-reconcile/route.ts:29,40,70` — and the fleet cron
`try`-wraps (`api/cron/fleet-reminders/route.ts:32`). `notifyNewLead` already throws by design so the
caller flips `notifyStatus`. A sender that throws on an empty list therefore needs **no new error
handling anywhere**.

### The storage precedent

`KosztorysClientViewDefaults` (`src/globals/kosztorys-client-view-defaults.ts`) is the repo's only
Payload **global** — exactly one row, registered at `src/payload.config.ts:97`, its table hand-written
into `src/migrations/20260815_0_add_kosztorys_client_view.ts:30-41`. Its write path is already a
server action, not `/admin`: `saveClientViewDefaultsAction`
(`src/lib/actions/kosztorys-client-view.ts:57-82`) does `findGlobal` → `updateGlobal` inside
`ownerOnlyAction`. That is the pattern this change copies wholesale.

### The two mount points

Both target pages are already `MANAGEMENT_ROLES`-gated and both already fetch through
`Promise.all([markSeen(…), fetch…()])`:

- `src/app/(frontend)/flota/page.tsx` — `PageWrapper title="Flota"` → `Description` → `FleetDataTable`
- `src/app/(frontend)/zgloszenia/page.tsx` — `PageWrapper title="Zgłoszenia"` → `Description` → `LeadsDataTable`

So "who can see the list" needs no new gate — it is whoever can already open the page. Editing
narrows further to admin/owner via `ownerOnlyAction`, which takes its own `forbiddenMessage` and is
therefore reusable as-is.

### Key Discoveries

- **`STREAMS` is already taken.** `src/lib/db/notifications.ts` exports `STREAMS` for the unread-badge
  read cursors (`fleet`, `leads`) — a different concept. The new constant is named
  `RECIPIENT_LISTS` / `RecipientListT` to keep the two from being read as one.
- **A `minRows: 1` array field IS the "can't be empty" validation** — Payload enforces it on
  `updateGlobal` regardless of caller, so it holds even though the write comes from our action rather
  than `/admin`.
- **`findGlobal` on an unseeded global returns defaults, not an error** — `minRows` cannot fire on a
  row that was never created. That is precisely why the migration seeds the row, and why the sender's
  own throw is still the backstop rather than redundant.
- **`line-items-field.tsx`** (`src/components/forms/form-fields/`) is the existing repeatable-rows
  field; the recipients editor mirrors it rather than inventing an add/remove idiom.
- Payload array subtables follow `<parent>_<field>` with `_order` / `_parent_id` / `id varchar PK`
  columns plus an FK and two indexes — see `users_sessions` in
  `src/migrations/20260211_202001.ts:5-11,72,77-78`.

## Desired End State

`/flota` shows who gets the deadline digest. `/zgloszenia` shows who gets „nowy lead" and who gets the
technical alerts. Any of the three lists holds one or more addresses and can be edited in place by an
admin/owner, without opening `/admin`. All five senders address themselves from those lists, and a
stream with nobody in it raises rather than mailing the void. The four env vars are gone.

## What We're NOT Doing

- **No recipients in `/admin`.** Owner's call, 2026-08-26, reversing intent #4 in `change.md`. The
  global carries `admin: { hidden: true }` so `/admin` cannot offer a second, unguarded editor for
  the same row.
- **No flag on `users`.** Owner's call #2 stands: recipients are free-text addresses, so somebody who
  receives the fleet digest needs no app account.
- **No settings page.** Per-feature placement is the point — a `/ustawienia` page would fix editing
  while leaving `/flota` silent about who gets its digest.
- **`sendAutoReply` and `LEADS_REPLY_FROM` are untouched** — a from-address is not a recipient list.
- **No per-environment divergence.** The addresses are identical on every environment, so the seed is
  hardcoded and the migration reads no `process.env` (which would also have needed an eslint-disable:
  migrations run in the Payload CLI graph, where the `server-only` env layer throws).
- **No split of the fleet digest into two sends.** It stays ONE message with several `to:` addresses,
  so the bookkeeping stamp the caller writes afterwards still describes one delivery.
- **No data-preservation path for the env→DB cutover.** The seed IS the migration of the data; there
  are four scalar values and they are known literals.

## Implementation Approach

Storage first, then the senders, then the UI, then the destructive env drop. The UI depends only on
Phase 1, but it lands after the senders so that the moment a list becomes editable it is already the
thing that decides delivery — no window in which editing the list changes nothing.

## Critical Implementation Details

- **The seed is literal.** `bartek@wykonczymy.com.pl` for the fleet digest and „nowy lead";
  `admin@wykonczymy.com.pl` for the fleet digest and the ops alerts. Fleet therefore seeds **two**
  rows, matching today's `[FLEET_NOTIFICATION_EMAIL, ADMIN_EMAIL]`.
- **Array-row ids are `varchar PRIMARY KEY`, not serial** — the seed must supply them. Any stable
  string works; Payload only needs uniqueness.
- **Hand-write the migration.** `pnpm migrate:create` has emitted phantom drift since ~March 2026.
  Table names are the risk on a brand-new global, so Phase 1's gate is an actual `findGlobal` round
  trip, not a green migration.
- **Two readers, two layers.** `requireRecipients` (uncached, throws) serves the senders, which run in
  crons and webhooks outside any request cache. The cached wrapper in `lib/queries` serves the two
  pages and is invalidated by the action via `updateTag`.
- **Zod in the action, `minRows: 1` as the backstop.** Payload's own validation error is not
  presentable UI; the action rejects an empty list with a Polish message first, and `minRows` remains
  the structural guarantee for any other write path.

## Phase 1: The global, its table, and the seed

### Overview

Storage exists and is verifiably readable through Payload's own API.

### Changes Required:

#### 1. `src/globals/notification-recipients.ts` (new)

```ts
export const NotificationRecipients: GlobalConfig = {
  slug: 'notification-recipients',
  admin: { hidden: true }, // edited in the app, never here
  access: { read: isAdminOrOwnerOrManager, update: isAdminOrOwner },
  fields: [
    /* fleetDigest, newLead, opsAlerts */
  ],
}
```

Each of the three fields is `type: 'array'`, `minRows: 1`, with a single `email` text field
(`required: true`).

#### 2. `src/payload.config.ts`

Add to the existing `globals: [...]` array alongside `KosztorysClientViewDefaults`.

#### 3. `src/migrations/20260826_0_notification_recipients.ts` (new, hand-written)

`CREATE TABLE notification_recipients` (id serial PK, `updated_at`, `created_at`) plus the three array
subtables `notification_recipients_fleet_digest` / `_new_lead` / `_ops_alerts`, each with `_order`,
`_parent_id`, `id varchar PRIMARY KEY`, `email varchar`, an `ON DELETE cascade` FK to the parent, and
the `_order` / `_parent_id` indexes. Then `INSERT` the single parent row and the four seed recipient
rows as literals. `down()` drops all four tables `CASCADE`.

### Success Criteria:

#### Automated Verification:

- `pnpm payload migrate` applies cleanly against the local docker DB
- `pnpm generate:types` emits a `NotificationRecipient` type
- A `findGlobal({ slug: 'notification-recipients' })` round trip returns the three seeded lists —
  this is what proves the hand-written table names match what Payload expects

## Phase 2: Readers, and the five senders rewired

### Overview

Delivery addresses come from the DB. An empty stream is a fault, not a silent no-op.

### Changes Required:

#### 1. `src/lib/email/recipients.ts` (new)

`RECIPIENT_LISTS` / `RecipientListT` (`'fleetDigest' | 'newLead' | 'opsAlerts'`),
`readRecipientLists(payload)` returning `Record<RecipientListT, string[]>`, and
`requireRecipients(payload, list)` which throws when the list is empty.

Lands in `lib/email/` because it is delivery infrastructure shared by two features — `lib/fleet/` and
`lib/leads/` would each be the wrong single home.

#### 2. `src/lib/fleet/notify.ts` and `src/lib/leads/notify.ts`

`to:` becomes `await requireRecipients(payload, …)` — `'fleetDigest'` for the digest (still one send,
now an N-address array), `'newLead'` for `notifyNewLead`, `'opsAlerts'` for the three alert senders.
The doc comments naming the env vars are rewritten to name the lists.

#### 3. Specs

- `src/__tests__/lib/email/recipients.test.ts` (new) — maps the global's rows to a flat list; throws on
  an empty list; the throw names which stream so a cron log says what is unconfigured.
- `src/__tests__/leads/notify.test.ts` — the `beforeAll` that sets `process.env.LEADS_NOTIFY_EMAIL` /
  `LEADS_ALERT_EMAIL` is replaced by stubbing the recipients read; the two test names quoting env-var
  names are rewritten.
- `src/__tests__/leads/notifications.db.test.ts:42` and `store-lead.db.test.ts:34` also set
  `LEADS_NOTIFY_EMAIL` and reach `notifyNewLead` — they run against the test DB, which the Phase 1
  migration seeds, so the env line goes and the seeded address is what they assert.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/email/recipients.test.ts` passes
- `pnpm exec vitest run src/__tests__/leads/` passes with no `process.env` recipient assignment left

## Phase 3: The lists on /flota and /zgloszenia

### Overview

One component, mounted three times across two pages. Visible to whoever can open the page; editable by
admin/owner.

### Changes Required:

#### 1. `src/lib/queries/notification-recipients.ts` (new)

`'use server'` cached read over `readRecipientLists`, tagged so the action can invalidate it.

#### 2. `src/lib/actions/notification-recipients.ts` (new)

`saveRecipientListAction(list, emails)` wrapped in `ownerOnlyAction` with its own Polish forbidden
message. Zod-validates a non-empty list of well-formed addresses, `updateGlobal`s that one field only
(read-modify-write, so saving the fleet list cannot wipe the ops list), then `updateTag`.

#### 3. `src/components/notifications/recipient-list-card.tsx` (new)

Props `{ list, title, emails, canEdit }`. Renders the addresses; when `canEdit`, an „Edytuj" button
opens a `FormDialog` whose body is a repeatable email field mirroring `line-items-field.tsx`, with
`RemoveButton` per row and an add button. Lives in its own `components/notifications/` directory — it
knows what a notification recipient is, so `components/ui/` is the wrong home.

#### 4. The two pages

`flota/page.tsx` mounts one card („Powiadomienia o terminach", `fleetDigest`).
`zgloszenia/page.tsx` mounts two („Powiadomienia o nowych zgłoszeniach" → `newLead`, „Alerty
techniczne" → `opsAlerts`). Both add the recipients read into the existing `Promise.all` and pass
`canEdit={isAdminOrOwnerRole(session.user.role)}`.

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck` passes
- `pnpm exec vitest run src/__tests__/lib/actions/notification-recipients.test.ts` passes — rejects an
  empty list and a malformed address; saving one list leaves the other two intact

#### Browser-level:

- **Owed, not written here.** A card with an edit dialog on two pages is browser-level risk. Authored
  at the review gate via `/10x-e2e`, or filed as a Linear issue labelled `e2e-backlog`. A commit note
  does not discharge it.

## Phase 4: Drop the four env vars

### Overview

The destructive half. Ships only once the migration has run on the target environment.

### Changes Required:

- `src/lib/env/schema.ts:73-74,76-80` — remove the four entries and the stale comment explaining that
  `FLEET_NOTIFICATION_EMAIL` and `LEADS_NOTIFY_EMAIL` point at one inbox. `LEADS_REPLY_FROM` stays.
- `src/__tests__/lib/env/schema.test.ts:32-33,35-36` — remove the four stub values.
- Grep the tree for any remaining reference before closing the phase.

### Success Criteria:

#### Automated Verification:

- `grep -rn "FLEET_NOTIFICATION_EMAIL\|ADMIN_EMAIL\|LEADS_NOTIFY_EMAIL\|LEADS_ALERT_EMAIL" src e2e scripts` returns nothing
- `pnpm typecheck` passes

### Deploy ordering — human-owned

`pnpm db:migrate:prod` is a **human** step and must run **before** this phase's code ships. This is
the additive direction: the new code needs tables that aren't there yet. Ship first and every stream
throws — the vars are gone from the schema and the global's tables don't exist.

## Testing Strategy

### Unit Tests

`recipients.test.ts` carries the real risk: the empty-list throw is the whole safety property of the
change, and it is the one behaviour no existing test covers. The action spec guards the
read-modify-write — a naive `updateGlobal` that writes the whole document would silently empty the two
lists the user wasn't editing.

### Integration Tests

The two leads DB specs already exercise `notifyNewLead` end to end; they move from an env stub to the
seeded rows, which incidentally makes them a live check that the migration seeded correctly.

### Manual Testing Steps

Registered once in `context/foundation/manual-checks.md` under a `## notification-recipients`
section — not duplicated into `## Progress`.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit suite passes: `pnpm test`
- Build succeeds: `pnpm build`

## References

- Change identity + the owner's calls: `context/changes/2026-08-26-notification-recipients/change.md`
- Global + action-write precedent: `src/globals/kosztorys-client-view-defaults.ts`,
  `src/lib/actions/kosztorys-client-view.ts:57-82`
- Hand-written global table: `src/migrations/20260815_0_add_kosztorys_client_view.ts:30-41`
- Array subtable shape: `src/migrations/20260211_202001.ts:5-11,72,77-78`
- Hand-written-migration rules and the prod-migrate ordering gate: `AGENTS.md` § Migrations

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The global, its table, and the seed

#### Automated

- [x] 1.1 `pnpm payload migrate` applies the new migration cleanly against the local DB
- [x] 1.2 `pnpm generate:types` emits a `NotificationRecipient` type
- [x] 1.3 A `findGlobal({ slug: 'notification-recipients' })` round trip returns the three seeded lists

### Phase 2: Readers, and the five senders rewired

#### Automated

- [ ] 2.1 `src/__tests__/lib/email/recipients.test.ts` passes, incl. the empty-list throw
- [ ] 2.2 `pnpm exec vitest run src/__tests__/leads/` passes with no `process.env` recipient assignment left

### Phase 3: The lists on /flota and /zgloszenia

#### Automated

- [ ] 3.1 `pnpm typecheck` passes with the card mounted on both pages
- [ ] 3.2 Action spec passes: empty list rejected, malformed address rejected, sibling lists intact
- [ ] 3.3 Browser-level E2E authored via `/10x-e2e` **or** filed to `e2e-backlog` with the issue id recorded

### Phase 4: Drop the four env vars

#### Automated

- [ ] 4.1 Tree-wide grep for the four var names returns nothing
- [ ] 4.2 `pnpm typecheck` passes without them in `env/schema.ts`
