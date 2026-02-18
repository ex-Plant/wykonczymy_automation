# M25: Cash Flow Integrity — Design

## Problem

1. `balance` (cash-registers) and `totalCosts` (investments) are derived values computed from transfers, but ADMIN/OWNER can overwrite them via Payload API — creating inconsistencies
2. Transfers can be fully edited in Payload admin after creation — any field change that affects balances (amount, type, cashRegister, etc.) is risky and error-prone
3. No field-level immutability enforced on financial data

## Design

### 1. Lock derived fields: `balance` and `totalCosts`

Remove `access.update` from both fields entirely. No role — not even ADMIN — can set these via Payload API.

The only write path is raw SQL in:

- `recalculate-balances.ts` hooks (afterChange/afterDelete on transfers)
- `recalculateBalancesAction` (SyncBalancesButton admin repair)

Both already use `db.execute(sql`UPDATE ...`)` which bypasses Payload access control by design.

### 2. Make transfers immutable after creation (except invoice)

**Locked fields** (field-level `access.update: () => false`):

- `amount`, `type`, `date`, `description`
- `cashRegister`, `targetRegister`, `investment`, `worker`
- `paymentMethod`, `otherCategory`, `otherDescription`
- `createdBy` (already read-only)

**Updatable fields:**

- `invoice`, `invoiceNote`

Collection-level `update` access stays `isAdminOrOwner` (needed for invoice uploads).

### 3. Correction flow

Delete the incorrect transfer → create a new one with correct data. The `afterDelete` hook recalculates balances automatically.

### 4. No new verification logic

`SyncBalancesButton` already handles manual balance repair. No changes needed.

## Files changed

| File                                | Change                                                   |
| ----------------------------------- | -------------------------------------------------------- |
| `src/collections/cash-registers.ts` | Remove `access.update` from `balance` field              |
| `src/collections/investments.ts`    | Remove `access.update` from `totalCosts` field           |
| `src/collections/transfers.ts`      | Add `access.update: () => false` to all financial fields |

~15 lines changed across 3 files.
