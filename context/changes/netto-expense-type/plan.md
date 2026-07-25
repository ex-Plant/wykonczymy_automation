# Netto investment-expense type — Implementation Plan

## Overview

Add a new transfer type `INVESTMENT_EXPENSE_NET` (sibling to `INVESTMENT_EXPENSE`) that carries a
**second stored amount** `netAmount`. The expense leaves the cash register at **brutto** (`amount`,
the physical cash fact) but is billed to the investor at **netto** (`netAmount`). This lets the owner
book an invoice he took "na siebie" (VAT reclaimed) at the netto he actually pays, while the kasa
still reconciles to the grosz.

Full spec + rationale: `context/changes/netto-expense-type/design.md`.

## Current State Analysis

Verified by two research sweeps (2026-07-23/24), captured in `design.md`:

- **Kasa is structurally isolated.** `sumRegisterBalance` (`src/lib/db/sum-transfers.ts:35-64`) has
  its own `SELECT`, subtracts any non-`DEPOSIT_TYPES` row as an outflow, and shares no `SUM(amount)`
  helper with materiały. Keeping the net-type out of `DEPOSIT_TYPES` makes it an outflow at brutto
  with zero changes to that query.
- **The type union is defined twice** (`src/lib/constants/transfers.ts:2-16` canonical, plus the
  Payload options in `src/collections/transfers.ts:16-32`) and cross-checked at compile time
  (`_AllTransferTypesCovered`). `TRANSFER_TYPE_LABELS` / `TRANSFER_TYPE_COLORS` are
  `Record<TransferTypeT,…>` → a missing key **breaks the build**.
- **SQL grouping is granular** — `sumAllInvestmentFinancials` groups by `(investment_id, type, settled)`
  and `sumCategoryByTypeSettled` by `(category, type, settled)`, so a new type surfaces as its own row.
  The **collapse** happens one layer up in `deriveFinancials` / `deriveCategoryBreakdowns`
  (`src/lib/db/investment-financials.ts`), where every type whose `financialBucket` is `'materials'`
  folds into the single scalar `totalMaterialCosts`. (Post-EX-573 that collapse reads the spec-table
  column, not `isExpensesTabType` — the routing and the money are separate questions now.)
- **Both bilanses read `totalMaterialCosts`** — transfers-side `calculateBalance`
  (`src/lib/db/calculate-balance.ts:6`) and kosztorys-side `computeDoZaplatyRM`
  (`src/lib/kosztorys/summary-economics.ts:110`). Netting the net-type moves both (owner: "oba").
- **Marża does not read materiały** (`calculate-margin.ts:13`, `totalLaborCosts − payouts − rabat −
loss − totalSettled`), but `totalSettled` is a sibling bucket marża **does** read.
- **The global kosztorys toggle** (`materialsAsNet` / `materialsReduction`) is applied in one place,
  `materialyPair` (`summary-economics.ts:33-42`), consumed by `computeDoZaplatyRM` and
  `computeSummarySplit`.
- **The editor payload** collapses materiały to a single `materialsGross: number`
  (`KosztorysEditorDataT`, `src/lib/kosztorys/types.ts:123-144`), assembled at TWO sites:
  `src/lib/queries/client-kosztorys.ts:56` and `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:84`.
- **The create form** (`src/components/forms/expense-form/expense-form.tsx`) submits a line-items
  array and already gates fields on `currentType`; `vatPlane` (`transfers.ts:120-136`) is the
  precedent for a conditional immutable field.

## Desired End State

The owner can add an expense as "Wydatek inwestycyjny netto", typing both a brutto and a netto amount
(netto ≤ brutto). The register drops by brutto; the investor's bilans / "Do zapłaty R+M" rises by
netto. In the kosztorys Podsumowanie the net-type share shows as its own frozen netto row per
kategoria, immune to the global "wszystko netto" toggle (no double cut). The transaction list shows
the netto amount in a distinct color. Marża is unchanged. Every register balance is unchanged.
Guards B1–B5 + B7 pass as unit tests.

