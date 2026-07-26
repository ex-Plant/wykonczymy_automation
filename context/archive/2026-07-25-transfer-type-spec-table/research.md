---
topic: Transfer-type predicate sets — consumers, order dependence, cancellation semantics, validation seam
researcher: Claude (5 parallel agents + hand verification against the local prod copy)
date: 2026-07-25
change_id: transfer-type-spec-table
status: complete
---

# Research: the transfer-type predicate surface

Grounding for **EX-573** (one compile-checked spec table, membership arrays derived).
Every claim below was produced by a research agent and then **re-verified by hand** —
either by reading the cited file in this worktree or by querying the local dev DB
(`docker exec wykonczymy`, a restore of the Neon prod dump, so the numbers are real).

---

## 1. Verified live defect — „Suma wybranych transakcji" over-reports

**This is the only figure in the app that is currently wrong.** It is independent of the
refactor and can be fixed on its own.

### The chain

Four steps, each correct in isolation:

1. `src/lib/queries/transfer-filters.ts:93,98` — the list's default `Where` carries **two**
   exclusions: `type: { not_in: ['CANCELLATION'] }` and `cancelled: { not_equals: true }`.
2. `stripCancelledFilters` (`transfer-filters.ts:183-192`) removes **both** before the stats
   query. It re-attaches `type` only when it is an `in` filter (user-selected); the default
   `not_in` is dropped.
3. `sumFilteredByType` (`src/lib/db/sum-transfers.ts:388`) re-adds only `WHERE cancelled IS NOT TRUE`.
4. A `CANCELLATION` stub has `cancelled = false`, so it survives — and its `amount` is a
   **verbatim copy** of the original's (`src/lib/actions/transfers.ts:198`), never a negation.

`src/components/transfers/transfer-table-server.tsx:53-55` then sums the whole distribution
with no type filter. Rendered at `src/components/transfers/transfer-filters.tsx:220-226`,
gated on `hasAnyFilter` (entity filter **or** date filter).

The failure is worse than a simple overcount: it **structurally undoes the cancellation** —
the original drops out via `cancelled IS NOT TRUE`, and its amount-identical twin is added
back in its place.

### Proof (local restore of prod, 2026-07-25)

Per month, `cancelled IS NOT TRUE`:

| month | correct (what the list shows) | displayed total | error | cancellations |
| --- | ---: | ---: | ---: | ---: |
| 2026-01 | 354 675,00 | 354 675,00 | 0,00 | 0 |
| 2026-02 | 191 030,00 | 191 030,00 | 0,00 | 0 |
| 2026-03 | 4 202 513,34 | **7 192 866,38** | +2 990 353,04 | 55 |
| 2026-04 | 2 540 523,82 | **3 775 400,50** | +1 234 876,68 | 66 |
| 2026-05 | 1 707 302,83 | 1 779 566,48 | +72 263,65 | 14 |
| 2026-06 | 3 496 989,15 | **4 697 025,70** | +1 200 036,55 | 95 |
| 2026-07 | 1 216 592,96 | 1 462 388,15 | +245 795,19 | 26 |

March 2026: **+71 %**. Σ of all 256 `CANCELLATION` amounts in the DB = **5 743 325,11 PLN**.

### In-app reproduction

Two URLs returning an **identical list** (379 rows both times) with different totals:

```
# wrong — 7 192 866,38
/raporty?from=2026-03-01&to=2026-03-31

# correct — 4 202 513,34
/raporty?from=2026-03-01&to=2026-03-31&type=OTHER_DEPOSIT,OTHER,CORRECTION,LABOR_COST,RABAT,LOSS,REGISTER_TRANSFER,INVESTOR_DEPOSIT,INVESTMENT_EXPENSE,PAYOUT,COMPANY_FUNDING
```

Naming the types explicitly fixes the sum, because `stripCancelledFilters` keeps an `in`
filter and drops the default `not_in`. Same set, two spellings, two numbers.

### Blast radius — verified, not assumed

**Cannot manifest** on `/inwestycje/[id]`, `/kasa/[id]`, `/pracownicy/[id]`. Those pages
hard-scope the `Where` with a relational column that `stripCancelledFilters` preserves:

