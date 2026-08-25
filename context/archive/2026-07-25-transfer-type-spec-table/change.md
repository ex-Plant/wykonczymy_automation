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

## Findings kept from `research.md` (deleted 2026-08-08)

`plan.md` / `plan-brief.md` / `research.md` are gone; `git log --follow` on this folder still
reaches them. What survives is the audit, not the choreography. **All of it was true on
2026-07-25 — verify before acting.**

### Cancellation is two concepts, not one

|                   | `type = 'CANCELLATION'`                        | `cancelled = true`                                                          |
| ----------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| what              | a new stub row — an audit receipt              | a state change on the original                                              |
| money meaning     | **none** — not a reversal, not a counter-entry | **everything** — the sole mechanism removing the original from every figure |
| relational fields | all NULL (0/256 rows in the DB)                | unchanged                                                                   |

The reversal works by **excluding the original**, never by a compensating entry
(`src/lib/queries/transfers.ts` states the invariant). `cancelTransferAction` does two writes
with **no transaction wrapper** — flip the flag, then create the stub with `amount` copied
verbatim, sign preserved. `ON DELETE SET NULL` on `cancelled_transaction_id` means hard-deleting
an original **orphans** its CANCELLATION. Sheet sync only ever _removes_: `SHEET_SYNCED_TYPES`
excludes CANCELLATION, so the stub's own `afterChange` never fires;
`syncSingleTransferToSheet` still carries a redundant second cancellation path, unreachable from
the hook and exercised only by tests.

### The predicates the table does not reach

~30 raw string literals bypass the spec table. The dangerous cluster is **SQL** — seven
literals in `sum-transfers.ts`, invisible to any TS predicate, where the sign rule is implicit
(`CASE WHEN type IN (deposits) THEN amount ELSE -amount END`). Giving `RABAT` or `LOSS` a source
register would start debiting cash registers **with no edit to that file**. Also: five literals
inside `deriveFinancials` itself, Payload `condition` callbacks duplicating `needsWorker` /
`isCancellationType`, `roles.ts` duplicating `isLaborCost`, and `validation.ts`'s raw
`type === 'CORRECTION'` reached from five call sites.

### Latent disagreements — dormant, zero bad rows found

A data audit over the prod restore found **no** offending row for any of these, which is why
none blocked the refactor. `needsSourceRegister('CANCELLATION')` and the exempt-row problem were
fixed here (see the comment on the `CANCELLATION` row in `constants/transfers.ts`). Still open:

- **CORRECTION sign**: `utils/validation.ts` _rejects_ `amount >= 0`, while `collections/transfers.ts`,
  `hooks/transfers/validate.ts` and **AGENTS.md** all say "may be negative". Code wins; the prose
  is what needs correcting.
- **`otherCategory` has three readings** — shown (OTHER / INVESTMENT_EXPENSE / PAYOUT), required
  (OTHER), and always (the edit form gates it not at all). Nothing clears it, so an edit can weld
  one onto a `LABOR_COST`.
- **`vatPlane` has no predicate** — raw `=== 'INVESTOR_DEPOSIT'` in the collection and the deposit
  form, sent unconditionally by `toData`, cleared by no server rule.
- **`expenseCategory` is required but never cleared** — dropping a correction's investment orphans it.
- **`needsOtherCategory` is server-only**, absent from `transferFieldRules`, so it surfaces as a
  thrown hook error instead of an inline field error.
- **`editExpenseFormSchema` validates amounts type-blind** — a CORRECTION edit runs the
  "must be > 0" branch; masked only because `updateTransferAction` discards the amount for
  anything but `LABOR_COST`.
- `getSecondRowCategory` drops its `hasInvestment` argument; `internalTransferFormSchema`
  re-implements three shared rules with different Polish messages, and `createInternalTransferSchema`
  is dead but for its own test.

### Why `TRANSFERS_SUMMARY_TYPES` stayed literal

It is Google Sheet columns I–N, rewritten verbatim on reset/relink. Deriving it from the table
would reorder live client spreadsheets and break their formulas — the array's _order_ is an
external contract, not a membership question.
