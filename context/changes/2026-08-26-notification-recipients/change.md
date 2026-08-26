---
change_id: notification-recipients
title: Notification recipients move from env vars to a DB list that holds more than one person
status: implementing
created: 2026-08-26
updated: 2026-08-26
archived_at: null
branch: null
worktree: null
---

## Notes

Move notification recipients out of env vars into a DB-backed list supporting more than one person.

Owner's calls, verbatim in intent:

1. **All three streams** — fleet digest, leads „nowy lead", leads ops alerts.
2. **Standalone list**, not a flag on `users`.
3. **Can't be empty** — validation enforces at least one recipient. Implementation note: `minRows: 1`
   alone does **not** do this. Payload's array validator returns early on an empty array when the
   field is optional, so the list field carries `required: true` as well — verified by an
   `updateGlobal({ newLead: [] })` round trip, which is accepted without it and rejected with it.
4. ~~**Admin panel** is where it's edited.~~ **Reversed by the owner, 2026-08-26:** the recipients are
   edited **in the app, per feature** — the fleet list on `/flota`, both leads lists on
   `/zgloszenia`. Reason given: „I need to see who's going to get notified. I don't want it hidden
   inside the admin panel." A `/ustawienia` page was rejected for the same reason — it would fix
   editing while leaving `/flota` silent about who gets its digest. The global carries
   `admin: { hidden: true }` so `/admin` cannot offer a second, unguarded editor.

Two things baked in without asking:

- The migration **seeds** the three lists. **Owner's call, 2026-08-26:** the addresses are the same on
  every environment, so the seed is **hardcoded literals** — the migration reads no env vars. Only two
  distinct addresses exist across all four current vars.
- The sender **throws** rather than mailing nobody — a stream with no recipients is a fault, not a
  quiet no-op. Free to do: every ops-alert call site already `.catch()`-wraps and the fleet cron
  `try`-wraps.

`LEADS_REPLY_FROM` is out of scope throughout — it is a **from**-address (an SPF/DKIM-authenticated
sender identity), not a recipient list.

Dropping the other four env vars from `env/schema.ts` is the destructive half and ships **after**
`pnpm db:migrate:prod` has run on the target environment (human-owned).