- `src/app/(frontend)/inwestycje/[id]/page.tsx:43` — `investment: { equals: investmentId }`
- `src/app/(frontend)/kasa/[id]/page.tsx:35-38` — `or: [sourceRegister…, targetRegister…]`

and every `CANCELLATION` row has those columns NULL. Confirmed by query: **0** investments
and **0** registers where the two sums differ; **0** cancellations carrying an investment or
a register.

So the leak is confined to **`/raporty`**, and only under a filter a relation-less stub can
match: date range (the common case), `createdBy`, `paymentMethod`, amount, id.

**Financial figures are unaffected.** `deriveFinancials`
(`src/lib/db/investment-financials.ts:41-50`) buckets strictly by type and `CANCELLATION`
matches no predicate, so it contributes 0 to marża, bilans, register balances, income,
labor costs and payouts.

### Fix options

- (a) `transfer-table-server.tsx:53` filters `CANCELLATION` out of the reduce, or
- (b) `stripCancelledFilters` preserves the default `type: { not_in: [...] }`.

(b) fixes the class; (a) fixes the instance. **test:** test-driven-debugging · unit —
reproduce against `stripCancelledFilters` + the reduce before touching either.

---

## 2. Data-state audit — every other flagged disagreement is dormant

Queried on the same restore. All zero except the last row, which is legitimate data.

| checked | rows |
| --- | ---: |
| `CANCELLATION` carrying register / investment / worker / expenseCategory / settled | 0 |
| `CORRECTION` with a non-negative amount | 0 |
| `vat_plane` set on a type other than `INVESTOR_DEPOSIT` | 0 |
| `other_category` outside OTHER / INVESTMENT_EXPENSE / PAYOUT | 0 |
| `expense_category` on a `CORRECTION` with no investment | 0 |
| `settled` on a type outside `EXPENSES_TAB_TYPES` | 0 |
| `investment` on COMPANY_FUNDING / OTHER_DEPOSIT | **4** |

The four are deliberate owner entries (`koronki mykhaiło`, `rabat`, `naprawa gwarancyjna`,
`korekta faktury elektryka`) booked as `OTHER_DEPOSIT` against an investment.
`showsInvestment` includes `OTHER_DEPOSIT`, so they count as income on that investment —
correct. The only drift is that the deposit form now hides the investment picker for
non-`INVESTOR_DEPOSIT`, so such a row can no longer be created through it.

**Conclusion: the remaining findings are latent, not active.** Real risk (the write paths
exist, mostly via the Payload admin panel), zero damage so far.

---

## 3. Structural constraints the table MUST satisfy

### 3.1 `TransferTypeT` must stay a literal union 🔴

If `TRANSFER_TYPES` becomes `Object.keys(TABLE)` it collapses to `string`, which:

- breaks `z.enum(TRANSFER_TYPES)` at `src/lib/schemas/transfer.ts:19` and
  `expense-schema.ts:108` (Zod 4 requires a readonly literal tuple);
- degrades every `Record<TransferTypeT, …>` to `Record<string, …>`, **destroying the
  exhaustiveness this refactor exists to add**;
- makes `_AllTransferTypesCovered` (`src/collections/transfers.ts:34-41`) vacuously `true`
  — a **silent** loss of drift protection, not a build error.

Therefore: the table is `as const` and `TransferTypeT = keyof typeof TABLE`, or
`TRANSFER_TYPES` stays a hand-written literal tuple.

### 3.2 Derived arrays must be eager values, not lazy getters 🔴

Two module-load-time consumers:

- `src/hooks/transfers/sync-sheet.ts:20` — spreads `EXPENSES_TAB_TYPES` +
  `SHEET_TRANSFER_TAB_TYPES` at import, **inside the Payload config graph**. A lazy getter
  yields an empty array here and **every transfer silently stops syncing to the sheet**.
- `src/lib/db/sum-transfers.ts:24-27` — builds `depositTypesInList` from `DEPOSIT_TYPES` at import.

### 3.3 `TRANSFERS_SUMMARY_TYPES` order is a frozen external contract 🔴

