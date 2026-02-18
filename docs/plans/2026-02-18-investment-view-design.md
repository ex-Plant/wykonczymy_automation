# M28: Investment View Enhancements — Design

## Problem

Investment detail page shows only `totalCosts` (sum of INVESTMENT_EXPENSE + EMPLOYEE_EXPENSE). The business needs a full financial picture: income from investor payments, manually tracked labor costs, and a computed P&L balance. These financial stats are sensitive — only OWNER/ADMIN should see them.

## Design Decisions

| Question                     | Decision                                                           |
| ---------------------------- | ------------------------------------------------------------------ |
| What are investment costs?   | INVESTMENT_EXPENSE + EMPLOYEE_EXPENSE (investor must repay)        |
| What are received payments?  | INVESTOR_DEPOSIT + STAGE_SETTLEMENT                                |
| How are labor costs tracked? | Single number field on Investment, manually entered by OWNER       |
| Who sees financials?         | OWNER/ADMIN only. MANAGER sees transfer history but no stat cards. |

## Data Model

### New fields on Investments collection

| Field         | Type   | Default | Access                   | Computed                                                   |
| ------------- | ------ | ------- | ------------------------ | ---------------------------------------------------------- |
| `totalIncome` | number | 0       | readOnly, update blocked | Yes — SUM of INVESTOR_DEPOSIT + STAGE_SETTLEMENT via hooks |
| `laborCosts`  | number | 0       | ADMIN/OWNER can edit     | No — manually entered                                      |

Existing `totalCosts` (SUM of INVESTMENT_EXPENSE + EMPLOYEE_EXPENSE) stays unchanged.

### P&L formula

```
balance = totalIncome - totalCosts - laborCosts
```

Not stored — computed on-read in the detail page component.

## SQL

New function `sumInvestmentIncome(payload, investmentId, req?)`:

```sql
SELECT COALESCE(SUM(amount), 0) AS total
FROM transactions
WHERE investment_id = $1
  AND type IN ('INVESTOR_DEPOSIT', 'STAGE_SETTLEMENT')
```

## Hook Changes

`recalculate-balances.ts` — when a transfer has an `investment` field:

- Already recalculates `totalCosts` via `sumInvestmentCosts`
- Add: recalculate `totalIncome` via `sumInvestmentIncome` in parallel
- Single SQL UPDATE sets both `total_costs` and `total_income`

## Investment Detail Page

### OWNER/ADMIN view

4 stat cards in a grid:

| Card                | Value                                   | Color hint                         |
| ------------------- | --------------------------------------- | ---------------------------------- |
| Koszty inwestycji   | `totalCosts`                            | neutral                            |
| Wpłaty od inwestora | `totalIncome`                           | neutral                            |
| Koszty robocizny    | `laborCosts`                            | neutral                            |
| Bilans              | `totalIncome - totalCosts - laborCosts` | green if positive, red if negative |

Plus: transfer history with type filter.

### MANAGER view

Transfer history only. No stat cards, no financial data.

## Files to Change

| File                                                   | Change                                           |
| ------------------------------------------------------ | ------------------------------------------------ |
| `src/collections/investments.ts`                       | Add `totalIncome`, `laborCosts` fields           |
| `src/migrations/YYYYMMDD_add_investment_financials.ts` | New columns                                      |
| `src/lib/db/sum-transfers.ts`                          | Add `sumInvestmentIncome()`                      |
| `src/hooks/transfers/recalculate-balances.ts`          | Recalculate `totalIncome` alongside `totalCosts` |
| `src/app/(frontend)/inwestycje/[id]/page.tsx`          | Role-conditional stat cards, type filter         |

## Success Criteria

1. OWNER/ADMIN sees 4 stat cards with correct values on investment detail
2. MANAGER sees transfer history only, no financial stats
3. Balance updates correctly when deposit or expense transfers are created/deleted
4. Labor costs editable by OWNER/ADMIN in Payload admin panel
5. Type filter works on investment detail transfer table