Verify: unit suite green; manually, adding a net-type expense drops the register by brutto and raises
"Do zapłaty" by netto, and turning the global toggle on does not cut the net-type row further.

### Key Discoveries

- Kasa isolation is structural, not incidental — `sum-transfers.ts:35-64`. Do NOT touch it.
- The collapse to fix is `deriveFinancials`/`deriveCategoryBreakdowns`, not the SQL — `investment-financials.ts:16-53`.
- One toggle application point to split — `materialyPair`, `summary-economics.ts:33-42`.
- Two editor-payload assembly sites must stay in lockstep — `client-kosztorys.ts:56` + `kosztorys_v2/page.tsx:84`.
- `netAmount` is stored, not derived → no VAT math, no rounding, B5 holds by construction.

## What We're NOT Doing

- **No `netRate` / VAT computation** — netto is typed, not derived. No shared rounding helper.
- **No edit path for `netAmount`** — immutable after create; correction is cancel + re-add. B6 removed.
- **Not touching `sumRegisterBalance`** or `DEPOSIT_TYPES` — kasa stays brutto.
- **Not touching `vatPlane`** (the deposit NET/GROSS field) — unrelated concept.
- **Net-type is not settleable** — `settleable: false` in its spec-table row, so it can never reach `totalSettled`/marża.
- **No data backfill** — kosztorys/spike data is throwaway (AGENTS.md).
- **No audit log** for the netto figure (amount edits are logged; this is a noted gap, out of scope).
- **No B6 integration test** and no E2E in this PR — structural units only.

## Implementation Approach

Bottom-up in dependency order: (1) the type + DB schema so writes are legal, (2) the financial
derivation split so both bilanses see netto while kasa/marża don't, (3) thread the two buckets to the
editor and rewrite the toggle composition so the net-type is frozen, (4) the create form + list UI.
Each phase typechecks on its own and lands its guards.

The spine is the **two-bucket split**: `deriveFinancials` classifies `INVESTMENT_EXPENSE_NET` rows
into `materialsNetBilled` (Σ `netAmount`, frozen) instead of the brutto `totalMaterialCosts`/base.
Downstream, only the brutto base flows through the global toggle; the net-type bucket is added after,
untouched. This makes double-deduction structurally impossible — the net-type amount is simply not in
the number the toggle multiplies.

## Critical Implementation Details

**Timing & ordering.** The Postgres **enum** migration (`ADD VALUE`) must be applied before any code
path writes the new type, and Postgres cannot add an enum value and use it in the same transaction —
keep the enum `ADD VALUE` in its own migration, separate from anything that references it. Apply both
migrations to the local dev DB before running the app; prod migration is a human, deploy-time step
(AGENTS.md `payload-prod-migrate`) and is NOT part of this local task.

**State sequencing (the split must survive both planes).** `deriveCategoryBreakdowns` and
`deriveFinancials` must classify the net-type consistently: its `netAmount` goes to the netto bucket
in BOTH the scalar totals and the per-category breakdown, and its brutto `amount` appears in NEITHER
the brutto base nor `totalSettled`. A net-type row contributing `amount` to the brutto base anywhere
reintroduces the double-cut.

## Phase 1: Type + schema foundation

### Overview

Make `INVESTMENT_EXPENSE_NET` a legal, well-classified transfer type with an immutable `netAmount`
field and the DB columns to store it. No financial-math change yet — this phase only lands the type,
the field, the predicate-set memberships, and the migrations.

### Changes Required

> **Rewritten 2026-07-25 for EX-573.** This phase was planned against ~12 independent membership
> arrays split across `transfers.ts` and `transfer-rules.ts`. That file is gone and those decisions
> are now one compile-checked row in `TRANSFER_TYPE_SPECS`. What was "visit N arrays and remember
> each one" is now "fill in one row, and the build refuses to compile until every column has an
> answer". The two columns the pre-EX-573 plan could not name — `financialBucket` and the
> brutto-vs-netto question — are decided in §2 below.