`INVESTOR_DEPOSIT, LABOR_COST, RABAT, PAYOUT, CORRECTION, LOSS` drives Google Sheet summary
columns I–N via `sheet-configs.ts:83-86` → `sheet-summary.ts:35-44` → `sheets.ts:357-358`.
A naive `filter()` over the table would emit
`CORRECTION, LABOR_COST, RABAT, LOSS, INVESTOR_DEPOSIT, PAYOUT` — and `setupTab` rewrites the
summary block verbatim on any reset/relink, so this would **silently rewrite live client
spreadsheets**. Stays a hand-ordered literal, or carries an explicit `summarySlot: number`.
Guarded by `src/__tests__/lib/google/sheets.test.ts:308-346`.

### 3.4 Payload options must not be derived by `.map()` 🔴

`src/collections/transfers.ts:16-32` declares its own 12-entry `{label:{en,pl}, value}` array
in a third distinct order, cross-checked by `_AllTransferTypesCovered`. Deriving it makes the
assertion tautological — the guard disappears without a single error.

### 3.5 Signature asymmetry is load-bearing

`isExpensesTabType`, `canBeSettled`, `isSheetTransferTabType` take `unknown`; every other
predicate takes `string`. `src/collections/transfers.ts:250` passes raw `data?.type` to
`canBeSettled` and relies on it. Preserve the split.

### 3.6 Unknown ⇒ false, everywhere

Every predicate is guarded by `isTransferType(type)`. A derived table must reproduce that
default or unknown types start passing requirement checks.

### 3.7 Purity

The table module sits in the Payload CLI graph — no `server-only`, `payload`, React or
`next/*` imports.

### 3.8 The module cycle is real and dissolvable

`transfers.ts` ↔ `transfer-rules.ts` exists only to break a load-order cycle. Verified with a
minimal ESM repro: the symptom is a **TDZ `ReferenceError`**, not the `undefined` read the
comment at `transfer-rules.ts:10-13` claims. Nothing else participates; one file dissolves it.

### 3.9 Stale comment to delete

`src/lib/constants/transfers.ts:82` claims `SHEET_TRANSFER_TAB_TYPES` order is the
summary-block column order. **False** — that is `TRANSFERS_SUMMARY_TYPES`. The array is used
only in `{ in: [...] }` wheres and `.includes()`, so it is order-free. Left in place, it would
push a bogus ordering constraint into the table design.

---

## 4. The axis is not one-dimensional

The core finding that reshapes the plan: predicates are **five independent axes per field**,
not one membership question.

| axis | example |
| --- | --- |
| required | `requiresInvestment` |
| shown | `showsInvestment` |
| auto-cleared when not shown | `validate.ts:78-80` uses `!showsInvestment` |
| shown but optional | `otherCategory` on INVESTMENT_EXPENSE / PAYOUT |
| exempt from all cross-field validation | `CANCELLATION` |

`investment` alone consumes three of them, with **two different sets on the same field**
(required by `requiresInvestment`, cleared by `!showsInvestment`). `sourceRegister` and
`worker` require and clear with the *same* predicate. `otherCategory` and `expenseCategory`
are **never** auto-cleared. Collapsing these into one column silently changes validation.

`needsExpenseCategory(type, hasInvestment)` is the only 2-arity predicate — its `CORRECTION`
cell is data-dependent, so the column is three-state (`'always' | 'withInvestment' | false`),
not boolean.

### The validate-hook rule order (`src/hooks/transfers/validate.ts`)

Two short-circuits precede every rule:

```ts
if (type === 'CANCELLATION') { …require cancelledTransaction…; return d }   // :39-44
if (operation === 'update' && d.cancelled) return d                        // :47-49
```

Then, in order: amount sign (:54) · sourceRegister required (:60) / cleared (:65) ·
investment required (:70) / cleared (:78, different predicate) · targetRegister required +
≠ source (:83) · otherCategory required (:92) · worker required (:97) / cleared (:102) ·
settled cleared (:109) · expenseCategory required (:114). Errors accumulate and throw joined.

Fields with **no** server-side rule at all: `vatPlane`, `otherDescription`, `paymentMethod`,
`invoice`.

---

## 5. Latent disagreements (dormant per §2, but real)

