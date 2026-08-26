# Notification recipients move from env vars to a DB list, edited in the app — Plan Brief

> Full plan: `context/changes/2026-08-26-notification-recipients/plan.md`

## What & Why

Four env vars decide who gets notified — one address each, changeable only by redeploying, and
invisible to the people they concern. They become three DB-backed lists that hold more than one
person, are **shown on the page whose notifications they are**, and are edited in the app.

## Starting Point

Five senders address themselves from `serverEnv`: `notifyFleetDigest` (`[FLEET_NOTIFICATION_EMAIL,
ADMIN_EMAIL]`, one send), `notifyNewLead` (`LEADS_NOTIFY_EMAIL`), and three alert senders
(`LEADS_ALERT_EMAIL`). Across all four vars there are only **two distinct addresses**, identical on
every environment. Every ops-alert call site already `.catch()`-wraps its send and the fleet cron
`try`-wraps, so a throwing sender needs no new error handling. One global already exists
(`KosztorysClientViewDefaults`) and is already written from a server action rather than `/admin` —
storage and write path are both copied from it.

## Desired End State

`/flota` shows who gets the deadline digest; `/zgloszenia` shows who gets „nowy lead" and who gets the
technical alerts. Any list holds one or more addresses, editable in place by an admin/owner without
opening `/admin`. All five senders read those lists, and a stream with nobody in it raises rather than
mailing the void. The four env vars are gone.

## Key Decisions Made

| Decision                    | Choice                                                           | Why                                                                                                                                                |
| --------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where recipients are edited | **In the app, per feature** — not `/admin`, not a settings page  | Owner, 2026-08-26, reversing intent #4. The complaint is „I can't see who gets notified"; a settings page fixes editing and leaves `/flota` silent |
| UI cost containment         | **One component, mounted three times**                           | Per-feature visibility without three bespoke editors                                                                                               |
| Storage                     | Payload **global**, `admin: { hidden: true }`                    | Exactly one row; hiding it stops `/admin` offering a second unguarded editor for the same data                                                     |
| Recipient identity          | Free-text addresses, **not** a relation to `users`               | Owner's call #2 — a person who gets the digest needs no app account                                                                                |
| Non-empty guarantee         | `minRows: 1` + Zod in the action                                 | Owner's call #3. Payload enforces `minRows` on any write path; Zod exists to give a presentable Polish error                                       |
| Empty stream at send time   | **Throw**                                                        | A stream with no recipients is a fault, not a quiet no-op — and every call site already catches                                                    |
| Seed values                 | **Hardcoded literals**                                           | Owner: the addresses are the same on every environment. Also avoids reading env in the CLI graph, where the `server-only` layer throws             |
| Fleet digest shape          | Stays **one** send, N addresses                                  | The caller's bookkeeping stamp must keep describing one delivery                                                                                   |
| Reader layering             | Uncached `requireRecipients` for senders, cached query for pages | Crons and webhooks run outside any request cache; the pages want the tag-invalidated read                                                          |
| `LEADS_REPLY_FROM`          | Untouched                                                        | A from-address is a sender identity, not a recipient list                                                                                          |

## Scope

**In scope:** the `notification-recipients` global + hand-written migration with a literal seed; the
recipients reader and its empty-list throw; five senders rewired; a cached page query and an
`ownerOnlyAction` writer; one recipients card mounted on `/flota` (×1) and `/zgloszenia` (×2);
dropping the four env vars.

**Out of scope:** `sendAutoReply` / `LEADS_REPLY_FROM`; any `/admin` editing surface; a `/ustawienia`
page; linking recipients to `users`; per-environment address divergence.

## Phases

1. **The global, its table, and the seed** — hand-written migration; gate is a real `findGlobal` round
   trip, because table names are the risk on a brand-new global.
2. **Readers, and the five senders rewired** — `requireRecipients` throws on empty; the leads specs
   move off `process.env`.
3. **The lists on /flota and /zgloszenia** — cached query, `ownerOnlyAction` writer, one card component
   mounted three times.
4. **Drop the four env vars** — destructive; ships only after `pnpm db:migrate:prod` (human).

## Risks

- **Deploy ordering is the real one.** This is the additive direction: the new code needs tables that
  don't exist yet. If Phase 4 ships before a human has run `pnpm db:migrate:prod`, the vars are gone
  from the schema, the tables are absent, and all three streams throw.
- **Hand-written table names.** A brand-new global means guessing what Payload's Drizzle layer expects;
  a mismatch is silent until something reads. Phase 1 gates on an actual `findGlobal`, not on the
  migration exiting 0.
- **Read-modify-write on the global.** A naive `updateGlobal` writing the whole document would empty
  the two lists the user wasn't editing. Guarded by the action spec.
- Browser-level E2E is **owed**, not written in-plan — authored at the review gate or filed to
  `e2e-backlog`.
