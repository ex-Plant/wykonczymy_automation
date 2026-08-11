---
change_id: multi-page-invoices
title: An expense carries multiple invoice pages (EX-659)
status: archived
created: 2026-08-10
updated: 2026-08-11
archived_at: 2026-08-11T16:08:56Z
branch: konradantonik/ex-577-ai-receipt-scan-also-extract-the-netto-amount
worktree: null
---

## Notes

EX-659 — an expense can carry more than one invoice file (2-3 pages typical) because long invoices
don't fit on a single page image. Needed for both AI-scanned and hand-entered expenses. Design
decision from discussion: invoice becomes hasMany (one file list per expense), not a
first-file-plus-extras model, because replace/remove of a saved invoice does happen and the
two-headed model would put two different removal verbs in one widget. Six read surfaces currently
assume exactly one file.

**Still live at archive: production is NOT migrated.** `20260810_0_invoice_has_many` was applied
locally and to preview only; prod still carries the scalar `transactions.invoice_id`. `main` must not
receive this code until a human runs `pnpm db:migrate:prod`. Two docs also key on the old shape —
`context/changes/blob-backup/runbook.md` asserts a 1:1 media↔transaction mapping via `invoice_id`
(Phase 6 updated it; re-read it before an incident).

Archived with `plan.md` + `research.md` distilled away — the durable half of research is now the
`hasMany` / `typeof === 'number'` entry in `context/foundation/lessons.md`; `plan-brief.md` is kept
because its decision table (why one model call reverses EX-443, why the scan moved to a route) has no
living doc that owns it.
