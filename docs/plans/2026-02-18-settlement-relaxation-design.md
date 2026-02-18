# M27: Settlement Relaxation — Design

## Problem

Settlement form always requires an investment. In practice, employee expenses can be general (no investment) — just a category + note. No expense categorization exists for EMPLOYEE_EXPENSE transfers.

## Design

### Settlement form: investment OR category (mutually exclusive)

Radio toggle at the top: **"Inwestycja"** vs **"Inne (kategoria)"**. One must be selected.

**Investment mode:**

- Investment dropdown (required)
- Line items: description, amount, invoice file

**Category mode (Inne):**

- Line items: description, amount, invoice file, category (from `other-categories`, required), note (required)

### Transfer collection

- Expand `otherCategory` admin condition to show for `EMPLOYEE_EXPENSE` (not just `OTHER`)
- Same for `otherDescription`
- Validation: `EMPLOYEE_EXPENSE` requires either `investment` OR (`otherCategory` + `otherDescription`), not both

### Server action

- `createSettlementAction` accepts optional `investment` and per-item `category` + `note`
- Investment mode: each transfer gets `investment`, `otherCategory: null`
- Category mode: each transfer gets `otherCategory` + `otherDescription` from its line item, `investment: null`

### Schema

- Settlement schema: `investment` optional, add `category` and `note` per line item
- Transfer validation hook: `EMPLOYEE_EXPENSE` requires investment OR category, not both

## Files changed

| File                                                       | Change                                               |
| ---------------------------------------------------------- | ---------------------------------------------------- |
| `src/lib/schemas/settlements.ts`                           | Investment optional, add category+note per line item |
| `src/components/forms/settlement-form/settlement-form.tsx` | Radio toggle, conditional fields per mode            |
| `src/lib/actions/settlements.ts`                           | Handle both modes, pass category per transfer        |
| `src/collections/transfers.ts`                             | Expand otherCategory/otherDescription condition      |
| `src/hooks/transfers/validate.ts`                          | EMPLOYEE_EXPENSE: investment OR category required    |
| `src/lib/constants/transfers.ts`                           | Update helper functions                              |
