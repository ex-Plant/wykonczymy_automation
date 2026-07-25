---
change_id: netto-expense-type
title: Netto investment-expense type (spike)
status: planned
created: 2026-07-24
updated: 2026-07-24
archived_at: null
---

## Notes

Spike added to the EX-536 zaliczka-v2 PR. A new transfer type `INVESTMENT_EXPENSE_NET` carries a
second stored `netAmount`: the expense leaves the register at brutto (`amount`) but bills the investor
at netto (`netAmount`, immutable, `netAmount ≤ amount`). Design + resolved decisions:
`design.md`. Plan: `plan.md` / `plan-brief.md`. Guards B1–B5 + B7. Kosztorys/spike data is throwaway.

**Blocked on EX-573** (`context/changes/2026-07-25-transfer-type-spec-table/`) — the transfer-type
predicate sets become one compile-checked `TRANSFER_SPECS` table first, so Phase 1 shrinks to adding
one row instead of visiting ~12 membership arrays. That refactor also makes the `canBeSettled` ≠
`isExpensesTabType` carve-out (B4) a compile error rather than a silent marża leak.

EX-573 deliberately leaves the `billedAmount: 'amount' | 'netAmount'` column to **this** change:
adding it here removes the hardcoded type-name `if` that Phase 2 would otherwise mirror across
`deriveFinancials` and `deriveCategoryBreakdowns`. Fold it into Phase 2 when replanning.