#### 1. One spec-table row

**File**: `src/lib/constants/transfers.ts`

**Intent**: Register the type in the union and answer every column of `TRANSFER_TYPE_SPECS`. The
`satisfies Record<TransferTypeT, TransferSpecT>` makes a forgotten column a build error, so this
replaces the old "add it to `EXPENSES_TAB_TYPES` / `INVESTMENT_TYPES` / carve out of `canBeSettled`"
checklist entirely.

**Contract**: add `'INVESTMENT_EXPENSE_NET'` to `TRANSFER_TYPES` — that array is sorted by Polish
label (its own header comment says so), so it goes right after `'INVESTMENT_EXPENSE'`. The
create-form dropdown is a different array, `TRANSACTION_TRANSFER_TYPES`, ordered separately. Then
the row:

| Column | Value | Why |
|---|---|---|
| `label` | `'Wydatek inwestycyjny netto'` | |
| `color` | a **not-yet-used** `chart-*` token, not amber | grep the map + `@theme` before picking |
| `deposit` | `false` | it is an expense |
| `expensesSheetTab` | `true` | shares routing / category / sheet-sync with the brutto expense |
| `transfersSheetTab` | `false` | |
| `settleable` | **`false`** | decision B4 — this is the split the whole table exists for |
| `financialBucket` | **`'materialsNet'`** (new value) | see §2 |
| `sourceRegister` | `'required'` | the cash leaves a register at brutto |

`TRANSFER_TYPE_LABELS` and `TRANSFER_TYPE_COLORS` are derived from the row — do not edit them.
The literal arrays that stayed literal still need the type appended by hand, and the consistency
suite is what tells you which: `TRANSACTION_TRANSFER_TYPES` (ordered create-form dropdown) and
`EXPENSES_TAB_TYPES` (spread eagerly into `sync-sheet.ts` at module load). **Not** `DEPOSIT_TYPES`,
**not** `TRANSFERS_SUMMARY_TYPES` (fixed sheet column layout, deliberately decoupled).

The per-field form predicates below the table are still independent axes, not columns — add the
net-type to `needsExpenseCategory` so it carries an expense category, and check `showsOtherCategory`.

#### 2. The two columns EX-573 deferred to this change

**File**: `src/lib/constants/transfers.ts` (Phase 1 adds both columns; Phase 2 consumes
`billedAmount` — no financial math changes here)

**Intent**: `financialBucket` answers *which figure a type feeds*. It does **not** answer *which
stored column to sum* — every existing type bills at `amount`, so that question had no second answer
and no column. The net-type is the first type where the two diverge, so this change owns both.

**Contract**:

