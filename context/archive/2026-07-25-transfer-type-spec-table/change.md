---
change_id: transfer-type-spec-table
title: One spec table for transfer types, membership arrays derived
status: archived
created: 2026-07-25
updated: 2026-07-26
archived_at: 2026-07-26T06:27:25Z
branch: konradantonik/ex-573-transfer-type-spec-table
worktree: .claude/worktrees/ex-573-spec-table
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

**Approach:** invert the axis to one `TRANSFER_TYPE_SPECS` table keyed by type, one row per type,
declaring its capabilities as columns. `satisfies Record<TransferTypeT, TransferSpecT>` with
required fields makes a missing decision a **compile error**. Every existing export
(`DEPOSIT_TYPES`, `canBeSettled`, …) is then derived from the table, keeping names and
signatures identical — a pure inward refactor behind a stable façade, so none of the ~23
consumer files change.

**Research (2026-07-25): `research.md`.** Five parallel agents, every finding re-verified by hand
against the local prod restore. It changed the premise twice:

1. `src/__tests__/transfer-constants.test.ts` covers **7 of 15** predicates — not the
   characterization net this plan assumed. `canBeSettled` and `isExpensesTabType`, which gate
   money math, are asserted nowhere. The net must be widened on the CURRENT implementation
   before any rewrite.
2. The predicates are **five independent axes per field** (required / shown / auto-cleared /
   optional / exempt), not one membership question. `investment` alone uses three, with two
   different sets on the same field. So "one boolean column per predicate" is wrong by
   construction.

Ten latent disagreements surfaced (`research.md` §5); a data audit found **zero** bad rows for
every one of them — they are dormant, not active. The one genuinely wrong figure in the app is
**EX-574** (`Suma wybranych transakcji` over-reports by up to +71 %), which is independent of
this refactor and does not block it.

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

**Isolation (resolved 2026-07-25):** branched from `subcontractor-view-settlement-only` at
`faecd048`, not from `origin/main` — this change folder only exists on that branch. So the
worktree inherits that branch's unmerged work (the kosztorys view-scoping refactors and the
`vatPlane` rename, `527ec1a0`/`a7116585`, which already touched `DEPOSIT_UI_TYPES`). **Merge
order matters:** `subcontractor-view-settlement-only` must land before this branch, or the
constants file conflicts.
