---
change_id: receipt-scan-netto-extraction
title: AI receipt scan also extracts the netto amount (EX-577)
status: archived
created: 2026-08-10
updated: 2026-08-10
archived_at: 2026-08-10
branch: konradantonik/ex-577-ai-receipt-scan-also-extract-the-netto-amount
worktree: null
---

## Notes

EX-577 — https://linear.app/ex-plant/issue/EX-577/ai-receipt-scan-also-extract-the-netto-amount

Add `netAmount` to `receiptExtractionSchema`, teach the prompt to read the **printed** netto / VAT
breakdown (never derive it from an assumed VAT rate), and write it into the line item on scan.

Scope note (owner, 2026-08-10): netto extraction only. Broader wydatek-form adjustments are
explicitly a later change and stay out of this one.

`plan.md` was deleted at a follow-up distillation pass (2026-08-11) — the archive step that moved
this folder predated that rule. Nothing was lost: the missing-hook-harness workaround it recorded is
already the `renderHook` entry in `context/foundation/lessons.md`, and `plan-brief.md` keeps the
decision table (why the netto write is unconditional, why a derived netto is worse than a blank one).
