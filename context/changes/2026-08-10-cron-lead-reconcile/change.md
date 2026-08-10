---
change_id: cron-lead-reconcile
title: Promote the manual lead reconcile sweep to a scheduled cron backstop
status: implemented
created: 2026-08-10
updated: 2026-08-10
archived_at: null
branch: konradantonik/ex-416-cron-lead-reconcile
worktree: .claude/worktrees/cron-lead-reconcile
---

## Notes

EX-416 step 2. The reconcile sweep already exists and is correct — `reconcileLeads()` in
`src/lib/actions/reconcile-leads.ts`, driven by the „Pobierz zgłoszenia" button. It only runs when a
human notices something is wrong, and the failure mode it recovers from is precisely the one nobody
notices: the webhook path logs a `console.error` and nothing else.

Step 1 of EX-416 (a non-expiring System User → derived Page token) landed 2026-08-10 and removed
_expiry_ as a cause. It did not remove _silence_: permission revocation, app restriction, a Graph
outage, or a mis-pointed `callback_url` still lose leads the same way. The sweep is indifferent to
cause — it compares the DB against Meta and inserts whatever is missing — which is what makes it the
durable fix rather than another cause-specific guard.

Known seam problem: `reconcileLeads()` is `'use server'` and opens with
`requireAuth(MANAGEMENT_ROLES)`, so a cron route cannot call it as-is. The revalidation split matters
too (`AGENTS.md`): `revalidateCollections` uses `updateTag()` and belongs in the action; a Route
Handler needs `revalidateTag`.

Related finding logged on EX-416, deliberately NOT in this change's scope: `fetchLead` never receives
`form_id`, because `GET /{leadgen_id}` without an explicit `?fields` returns only
`created_time`/`field_data`/`id`. Separate bug, owes its own repro test.
