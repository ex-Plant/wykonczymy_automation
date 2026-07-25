# Brief — narrow transfer-type spec table (EX-573)

**What:** collapse the money-critical transfer-type predicates into one
`TRANSFER_TYPE_SPECS` table keyed by type, so a new type cannot be added without declaring
what it does to the money. UI-ordering and sheet-column arrays stay literals.

**Why:** today the axis is inverted — ~12 lists each answer "which types belong to me", so
adding a type means visiting each and *remembering* to consider it. A miss is a wrong number,
not a build error. `canBeSettled` aliasing `isExpensesTabType` is the live trap:
`INVESTMENT_EXPENSE_NET` splits them, and forgetting the carve-out leaks netto into marża.

**Shape:** `satisfies Record<TransferTypeT, TransferSpecT>` with required fields → a missing
decision is a compile error. `TRANSFER_TYPES` stays a hand-written literal tuple (deriving it
collapses `TransferTypeT` to `string` and silently voids `z.enum`, every `Record` exhaustiveness
check, and the Payload drift assertion). `transfer-rules.ts` is deleted, dissolving the
load-order cycle.

**Five phases:**

0. Widen the characterization net **on the current implementation** — it covers 7 of 15
   predicates today and asserts nothing about the two that gate money math.
   0b. Freeze a **per-investment golden master** over the real prod restore on 5435 (100
   investments × every figure + bilans + marża, plus 32 register balances), fingerprinted
   against the dataset so a test-DB refresh reads as "regenerate", not "drift". Every later
   phase must leave it byte-identical. No test touches Neon — prod figures enter as data via
   the dump, never as a connection.
1. The table + derived predicates, façade byte-identical, no consumer edits.
2. `deriveFinancials` reads `financialBucket` instead of five raw literals — without this the
   table protects the front door while the back door stays open.
3. Fix `needsSourceRegister('CANCELLATION')`, which returns `true` today and would let the
   admin panel attach a register that silently drains it.

**Deliberately not here:** the five-axis validation matrix, the nine dormant disagreements,
netto's `billedAmount` column, and **EX-574** (the „Suma wybranych transakcji" over-report — a
verified live defect, independently tracked).

**Biggest risk:** `TRANSFERS_SUMMARY_TYPES` order is Google Sheet columns I–N, rewritten
verbatim on reset/relink. Deriving it would silently rewrite live client spreadsheets. It stays
literal.

Full reasoning: `plan.md`. Evidence: `research.md`.
