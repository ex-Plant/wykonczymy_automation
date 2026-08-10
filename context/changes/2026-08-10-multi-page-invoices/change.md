---
change_id: multi-page-invoices
title: An expense carries multiple invoice pages (EX-659)
status: implemented
created: 2026-08-10
updated: 2026-08-10
archived_at: null
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