| # | what | evidence |
| --- | --- | --- |
| A | **CORRECTION sign: code and three prose sources contradict.** `src/lib/utils/validation.ts:8-10` **rejects** `amount >= 0`. `collections/transfers.ts:88-89`, `validate.ts:53` and **AGENTS.md** all say "may be negative". Author the table from the prose and positive corrections start passing. | code wins; docs get corrected |
| B | **`needsSourceRegister` returns `true` for CANCELLATION** — the only predicate written as an exclusion list (`≠ LABOR_COST/RABAT/LOSS`) instead of a membership test. Consequence: the admin panel renders a „Kasa" picker on a cancellation row, and `sum-transfers.ts:48` puts CANCELLATION in the `ELSE -amount` arm, so a register set there would **silently drain that register**. Never enforced, because `validate.ts:39` returns first. | `transfer-rules.ts:52-53`, `collections/transfers.ts:145` |
| C | **CANCELLATION is a full row in the predicate table but a null row in reality.** A mechanical table-driven rewrite that drops the early return **breaks cancellation outright**. The table needs an explicit *exempt* flag, not derived membership. | `validate.ts:39` |
| D | **`otherCategory` — three readings of one concept**: *shown* (`showsOtherCategory` = OTHER/INVESTMENT_EXPENSE/PAYOUT), *required* (`needsOtherCategory` = OTHER), *always* (`edit-transfer-form.tsx:156`, no gate). Nothing clears it → an edit can weld one onto a LABOR_COST. | `collections/transfers.ts:193,201` |
| E | **`vatPlane` has no predicate** — raw `=== 'INVESTOR_DEPOSIT'` in `collections/transfers.ts:134` and `deposit-form.tsx:140,143`; `toData` sends it unconditionally (`:98`) and no server rule clears it. | needs a `showsVatPlane` column + auto-clear |
| F | **`expenseCategory` required-but-never-cleared** — dropping a correction's investment orphans it. | `reference-data.ts:305` comments on the state |
| G | **`needsOtherCategory` requirement is server-only** — absent from `transferFieldRules`, so it surfaces as a thrown hook error, not an inline field error. | `transfer-validation.ts:31-72` |
| H | `getSecondRowCategory` drops the `hasInvestment` argument. | `line-items-field.tsx:100` vs `:83` |
| I | `internalTransferFormSchema` re-implements three shared rules with different Polish messages; `createInternalTransferSchema` is **dead code**. | `internal-transfer-schema.ts:5-22, 41-63` |
| J | `editExpenseFormSchema` validates amounts **type-blind** — a CORRECTION edit runs the "must be > 0" branch. Masked only because `updateTransferAction:241` discards the amount for anything but LABOR_COST. | `expense-schema.ts:172` |

---

## 6. ~30 raw literals bypass the predicates

- **CANCELLATION — 13 sites.** `isCancellationType` is imported **once**
  (`tables/transfers.tsx:216`); the same file uses the literal twice (`:41`, `:83`).
- **`deriveFinancials` — 5 literals** inside the single source of truth for marża/bilans
  (`investment-financials.ts:42,44,45,46,47`).
- **SQL — 7 literals** in `sum-transfers.ts` (`:54,94,126,282,318,350`), invisible to any TS
  predicate. The sign rule is implicit: `CASE WHEN type IN (deposits) THEN amount ELSE -amount END`,
  so giving `RABAT` or `LOSS` a source register would start debiting cash registers **with no
  code change in that file**.
- **Payload conditions — 3 literals**: `vatPlane` (`:134`), `worker` (`:184`, duplicates
  `needsWorker`), `cancelledTransaction` (`:241`, duplicates `isCancellationType`).
- **Auth**: `roles.ts:39` — `transferType === 'LABOR_COST'` duplicates `isLaborCost`.
- **Amount sign**: `validation.ts:7-12` — raw `type === 'CORRECTION'`, called from 5 places.

Sheet routing itself is clean (`tabsForType` uses the predicates).

---

## 7. Characterization-test coverage gaps

`src/__tests__/transfer-constants.test.ts` is already a truth table, but covers **7 of 15**
predicates. It asserts **nothing** about:

`canBeSettled` · `isExpensesTabType` · `showsOtherCategory` · `needsWorker` · `isLaborCost` ·
`isCancellationType` · `DEPOSIT_UI_TYPES` · `EXPENSES_TAB_TYPES` · `TRANSFERS_SUMMARY_TYPES` ·
`TRANSFER_TYPE_LABELS` · `TRANSFER_TYPE_COLORS`

`canBeSettled` and `isExpensesTabType` gate real money math. **The net must be widened on the
CURRENT implementation before any rewrite** — a test written after the refactor proves nothing
about behaviour preservation.

Existing coverage to lean on: `validate-hook.test.ts`, `transfer-schema.test.ts`,
`transfer-rabat.test.ts`, `transfer-loss.test.ts`, `settled-vs-unsettled-expense.test.ts`,
`sum-transfers.test.ts`, `lib/google/sheets.test.ts:308-346`.

---

## 8. Expenses summary — where a netto bucket would live

There is **no** shadcn/Radix `Tabs` in the repo; every "tab" is a `ToggleGroup` pill switch.
No UI tab set is derived from transfer types. (`EXPENSES_TAB_TYPES` /
`SHEET_TRANSFER_TAB_TYPES` mean **Google Sheet** tabs, not UI tabs.)

The surface is `src/components/kosztorys/summary/kosztorys-totals-panel.tsx` — a static
`SUMMARY_VIEW_OPTIONS` array (`:40-46`) whose second entry is „Wydatki". A tab id lives in
**three** places: the `SummaryViewT` union, `VALID_VIEWS`, and `SUMMARY_VIEW_OPTIONS`
(`hooks/use-summary-view.ts:9-24`).

**Precedent for a bucket split — `settled`.** `MaterialsTransactionsTable`
(`tables/materials-transactions-table.tsx:19-26,61-78`) already does exactly this: a **nested**
`ToggleGroup` inside the Wydatki tab („Wydatki inwestycyjne" / „Materiały wliczone
w robociznę"), local `useState`, and the switch **hides itself when the bucket is empty**
(`hasSettled`). One over-fetch serves both sets.

Cost comparison for a netto bucket:

- **nested toggle** (precedent) — zero panel/hook edits, one component.
- **new top-level tab** — ~7 files: the union + `VALID_VIEWS` + options array + branch + a new
  tab component, and if it needs new data, `KosztorysEditorDataT` must be threaded through
  `kosztorys-editor-body.tsx:218` **and both** page assemblers
  (`inwestycje/[id]/kosztorys_v2/page.tsx` **and** `lib/queries/client-kosztorys.ts:41` — the
  client-share path builds its data independently; miss it and the client view breaks).

Cancelled rows are excluded from every kosztorys summary surface by four independent
hardcoded filters, with no UI to reveal them.

---

## 9. Cancellation semantics — the two concepts

| | `type = 'CANCELLATION'` | `cancelled = true` |
| --- | --- | --- |
| what | a new stub row — audit receipt | a state change on the original |
| money meaning | **none** — not a reversal, not a counter-entry | **everything** — the sole mechanism removing the original from every figure |
| relational fields | all NULL (0/256 in the DB) | unchanged |

The reversal works by **excluding the original**, never by a compensating entry —
`src/lib/queries/transfers.ts:143-145` states the invariant. `cancelTransferAction`
(`actions/transfers.ts:169-217`) does two writes with **no transaction wrapper**: flip the
flag, then create the stub with `amount` copied verbatim (sign preserved, not negated).

`ON DELETE SET NULL` on `cancelled_transaction_id` means hard-deleting an original **orphans**
its CANCELLATION — one such row exists locally (`id=877`).

Sheet sync: a cancellation only ever *removes*. `SHEET_SYNCED_TYPES`
(`hooks/transfers/sync-sheet.ts:20`) excludes CANCELLATION, so the stub's own `afterChange`
never fires; removal is driven by the `cancelled: true` update on the original.
`syncSingleTransferToSheet` (`sheets-sync.ts:322-342`) still carries a **redundant second
path** for cancellations — unreachable from the hook, exercised only by tests.

For the spec table: **CANCELLATION carries `never` in every field column**, and
`needsSourceRegister` returning `true` is a defect in the predicate, not a statement about the
type.
