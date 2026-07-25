---
change_id: transfer-type-spec-table
title: One spec table for transfer types, membership arrays derived
status: new
created: 2026-07-25
updated: 2026-07-25
archived_at: null
branch: null
worktree: null
---

## Notes

Tracked as **EX-573**. Hardening pass that must land **before** `netto-expense-type` Phase 1.

Today a transfer type's behaviour is spread across ~12 independent membership arrays and
string-literal predicates (`DEPOSIT_TYPES`, `EXPENSES_TAB_TYPES`, `canBeSettled`,
`showsOtherCategory`, `needsExpenseCategory`, `INVESTMENT_TYPES`,
`REQUIRES_INVESTMENT_TYPES`, …) across `src/lib/constants/transfers.ts` and
`src/lib/constants/transfer-rules.ts`. The axis is inverted: each list answers "which types
belong to me", so adding a type means visiting N lists and _remembering_ to consider each.
Nothing forces the question to be asked, and a miss is a silent wrong number rather than a
build error.

The specific trap `netto-expense-type` walks into: `canBeSettled` currently aliases
`isExpensesTabType`. That equality is coincidental, not intentional —
`INVESTMENT_EXPENSE_NET` is exactly the type that splits them, and forgetting the carve-out
leaks netto into `totalSettled` → marża. Compiles clean, tests pass, wrong money.

**Approach:** invert the axis to one `TRANSFER_SPECS` table keyed by type, one row per type,
declaring its capabilities as columns. `satisfies Record<TransferTypeT, TransferSpecT>` with
required fields makes a missing decision a **compile error**. Every existing export
(`DEPOSIT_TYPES`, `canBeSettled`, …) is then derived from the table, keeping names and
signatures identical — a pure inward refactor behind a stable façade, so none of the ~23
consumer files change. `src/__tests__/transfer-constants.test.ts` already asserts exact array
contents and serves as the characterization test.

**Deliberately NOT derived** (facts that are positional/ordering, not semantic):

- `TRANSFERS_SUMMARY_TYPES` — fixed sheet column layout, explicitly decoupled from routing
  (dropping a column shifts `LOSS` left and breaks sheet formulas). Stays literal.
- Ordered UI arrays (`TRANSACTION_TRANSFER_TYPES`, `DEPOSIT_UI_TYPES`) — order is load-bearing
  (Polish-alphabetical). Derive membership, keep order explicit, test that the two agree.
- `needsExpenseCategory(type, hasInvestment)` is parameterized → three-state column
  (`'always' | 'withInvestment' | false`), not a boolean.

**Side win:** the `transfers.ts` ↔ `transfer-rules.ts` split exists only to break a load-order
cycle (see the comment at `transfer-rules.ts:10-13`). One table in one file dissolves it.

**Scope decision (2026-07-25, resolved — do not re-litigate):** a `billedAmount: 'amount' |
'netAmount'` column would also collapse `netto-expense-type`'s two-bucket split into a
type-declared property rather than an `if` mirrored across `deriveFinancials`,
`deriveCategoryBreakdowns`, and the toggle composition. **It does NOT land here.** It lands in
the netto change, which already rewrites `deriveFinancials` and will carry the tests for it.
Keeping this change purely structural preserves its "provably zero behaviour change" property
— the existing characterization test staying green _is_ the proof, and mixing in the financial
layer would destroy that.

**Branch caution:** the current working tree (`subcontractor-view-settlement-only`) has
uncommitted edits in `src/collections/transfers.ts` and `src/lib/constants/transfers.ts` — the
exact files this change rewrites. Resolve isolation before implementing.