- **`financialBucket: 'materialsNet'`** — a new bucket value, NOT `'materials'`. Reusing `'materials'`
  would put the net-type in the same bucket as brutto material and hand the brutto-vs-netto question
  back to an `if` inside `deriveFinancials` — exactly the scattered predicate EX-573 removed. A
  distinct bucket makes the double-cut structurally impossible: the net-type is simply not in the
  number the global toggle multiplies (Phase 2's spine).
- **`billedAmount: 'amount' | 'netAmount'`** — add the column, `'amount'` for all twelve existing
  types, `'netAmount'` for the net-type. This is the column EX-573 identified and deliberately left
  to this change, because this is the change that rewrites `deriveFinancials` and carries the tests.
  Without it the netto rule lives as a type-name comparison mirrored across `deriveFinancials` and
  `deriveCategoryBreakdowns` — the exact shape that leaked marża before.

  **Where it is consumed is load-bearing.** `TypeSettledTotalT` is `{ type, settled, total }` — one
  already-aggregated sum. By the time `deriveFinancials` runs, the amount-vs-netAmount choice has
  been made in SQL, and `billedAmount` is a TypeScript value SQL cannot read. So the row shape must
  carry **both** sums (`total` = Σ`amount`, `totalNet` = Σ`net_amount`) and `deriveFinancials` picks
  by `billedAmount`. The alternative — `SUM(CASE WHEN type = 'INVESTMENT_EXPENSE_NET' …)` in the
  query — puts the type name back into SQL, where the spec table cannot reach it and the next
  netto-billed type would silently miss the CASE. Pinned to the two-sums shape; Phase 2 §2 implements
  it.

**Two spec-table tests go red on purpose, and both must be updated deliberately, not silenced:**

- `transfer-spec-table.test.ts` › *"the materials bucket is exactly the expenses-tab column"* — it
  pins that those two questions agree **today**. The net-type is what makes them disagree; that is
  the finding the test exists to force. Rewrite it to assert the expenses-tab column equals
  `'materials' ∪ 'materialsNet'`.
- `transfer-spec-table.test.ts` › *"settleable vs expensesSheetTab — agree today for all twelve
  types"* — the net-type is the counter-example the comment already names. Replace the blanket
  equality with the one-directional rule the file already asserts separately (settleable ⇒
  expenses-tab), and drop the coincidental-equality test with a note that the net-type ended it.

Also extend `financialBucket`'s allowed-values test and the `only a materials type is settleable`
pin, which currently reads `'materials'` literally.

#### 3. Payload collection: option + `netAmount` field

**File**: `src/collections/transfers.ts`

**Intent**: Add the selectable type and its immutable netto companion field, shown only for the net-type.

**Contract**: Add the Payload `{label:{en,pl}, value:'INVESTMENT_EXPENSE_NET'}` option (satisfies
`_AllTransferTypesCovered`). New `netAmount` number field: `access:{update:()=>false}`,
`admin.condition:(data)=>typeOf(data)==='INVESTMENT_EXPENSE_NET'` (copy the `vatPlane` shape, lines
120-136), no `defaultValue`. **No validate here** — the `netAmount != null` / `netAmount <= amount`
rule has ONE authority, `src/hooks/transfers/validate.ts` (Phase 4 §1), where every other
type-conditional rule already lives and which every write path passes through. The form schema's
refine is UX, not the guard.

#### 4. Migrations (two, hand-written)

**File**: `src/migrations/<ts>_add_investment_expense_net_type.ts` and
`src/migrations/<ts>_add_net_amount_to_transactions.ts`

**Intent**: Make the enum value and the column exist in Postgres.

**Contract**: Migration A: `ALTER TYPE "public"."enum_transactions_type" ADD VALUE
'INVESTMENT_EXPENSE_NET'` (precedent `20260212_191046_add_deposit_type.ts`). Migration B:
`ADD COLUMN IF NOT EXISTS "net_amount" numeric` on `transactions` (precedent
`20260721_1_add_vat_plane_to_transactions.ts`). Register both in `src/migrations/index.ts`, enum
migration ordered first. Apply to local dev DB only.

#### 5. Update constants test

**File**: `src/__tests__/transfer-constants.test.ts`

**Intent**: The truth table asserts every predicate's answer for every type; the net-type needs a
row in each `trueFor` list it belongs to (`isExpensesTabType` true, `canBeSettled` **false**,
`needsSourceRegister` true, `needsExpenseCategory` true, `showsInvestment`/`requiresInvestment` true).

**Contract**: Add the net-type to the asserted `trueFor` lists. The `covers every exported predicate`
test derives from the module namespace, so a new *predicate* would fail it — a new *type* will not;
the per-type coverage comes from `TRANSFER_TYPES` being iterated. See also the two deliberately-red
spec-table tests in §2, which live in `transfer-spec-table.test.ts`, not here.

### Success Criteria

#### Automated Verification:

- Type checking passes: `pnpm generate:types && pnpm tsc --noEmit`
- Constants test passes: `pnpm exec vitest run src/__tests__/transfer-constants.test.ts`
- Both migrations apply cleanly to local dev DB: `pnpm payload migrate` (against local `DB_POSTGRES_URL`)

#### Manual Verification:

- In the Payload admin, creating a transaction with type "Wydatek inwestycyjny netto" shows the
  `netAmount` field; other types do not.
- `netAmount > amount` is rejected on save.

---

## Phase 2: Financial split (two buckets, kasa/marża untouched)

### Overview

Split the materiały aggregate so the net-type's `netAmount` lands in its own frozen netto bucket
(scalar + per-category), the brutto base holds everything else, `totalSettled` and `sumRegisterBalance`
are untouched. This is the correctness core.

### Changes Required

#### 1. Derive two buckets + per-category split

**File**: `src/lib/db/investment-financials.ts`

**Intent**: Emit a separate frozen netto bucket, in both the scalar totals and the per-category
breakdown. Post-EX-573 the classification is already done for you — `financialBucketOf(r.type)`
returns `'materialsNet'` and `billedAmount` says which column to sum — so this is a routing change,
not a new predicate.

**Contract**: `deriveFinancials` returns new fields `materialsNetBilled` (Σ `netAmount` of unsettled
net-type rows) and `materialsGrossBase` (the existing brutto material sum, now excluding net-type).
**`totalMaterialCosts` is KEPT** as `materialsGrossBase + materialsNetBilled` — decided, not left to
a consumer audit. Two consumers make it non-negotiable: `calculateBalance` (which therefore needs no
change at all — Phase 2 §3 below is a no-op) and the golden-master fixture, which snapshots it for
100 investments. `totalSettled` unchanged (net-type never settled).
`deriveCategoryBreakdowns` keeps `type` and emits, per category, a brutto sub-total and a net-type
netto sub-total. `InvestmentFinancialsT` (`src/types/investment-financials.ts`) widens accordingly;
`MaterialyBreakdownRowT` gains an origin/bucket marker.

#### 2. Carry `net_amount` through the aggregation

**File**: `src/lib/db/sum-transfers.ts`

**Intent**: The totals/category queries must expose `net_amount` for net-type rows so `deriveFinancials`
can sum netto. `sumRegisterBalance` stays exactly as is.

**Contract**: `sumAllInvestmentFinancials` / `sumCategoryByTypeSettled` select `SUM(net_amount)` (or
carry it per grouped row) alongside `SUM(amount)`. `sumRegisterBalance` / `sumAllRegisterBalances`:
**no change** (asserted by B2).

#### 3. Bilans consumers read the split

**File**: `src/lib/db/calculate-balance.ts`

**Intent**: The transfers-side bilans must count the net-type at netto, brutto expenses at brutto.

**Contract**: **No change** — this section survives as a note on why. `totalMaterialCosts` is kept as
`materialsGrossBase + materialsNetBilled` (§1), which is exactly the figure `calculateBalance`
already reads, so the transfers-side bilans counts the net-type at netto for free. Verify by reading
the file; do not edit it. (Marża file untouched — asserted by B3.)

### Success Criteria

#### Automated Verification:

- Type checking passes: `pnpm tsc --noEmit`
- B2 (kasa brutto): **DB integration**, not a unit. Asserting `INVESTMENT_EXPENSE_NET ∉ DEPOSIT_TYPES`
  is already pinned by `transfer-spec-table.test.ts` (`DEPOSIT_TYPES === deposit column`) — a second
  array-vs-array assertion guards nothing. The risk lives in the SQL: `sumRegisterBalance` subtracts
  `amount`, and only a query actually executed against a DB can prove it never switched to
  `net_amount`. New spec under `src/__tests__/lib/db/`, gated on `describe.skipIf(!ENV_READY)` so
  `scripts/test-integration.sh` discovers it: create a net-type expense brutto 1230 / netto 1000 on a
  self-provisioned register, assert the balance moved by exactly −1230. Run: `pnpm test:integration`.
- B3 (marża unmoved): unit — marża identical whether an unsettled expense is `INVESTMENT_EXPENSE` or
  `INVESTMENT_EXPENSE_NET`.
- B4 (no settled leak): unit — a net-type row is never routed to `totalSettled`; its spec row says `settleable: false`.
- Bucket assignment unit — a net-type row lands in `materialsNetBilled` (its `netAmount`), never in
  `materialsGrossBase`.
- **Golden master unmoved** — `pnpm test:parity`. No net-type row exists in the restored dataset, so
  this refactor may not move a single figure across 100 investments, 29 registers and 36 workers.
  It is the strongest acceptance net this phase gets, and it is free: a drift line here means the
  split leaked into the existing brutto path.

#### Manual Verification:

- Bilans inwestora on an investment with a net-type expense reflects netto, not brutto.
- Register balance on that investment's source register is unchanged by the net-type's presence.

---

## Phase 3: Editor threading + toggle composition

### Overview

Carry the two buckets to the kosztorys editor and rewrite the summary composition so only the brutto
base flows through the global toggle; the net-type bucket is added post-toggle, frozen. Render the
per-category netto rows in Podsumowanie.

### Changes Required

#### 1. Widen the editor payload

**File**: `src/lib/kosztorys/types.ts`, `src/lib/queries/client-kosztorys.ts`,
`src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`

**Intent**: Replace the single `materialsGross` with the two buckets, at both assembly sites, in lockstep.

**Contract**: `KosztorysEditorDataT` gains `materialsNetBilled: number` + `materialsGrossBase:
number` (keep `materialsGross` only if a consumer needs the combined). Both assembly sites populate
them from `deriveFinancials`. The `materialyBreakdown` carries the per-category netto rows.

#### 2. Split the toggle composition

**File**: `src/lib/kosztorys/summary-economics.ts`

**Intent**: The global toggle must cut only the brutto base; the net-type netto is added afterwards,
untouched — the structural kill for double-deduction.

**Contract**: `computeDoZaplatyRM` (110-124) and `computeSummarySplit` (85-103): pass
`materialsGrossBase` through `materialyPair` (the toggle), then add the net-type bucket **outside**
`materialyPair`. `materialyPair` itself is unchanged; only what the callers feed it changes.

Two things the "add it afterwards" phrasing must not be read to mean:

- **Both axes, at face value.** `MoneyPairT` carries `net` AND `gross`. The net-type is already netto
  and carries no VAT toward the investor, so it enters as `faceValue(materialsNetBilled)` — the same
  number on both axes. Adding it only to `.net` would leave the brutto "Do zapłaty R+M" silently
  short by the whole net-type amount.
- **Before the udziały, not after.** In `computeSummarySplit`, `combinedNet` is the denominator every
  `share` divides by. The net-type bucket must be folded in *before* `combinedNet` is computed, or
  the udziały stop summing to 100%. "Post-toggle" ≠ "post-share": the correct order is
  `materialyPair(grossBase)` → add the frozen bucket → derive `combinedNet` and the shares.

#### 3. Render per-category netto rows

**File**: `src/components/kosztorys/summary-breakdown-table.tsx` (+ the breakdown row type)

**Intent**: Show each category's net-type share as its own frozen "…netto" row, so the brutto rows the
toggle affects stay pure.

**Contract**: The breakdown maps net-type netto sub-totals to their **own visible rows** (label
"<kategoria> netto") — never folded into the kategoria's brutto row. Rendered at their stored
`netAmount` on both axes (face value), regardless of the toggle. Brutto category rows keep the
existing toggle-driven valuation. Note the collision: `MaterialyBreakdownRowT.net` already names a
brutto-derived figure, so the new rows need a bucket/origin marker rather than a second meaning for
`net`.

### Success Criteria

#### Automated Verification:

- Type checking passes: `pnpm tsc --noEmit`
- B1 (no double deduction): unit on the composition — with the global toggle at −8%, the net-type's
  contribution equals its `netAmount` exactly, not `netAmount × 0.92`.
- Both axes: unit on `computeDoZaplatyRM` — a net-type expense raises `.net` AND `.gross` by exactly
  its `netAmount`.
- Udziały: unit on `computeSummarySplit` — with a net-type expense present, the shares still sum to 1.
- B5 (list == summary): unit — the value a net-type row contributes to the aggregate equals its stored
  `netAmount` (same value, no rounding).
- Existing kosztorys summary/economics unit tests still pass: `pnpm exec vitest run src/__tests__` (economics specs).

#### Manual Verification:

- In Podsumowanie, a net-type expense shows as its own netto row under its kategoria.
- Toggling "wszystko netto −X%" does not change the net-type row; it changes only the brutto rows.
- "Do zapłaty R+M" matches the bilans inwestora for the same investment.

---

## Phase 4: Create form + transaction list

### Overview

Let the user pick the type and type both amounts (netto ≤ brutto), persist `net_amount`, and show the
net-type row in the transaction list at netto in its color.

### Changes Required

#### 1. Form field + schema + persistence

**File**: `src/components/forms/expense-form/expense-form.tsx`,
`src/components/forms/expense-form/expense-schema.ts`,
`src/components/forms/expense-form/map-line-item.ts`, `src/lib/actions/transfers.ts`

**Intent**: A per-line netto field appears when the line's type is the net-type; the amount is
validated ≤ brutto and threaded to the DB write.

**Contract**: Gate a `netAmount` input on `currentType==='INVESTMENT_EXPENSE_NET'` (the form already
gates fields on `currentType`); add `netAmount` to the line-item client + server schemas with a refine
`netAmount <= amount` (B7). `map-line-item.ts` + the bulk transfer action thread `net_amount` into the
persisted doc. Add the net-type + `netAmount≤amount` rule to `src/hooks/transfers/validate.ts`
(predicate-driven, mirrors the vatPlane guard).

#### 2. List row: netto + color

**File**: `src/components/tables/transfers.tsx`, `src/types/transfers.ts`,
`src/lib/queries/transfer-mapping.ts`

**Intent**: The net-type row shows its netto amount in the new color; the label/color maps already
apply via Phase 1.

**Contract**: Thread `net_amount` through `TransferRowT` + `mapTransferRow`. For a net-type row the
amount cell shows **both** figures — brutto as the primary value, netto beneath/beside it as a
secondary line (e.g. `1 230,00 zł` · `netto 1 000,00 zł`). Decided: showing only netto would break
the register view, where summing the column must reconcile to the kasa balance; showing only brutto
would hide what the investor is actually billed. Every other type renders exactly as today — the
second line appears only when `billedAmount === 'netAmount'`, so this is not a column-wide change.
Color comes from `TRANSFER_TYPE_COLORS`.

### Success Criteria

#### Automated Verification:

- Type checking passes: `pnpm tsc --noEmit`
- B7 (netto ≤ brutto): unit on the validate hook (the single authority) plus the form schema refine — a net-type line with
  `netAmount > amount` is rejected.
- Full unit suite passes: `pnpm exec vitest run`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Adding a "Wydatek inwestycyjny netto" line: the netto field appears, `netAmount > amount` is blocked,
  submit persists both amounts.
- The transaction list shows the net-type row with both amounts (brutto primary, netto secondary) in
  the new color; other types are visually unchanged.
- The source register drops by brutto after the submit.

---

## Testing Strategy

### Unit Tests

- **B1** double-deduction (composition, Phase 3), **B2** kasa brutto (Phase 2), **B3** marża unmoved
  (Phase 2), **B4** no settled leak (Phase 2), **B5** list == summary (Phase 3), **B7** netto ≤ brutto
  (Phase 4). Bucket-assignment unit (Phase 2).
- Assert **observable state / returned aggregates**, not implementation internals (per AGENTS.md test
  guidance).

### Integration Tests

- **One** (Phase 2): B2 kasa-brutto against the 5435 `db-test` container — a net-type expense moves
  the source register by its **brutto**. This is the single guard the owner cares most about ("kasa
  zgadza się do grosza") and it is unreachable from a unit test, because the rule lives in
  `sumRegisterBalance`'s `CASE`, not in a TypeScript array. Self-provisions its own register +
  investment like its neighbours; must carry the `describe.skipIf(!ENV_READY)` marker or the pre-push
  gate never runs it.
- B6 remains removed.

### Manual Testing Steps

1. Add a net-type expense (brutto 1230, netto 1000) to an investment; confirm the source register
   drops by 1230.
2. Confirm "Do zapłaty R+M" and bilans inwestora rise by 1000.
3. Turn on the global "wszystko netto −8%" toggle; confirm the net-type row is unchanged and only
   brutto rows are cut.
4. Confirm marża is unchanged by the net-type expense.
5. Try `netAmount > amount` in the form; confirm rejection.

## Performance Considerations

Negligible — one extra `SUM(net_amount)` column in existing grouped queries; no new query, no new
round-trip. The editor payload gains two scalars.

## Migration Notes

Two hand-written migrations (enum value, then `net_amount` column), applied to the local dev DB.
Prod is a deliberate human step at deploy time (`pnpm db:migrate:prod`, `payload-prod-migrate` skill) —
NOT part of this local implementation task. Data is throwaway (kosztorys/spike scope) — no backfill.

## References

- Design/spec: `context/changes/netto-expense-type/design.md`
- Kasa isolation: `src/lib/db/sum-transfers.ts:35-64`
- Collapse point: `src/lib/db/investment-financials.ts:16-53`
- Toggle application: `src/lib/kosztorys/summary-economics.ts:33-42`
- Conditional-field precedent: `src/collections/transfers.ts:120-136` (`vatPlane`)
- Enum migration precedent: `src/migrations/20260212_191046_add_deposit_type.ts`
- Column migration precedent: `src/migrations/20260721_1_add_vat_plane_to_transactions.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Type + schema foundation

#### Automated

- [ ] 1.1 Type checking passes: `pnpm generate:types && pnpm tsc --noEmit`
- [ ] 1.2 Constants test passes: `pnpm exec vitest run src/__tests__/transfer-constants.test.ts`
- [ ] 1.3 Both migrations apply cleanly to local dev DB: `pnpm payload migrate`

### Phase 2: Financial split (two buckets, kasa/marża untouched)

#### Automated

- [ ] 2.1 Type checking passes: `pnpm tsc --noEmit`
- [ ] 2.2 B2 (kasa brutto): DB integration @5435 — net-type expense moves the register by −brutto
- [ ] 2.3 B3 (marża unmoved): marża identical across the two types for an unsettled expense
- [ ] 2.4 B4 (no settled leak): net-type never routed to `totalSettled`; spec row `settleable: false`
- [ ] 2.5 Bucket assignment: net-type lands in `materialsNetBilled`, never in `materialsGrossBase`
- [ ] 2.6 Golden master unmoved: `pnpm test:parity` — zero drift lines

### Phase 3: Editor threading + toggle composition

#### Automated

- [ ] 3.1 Type checking passes: `pnpm tsc --noEmit`
- [ ] 3.2 B1 (no double deduction): net-type contribution equals `netAmount` exactly with toggle on
- [ ] 3.3 Both axes + udziały: net-type adds `netAmount` to `.net` AND `.gross`; shares still sum to 1
- [ ] 3.4 B5 (list == summary): net-type aggregate contribution equals stored `netAmount`
- [ ] 3.5 Existing kosztorys economics unit tests still pass

### Phase 4: Create form + transaction list

#### Automated

- [ ] 4.1 Type checking passes: `pnpm tsc --noEmit`
- [ ] 4.2 B7 (netto ≤ brutto): net-type line with `netAmount > amount` rejected (schema + hook)
- [ ] 4.3 Full unit suite passes: `pnpm exec vitest run`
- [ ] 4.4 Lint passes: `pnpm lint`
