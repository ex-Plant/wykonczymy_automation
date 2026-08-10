---
change_id: receipt-scan-netto-extraction
title: AI receipt scan also extracts the netto amount (EX-577)
status: implementing
created: 2026-08-10
updated: 2026-08-10
archived_at: null
branch: null
worktree: null
---

## Notes

EX-577 — https://linear.app/ex-plant/issue/EX-577/ai-receipt-scan-also-extract-the-netto-amount

Add `netAmount` to `receiptExtractionSchema`, teach the prompt to read the **printed** netto / VAT
breakdown (never derive it from an assumed VAT rate), and write it into the line item on scan.

Scope note (owner, 2026-08-10): netto extraction only. Broader wydatek-form adjustments are
explicitly a later change and stay out of this one.
