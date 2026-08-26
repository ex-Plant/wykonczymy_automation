---
change_id: notification-recipients
title: Notification recipients move from env vars to a DB list that holds more than one person
status: archived
created: 2026-08-26
updated: 2026-08-26
archived_at: 2026-08-26T08:57:02Z
branch: table-column-reordering
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

## Epilogue — 2026-08-26

Landed in four commits: `cb9b878a` (global + hand-written migration + seed), `86b3240a` (readers and
the five senders), `44fb9ab7` (the cards, form and owner action on `/flota` + `/zgloszenia`),
`5b3c5836` (the four env vars dropped).

**Branch caveat.** The four commits sit on `table-column-reordering`, not on a branch of their own:
another agent working the same tree had switched HEAD there, and all four landed interleaved with
its work. Nothing is lost and the commits are cleanly separable (no shared files), but this slice
does not have an isolated branch to diff or PR — it rides along with that one unless somebody
cherry-picks it out.

**What the implementation settled that the plan did not know.**

- `minRows: 1` accepts `[]`. Payload's array validator returns early for an optional field, so the
  "can't be empty" rule needs `required: true` alongside it. This is the whole guarantee behind
  owner's call #3, and without the round-trip check it would have shipped broken and silent.
- Payload array subtables key on **`id varchar` primary key**, not a serial — Payload mints
  ObjectID-shaped ids itself. Confirmed by running `payload generate:db-schema` and reading its
  output rather than guessing (the generated file is not gitignored — delete it after reading).
- A **global** needs no `payload_locked_documents_rels` column; globals lock through
  `payload_locked_documents.global_slug`. Only collections need the rels row.

**Two reader layers, on purpose.** `readRecipientLists` / `requireRecipients` are uncached because
their callers are crons and webhooks — outside any request cache, so a cached read there would hang
on a tag nothing in that process ever invalidates. `fetchRecipientLists` is the cached page-side
read, invalidated by `NOTIFICATION_RECIPIENTS_TAG` from the action.

**Docs corrected by this change:** `context/reference/facebook-leads-setup.md` (env-var section now
names the two lists) and the fleet digest's line in `manual-checks.md`.

**Still owed.**

- Browser-level E2E (Progress 3.3) — authored at the review gate or filed to `e2e-backlog`.
- `pnpm db:migrate:prod`, human-owned, **before** `5b3c5836` ships: this is the additive direction,
  so the code needs tables that are not there yet.
- The `## notification-recipients` section is written into `manual-checks.md` but that file is left
  **uncommitted** — it carries two other agents' in-flight sections in the same trailing hunk.
