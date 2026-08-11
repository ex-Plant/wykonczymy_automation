---
change_id: lead-recovery-notifies-sales
title: Recovered leads reach sales — stop stamping notifyStatus skipped
status: archived
created: 2026-08-10
updated: 2026-08-11
archived_at: 2026-08-11T15:55:15Z
branch: konradantonik/ex-416-cron-lead-reconcile
worktree: null
---

## Notes

EX-660 — the reconcile sweep must stop stamping notifyStatus 'skipped'. Recovered leads should go
through captureLead with auto-reply suppressed, so sales gets a normal per-lead notification while
the customer gets no late "thanks for your inquiry". The summary recovery mail then reverts to an
ops-only "webhook is dead" signal.
