# EX-555 — Robocizna + rabat from the kosztorys; write-switch of LABOR_COST/RABAT — Implementation Plan

## Overview

Two moves in one change. **Read-switch:** the investments listing and the v2 Marża tab stop deriving
robocizna and rabat from transactions and read them from the kosztorys instead — the same pair the
Podsumowanie panel already reads. **Write-switch:** `LABOR_COST` and `RABAT` stop being offered in
the transfer form, so no new row can be booked on the plane we just stopped reading. Existing rows
stay as legacy: enum, history, sheet sync, cancellation — all untouched.

robociz## Current State Analysis

- The listing computes every figure from one transactions `GROUP BY`
  (`shape-investments.ts:18-74` ← `fetchInvestmentFinancials` ← `sumAllInvestmentFinancials`). The
  kosztorys is never touched, so the same investment shows one bilans on `/inwestycje` and another in
  its own Podsumowanie.
- The v2 panel already owns the switch, inline: `investment-summary-panel.tsx:60-66` builds rows,
  falls back to `readingFromTransactions` when `rows.length === 0`, and hands the pair to
  `SummaryPanelContent` via `{...reading}`.
- **The Marża tab is not on the switch.** `summary-margin-tab.tsx:31` reaches past `reading` into
  `financials.totalLaborCosts` / `financials.totalRabat`, so v2's own margin still speaks the
  transactions plane while the block above it speaks the kosztorys.
- `fetchInvestmentFinancials` is tagged `[transfers, investments]` only (`balances.ts:65`). No
  kosztorys tag anywhere on that read.
- Write-switch is two lines: `TRANSACTION_TRANSFER_TYPES` (`constants/transfers.ts:277-278`), whose
  only consumer is `expense-form.tsx:250`.

Full evidence: `research.md`. Owner rulings 1–12: `change.md`.

## Desired End State

- `/inwestycje` sources robocizna and rabat from the kosztorys for every investment that has one, and
  from transactions for every investment that does not — one rule, shared with the panel, not two
  copies.
- The listing and the v2 Podsumowanie agree on bilans and marża. The listing and **v1** legitimately
  disagree; v1 is legacy kept for side-by-side comparison.
- No new `LABOR_COST` or `RABAT` can be booked from the transfer form. Every existing row still
  renders, filters, cancels, and syncs to the sheet.
- The reconciliation alert still fires on old investments that carry both planes, and goes quiet on
  an investment that has neither figure booked.
- Editing the kosztorys invalidates the listing's figures.

### Key Discoveries

- **Materialization has an anti-precedent, not a precedent** — `20260218_add_investment_financials.ts`
  added the columns, `20260222_drop_materialized_columns.ts` removed them four days later. There is
  also no chokepoint to recompute at: five raw SQL statements bypass Payload hooks, and the admin
  panel bypasses server actions. Hence a read, not option C.
- **The client-view formula collapses to a plain SQL aggregate.** `stagesForView(stages, 'client')`
  filters nothing (`settlement-view.ts:27`), `clientTotalsFromSubtotals` reads only `net` and
  `discount`, and there is **no rounding** on the path to those two figures. Research rejected option B
  by measuring it against the whole `sectionSubtotalsForView`; against the two figures actually needed
  it is `SUM` + a three-branch `CASE`. Hence B (SQL aggregate), not D (batched read) — see Phase 1 for
  the numbers that decided it.
- **Seam A would silently kill the reconciliation.** `investment-summary-panel.tsx:91-96` feeds
  `financials.totalLaborCosts` / `totalRabat` to `buildKosztorysReconciliation` as the "actual" side.
  Switching them inside `deriveFinancials` makes the comparator receive the same number twice, and
  five "reconciles silently" specs stay green asserting `x === x`. Hence seam B.
- **No spec in `src/__tests__` feeds `shapeInvestments` or `calculate*` an investment that has
  kosztorys rows.** Every fixture in this area exercises the fallback branch, so the whole suite goes
  green testing only the old definition.
- **The dataset is blind on the new axis.** `dumps/dump-latest.sql`: 109 investments, 3 565
  transactions, **0** kosztorys items / sections / stage progress. `pnpm test:parity` green after
  this change says nothing about the feature.
- **The wpłaty sets are already identical on live data** (ruling 12) — verified on prod:
  `COMPANY_FUNDING` never carries an investment, and all four investment-bearing `OTHER_DEPOSIT` rows
  are cancelled. The two surfaces' income figures need no reconciliation work.

## What We're NOT Doing

- Not touching existing `LABOR_COST` / `RABAT` rows — no backfill, no retype, no unlink (ruling 2).
- Not removing either type from `TRANSFER_TYPES`, the spec table, labels, sheet type lists, or
  `TRANSFERS_SUMMARY_TYPES` (positions frozen — slots 2 and 3 stay).
- Not switching **v1** — it keeps reading transactions and is legacy (ruling 6). Consequence: v1 and
  the listing legitimately disagree from this change onward.
- Not materializing kosztorys figures into columns (ruling 9).
- Not hardening the Payload admin panel or the `z.enum(TRANSFER_TYPES)` server schemas against the
  two types — accepted, per EX-557's precedent (ruling 11).
- Not changing the wpłaty filter or the `'income'` bucket (ruling 12).
- Not fixing the ten uncategorised corrections or the mis-typed rabat rows — owner-side data work,
  recorded in `change.md`.

## Implementation Approach

One aggregate SQL read returns the client-view pair for **all** investments as one row each — the
formula collapses to `SUM` plus a three-branch `CASE`, so Postgres does the folding and the app never
sees a kosztorys row. The TS formula stays the reference implementation, pinned against the SQL by a
DB-backed parity spec. The has-rows rule moves out of the panel into `summary-reading.ts` so
listing and panel share one rule rather than two copies. `shapeInvestments` takes the kosztorys
totals as a second argument and applies the switch per row — the seam sits there, not in
`deriveFinancials`, so the panel's reconciliation keeps a genuine transactions-plane "actual" side.

## Critical Implementation Details

**`shapeInvestments` must stay `server-only`-free.** Its header (`:14-17`) records why: the parity
audit calls the real row builder from a plain node script, and importing it through the query module
drags in `server-only`. The new argument must therefore be plain data passed in, never a fetch called
inside.

**The VAT base of `balanceGross` moves — deliberately.** `shape-investments.ts:51-54` currently
argues that a bilans built from transfers must be grossed by transfers-plane robocizna. Once the
bilans itself is built from kosztorys figures, that argument inverts: netto and brutto must be grossed
by the same pair the netto was built from, or the two columns describe different things. So the switch
applies to `grossBalance`'s arguments too, and the comment is rewritten to state the new reason. This
is a behaviour change and gets a red-first test.

**Cache key must be bumped, not just re-tagged.** Adding kosztorys tags to `fetchInvestmentFinancials`
does not invalidate entries already written under `investment-financials-v2`; if the cached payload's
shape widens, a stale entry is served into code that dereferences the new field (`lessons.md:992`).
`-v3` is part of the same edit as any shape change.

**Phase 5 sequences after EX-557.** Same file, disjoint lines, trivial merge — but EX-557 establishes
the "remove the type from `INVESTMENT_TYPES`" pattern, which EX-555 must **not** copy: dropping
`LABOR_COST` / `RABAT` from `INVESTMENT_TYPES` makes `validate.ts:75-77` null the `investment` column
on 89 legacy rows at their first edit.

---

## Phase 1: Kosztorys totals aggregated in SQL

### Overview

One aggregate query returning **one row per investment** — not one row per kosztorys item — plus the
cache tags that make its result invalidate when the kosztorys changes.

**Why this replaces the batched-read design (option D).** D shipped every kosztorys row to the app on
every cache miss to produce two scalars per investment. Measured on a synthetic dataset (1 000
investments × 300 items × 3 stages, local Postgres over loopback, `pg` client, 3 runs each):

| Investments | Rows shipped by D | D (fetch + TS formula) | SQL aggregate |
| ----------- | ----------------- | ---------------------- | ------------- |
| 12 (today)  | 14 400            | 34 ms                  | 33 ms         |
| 200         | 240 000           | 228 ms                 | 238 ms        |
| 1 000       | 1 200 000         | 915 ms                 | 536 ms        |

Wall-clock is the smaller half of the story, because loopback makes transfer free. The payload does
not: **10 MB at 200 investments, 49 MB at 1 000** (`pg_column_size`, items + stage progress), crossing
a TLS connection to Neon on every miss, deserialised into ~200 MB of heap in a serverless function, to
compute 2 000 numbers. The aggregate returns ~1 000 rows of four numeric columns instead. D is not a
design that scales — it is one that does not hurt yet at twelve investments.

#### 1. The aggregate read

**File**: `src/lib/db/kosztorys-client-totals.ts` (new)

**Intent**: Return the client-view pair per investment, computed in Postgres.

**Contract**: `selectKosztorysClientTotals(db)` → one row per investment **that has items**, carrying
`suma_prac_net`, `done_net`, `item_rabat_net`, `global_rabat_net`. Absence, not a zero row, is what
the fallback rule keys on.

The shape the formula collapses to (verified end to end in `calc.ts:45-124`, `settlement-view.ts:27`,
`settlement-rows.ts:14-23`, `settlement-client-totals.ts`):

```
qty      = Σ stage_progress.qty_done          -- stagesForView('client') filters nothing
gross    = qty × client_price
net      = globalDiscountActive ? gross : applyDiscount(gross)   -- 3-branch CASE
sumaPracNet    = Σ gross
doneNet        = Σ net
rabatClientNet = Σ (gross − net) + globalRabatNet
```

`globalDiscountActive` and `globalRabatNet` are **per investment**, not per item
(`v2-rows.ts:29`) — one `investments.global_discount_type/value` join, no correlated work. There are
**no roundings** anywhere on the path to these two figures; every rounding in
`sectionSubtotalsForView` lives in fields (`share`, `completionRatio`, `plannedNet`) these figures do
not read. This is what research measured option B against and got wrong: it judged B as "reimplement
`sectionSubtotalsForView` in SQL", when what is actually needed is `SUM` plus one three-branch `CASE`.

#### 2. The second-copy guard

**File**: `src/__tests__/lib/db/kosztorys-client-totals.test.ts` (new)

**Intent**: The one real cost of B is that the formula now exists twice — SQL and TS. `lessons.md`'s
"two planes, both green" is exactly this failure mode, so the copies are pinned against each other
rather than trusted.

**Contract**: a DB-backed spec (integration gate, 5435) that seeds a kosztorys covering every branch —
`percent`, `amount` and no per-item discount; global discount on and off; an item with zero stage
progress; an item with progress on several stages — and asserts the aggregate's four columns equal
`clientTotalsFromSubtotals(sectionSubtotalsForView(...))` on the same tree, to the cent. TS stays the
reference implementation; SQL is the copy that must agree with it.

#### 3. The cached query and its tags

**File**: `src/lib/queries/balances.ts`

**Intent**: Expose the derivation as a cached query alongside `fetchInvestmentFinancials`, and close
the invalidation gap on the existing one. Kosztorys writes already bump the four kosztorys tags; the
reader simply never subscribed.

**Contract**: new `fetchKosztorysClientTotals` returning `Record<string, KosztorysClientTotalsT>`
keyed like `InvestmentFinancialsMapT` so `shapeInvestments` looks both up the same way, under
`unstable_cache` tagged
`[kosztorysItems, kosztorysSections, kosztorysStages, stageProgress]` — mirroring
`preview-kosztorys.ts:22-32`, which already subscribes to exactly this set. `fetchInvestmentFinancials`
keeps its own tags; it stays a pure transactions read. Comment must record the cost the owner accepts:
every debounced autosave in the editor expires the whole listing aggregate.

#### 4. Tag/revalidation agreement guard

**File**: `src/__tests__/lib/queries/balances-cache-tags.test.ts` (new)

**Intent**: Nothing today asserts that the listing's tag set covers the actions that change its
inputs. The revalidation lists in `actions/kosztorys.ts` are a hand-maintained inventory of "what
changes derived kosztorys state"; this pins the reader against them.

**Contract**: assert the four kosztorys tags are present on the new query. Hand-author the expected
list — deriving it from the source destroys the guard.

### Success Criteria:

#### Automated Verification:

- New cache-tag guard passes: `pnpm exec vitest run src/__tests__/lib/queries/balances-cache-tags.test.ts`
- SQL↔TS parity spec passes in the integration gate: `pnpm test:integration`

#### Manual Verification:

- Seed the perf dataset (`INV=7 node --env-file=.env --import tsx src/scripts/perf-seed-kosztorys.ts`),
  load `/inwestycje` cold, read the `[PERF]` line — the query must stay flat in the number of
  investments, not in the number of kosztorys rows. The synthetic benchmark above is the baseline it is
  checked against.

---

## Phase 2: One switch rule, shared

### Overview

Move the has-rows decision out of the panel so the listing cannot become a second copy of it.

### Changes Required:

#### 1. Extract the rule

**File**: `src/lib/kosztorys/summary-reading.ts`

**Intent**: The rule "kosztorys rows exist → read the kosztorys; none → read transactions" currently
lives inline at `investment-summary-panel.tsx:60-66`. Give it a name next to the two readings it
chooses between.

**Contract**: a function taking the nullable client totals plus the financials and returning
`SummaryReadingT` — `null` totals selecting `readingFromTransactions`. The panel keeps computing its
own totals from the tree it already fetched; only the choice moves. Comment states why absence, not a
zero total, is the trigger: an investment whose kosztorys sums to zero is still on the kosztorys
plane.

#### 2. Panel uses it

**File**: `src/components/investments/investment-summary-panel.tsx`

**Intent**: Replace the inline ternary with the extracted rule. No behaviour change — this is the
refactor that makes Phase 3 not a duplication.

**Contract**: `:91-96` (the reconciliation feed) stays bound to `financials`, untouched. That binding
is what keeps the comparator honest and it must not be swept into the refactor.

### Success Criteria:

#### Automated Verification:

- Reading specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/summary-reading.test.ts`

#### Manual Verification:

- An investment with a kosztorys and one without both render their Podsumowanie exactly as before.

---

## Phase 3: Listing read-switch

### Overview

Apply the pair at the listing's row builder. This is the phase that changes numbers on screen.

### Changes Required:

#### 1. The seam

**File**: `src/lib/queries/shape-investments.ts`

**Intent**: Take the kosztorys totals map as a second argument, resolve the reading per investment via
Phase 2's rule, and feed the resulting pair to `calculateBalance`, `calculateMargin`, `totalCosts` and
`grossBalance` in place of `financials.totalLaborCosts` / `totalRabat`.

**Contract**: the new argument is plain data — no fetch, no `server-only` import (`:14-17`). Because
`calculateBalance` and `calculateMargin` both read the two fields off `InvestmentFinancialsT`, the
switch is applied by constructing the financials object with the pair replaced, so both formulas stay
single-sourced rather than growing parameters.

#### 2. `balanceGross` VAT base

**File**: `src/lib/queries/shape-investments.ts`

**Intent**: `grossBalance` receives the switched pair too, and the comment at `:51-54` — which
explicitly justifies the transfers plane — is rewritten to state the new reason: the VAT base must be
the same pair the netto bilans was built from.

**Contract**: comment must not merely be deleted. It carries a real argument about disconnected
planes; the replacement states why that argument no longer applies at this call site.

#### 3. Wire the fetch

**File**: `src/lib/queries/investments.ts`

**Intent**: Fetch the two maps in one `Promise.all` and pass both to `shapeInvestments`.

**Contract**: parallel, not serial — the two reads are independent and the listing's latency is the
max, not the sum.

#### 4. Red-first specs for the switched branch

**File**: `src/__tests__/lib/queries/shape-investments.test.ts`

**Intent**: The existing file has no case with a kosztorys at all (`:47-51`), and `:169-196` pins
`balanceGross` on the old VAT base. Add cases that fail before the seam lands: an investment with
kosztorys totals differing from its transaction figures must produce bilans, bilans brutto, koszty and
marża from the kosztorys pair; an investment with no totals must produce byte-identical output to
today.

**Contract**: assert both branches in the same file. The fallback case is the regression guard for the
84-of-96 investments that have no kosztorys and must not move.

#### 5. Parity audit header

**File**: `src/scripts/audit-investment-parity.ts`

**Intent**: Its header (`:3-14`) claims seven figures computed by two independent paths that must
always agree. Under seam B that becomes false — the paths are _supposed_ to differ for
kosztorys-bearing investments.

**Contract**: restate the invariant as conditional on the reading, and make the script skip or
separately report investments on the kosztorys plane rather than flagging them as drift.

### Success Criteria:

#### Automated Verification:

- Listing specs pass: `pnpm exec vitest run src/__tests__/lib/queries/shape-investments.test.ts`
- Balance/margin specs unaffected: `pnpm exec vitest run src/__tests__/lib/db/calculate-balance.test.ts src/__tests__/lib/db/calculate-margin.test.ts`

#### Manual Verification:

- On `pnpm seed:kosztorys-recon`'s two investments, `/inwestycje` bilans netto equals the negation of
  v2's „Do zapłaty", and marża matches v2's Marża tab.
- An investment with no kosztorys shows exactly the figures it showed before the change.

---

## Phase 4: v2 Marża tab

### Overview

Close the gap inside v2 itself — the panel already computes the pair and does not pass it down.

### Changes Required:

#### 1. Feed the tab the reading

**File**: `src/components/kosztorys/summary/tabs/summary-margin-tab.tsx`

**Intent**: `:31` reads `financials.totalLaborCosts` / `financials.totalRabat` directly. It takes the
`SummaryReadingT` pair instead, so the tab speaks the same plane as the block above it.

**Contract**: `financials` stays the source for materiały, wypłaty and strata — those are cash
movements the kosztorys knows nothing about (`summary-reading.ts:4-12`) and must not be switched.

#### 2. Pass it through

**File**: `src/components/kosztorys/summary/summary-panel-content.tsx`

**Intent**: The panel already spreads `{...reading}` into this component; route the pair on to the tab.

**Contract**: the `canSeeMargin` gate (`investment-summary-panel.tsx:87`) stays exactly as-is — the
margin figures must remain off a MANAGER's RSC payload, not merely off their screen.

### Success Criteria:

#### Automated Verification:

- Margin tab specs pass: `pnpm exec vitest run src/__tests__/components/kosztorys/summary/tabs/summary-margin-tab.test.ts`

#### Manual Verification:

- On a kosztorys-bearing investment, v2's Marża equals the listing's Marża column for that row.
- As MANAGER, the Marża tab is still unreachable and its figures are absent from the page payload.

---

## Phase 5: Write-switch

### Overview

Remove both types from the transfer form and close the one gate that reaches a normal user.

**Sequenced after EX-557** — same file, disjoint lines.

### Changes Required:

#### 1. The two lines

**File**: `src/lib/constants/transfers.ts`

**Intent**: Drop `'LABOR_COST'` (`:277`) and `'RABAT'` (`:278`) from `TRANSACTION_TRANSFER_TYPES`.
Comment records that both remain fully supported for existing rows and why (the figures now come from
the kosztorys).

**Contract**: nothing else in this file moves. Specifically not `TRANSFER_TYPES`,
`TRANSFER_TYPE_SPECS`, `TRANSFER_TYPE_LABELS` (a SUMIF criterion in the sheet, `sheet-configs.ts:85`),
`SHEET_TRANSFER_TAB_TYPES`, `TRANSFERS_SUMMARY_TYPES` (frozen slots 2 and 3), `INVESTMENT_TYPES`,
`REQUIRES_INVESTMENT_TYPES`, or `isLaborCost`.

#### 2. The sessionStorage draft

**File**: `src/components/forms/expense-form/expense-form.tsx`

**Intent**: A user with an open session holding a draft of `type: 'LABOR_COST'` gets that value
restored (`:124-126`): the Select renders empty and the form submits the removed type anyway, which the
server accepts. This is the only one of the three gates that hits an ordinary user, so it is the only
one hardened (ruling 11).

**Contract**: coerce an unrecognised restored type to `'INVESTMENT_EXPENSE'`. Coercion over a store
name bump, because a bump discards the user's whole in-progress draft to fix one field.

#### 3. Pinned membership tests

**Files**: `src/__tests__/transfer-constants.test.ts`, `src/__tests__/transfer-rabat.test.ts`

**Intent**: `transfer-constants.test.ts:245-256` pins the exact array and fails hard;
`transfer-rabat.test.ts:27` asserts `toContain('RABAT')`.

**Contract**: exact-array expectation loses both entries; the `toContain` becomes `.not.toContain`
with a comment naming the write-switch as the reason. Keep both lists hand-authored.

#### 4. Draft-restore guard

**File**: `src/__tests__/components/forms/expense-form/draft-type-coercion.test.ts` (new)

**Intent**: Regression guard for the gate we chose to close — restoring a draft carrying a
form-removed type must not yield that type.

**Contract**: assert the coerced value, not that the form renders. A green render cannot distinguish
"coerced" from "silently kept".

### Success Criteria:

#### Automated Verification:

- Constants specs pass: `pnpm exec vitest run src/__tests__/transfer-constants.test.ts src/__tests__/transfer-rabat.test.ts`
- Draft guard passes: `pnpm exec vitest run src/__tests__/components/forms/expense-form/draft-type-coercion.test.ts`

#### Manual Verification:

- The transfer dialog offers neither „Robocizna" nor „Rabat".
- An existing `LABOR_COST` row still renders in the transfers table, is filterable by type, opens in
  the edit dialog with its amount editable, and can be cancelled by a MANAGER.
- With a `LABOR_COST` draft in sessionStorage from before the deploy, reopening the dialog shows a
  populated Select, not an empty one.

---

## Phase 6: Reconciliation silencing

### Overview

Keep the alert useful for old investments without letting it scream forever on new ones.

### Changes Required:

#### 1. The silencing rule

**File**: `src/lib/kosztorys/reconciliation.ts`

**Intent**: With no new `LABOR_COST` bookable, an investment with a non-zero kosztorys and zero
bookings mismatches permanently — a false alarm on every new investment. Silence the comparison when
the transactions plane holds **nothing at all**: Σ `LABOR_COST` = 0 **and** Σ `RABAT` = 0.

**Contract**: the guard is **per investment, not per figure** (ruling 10). Per-figure silencing would
mute "robocizna booked, rabat missing" — exactly the gap `showRabat`
(`settlement-summary.tsx:81-83`) deliberately catches by forcing the Rabat row to render. Both
verdicts are suppressed together or neither is.

#### 2. Guards for both directions

**File**: `src/__tests__/lib/kosztorys/reconciliation.test.ts`

**Intent**: The five "reconciles silently" cases (`:90,97,113,135,142`) must be re-examined — under
seam B they still compare two real planes, but the new guard adds a branch none of them cover.

**Contract**: add a case per direction — both sums zero and a non-zero kosztorys → silent; one sum
non-zero and the other zero → **still screams**. The second is the one that protects the gap.

### Success Criteria:

#### Automated Verification:

- Reconciliation specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/reconciliation.test.ts`

#### Manual Verification:

- On `seed:kosztorys-recon`'s mismatching investment the alert still fires on both figures.
- A freshly created investment with a kosztorys and no transfers shows no alert.

---

## Phase 7: Close the blind spots

### Overview

The suite would go green through all six phases while testing nothing on the new axis. This phase
fixes that, and is not optional.

### Changes Required:

#### 1. Rename what the bucketing spec actually guards

**File**: `src/__tests__/derive-financials-bucketing.test.ts`

**Intent**: `:63-74` and the matrix at `:106-123` pin buckets the listing no longer reads on the
kosztorys branch. Left as-is they read as coverage of the listing and are coverage of the fallback.

**Contract**: rename to name the fallback rule explicitly. Renaming only — the assertions stay
correct for what they now guard.

#### 2. Kosztorys fingerprint in the golden master

**File**: `src/__tests__/financial-golden-master-db.test.ts`

**Intent**: `:100-137` hashes transaction columns only and `DATASET_FLOOR` (`:200`) counts
investments/registers/transactions. After this change a kosztorys edit registers as code drift and a
stale read registers as nothing.

**Contract**: extend the fingerprint with item count, Σ `qty_done` and the global discount per
investment, and add a kosztorys floor to `DATASET_FLOOR`. The floor is what turns "0 kosztorys rows"
from a silent pass into a failure.

#### 3. The missing staleness E2E

**File**: `e2e/investments-listing-kosztorys.spec.ts` (new)

**Intent**: Nothing asserts that the listing's figures are invalidated by a kosztorys write — the
exact defect Phase 1's tags fix.

**Contract**: on `pnpm seed:kosztorys-recon`, read marża on `/inwestycje`, change a `qtyDone` in the
editor, return **without** clicking „Odśwież dane", assert the delta. Do **not** copy
`global-setup.ts:37-48`'s refresh workaround — a test that refreshes manufactures its own green.

#### 4. Living docs

**Files**: `AGENTS.md`, `context/foundation/investment-financials-and-discount.md`

**Intent**: AGENTS.md's Transfer Business Logic section describes `LABOR_COST` and `RABAT` as things
you book; the financials doc describes marża as transaction-sourced. Both become partly false.

**Contract**: state the new sourcing and that v1 remains on the old one deliberately. Also correct
AGENTS.md's claim that register balances are recalculated by hooks — `recalcAfterChange`
(`hooks/transfers/recalculate-balances.ts:9-11`) writes nothing (research §4).

### Success Criteria:

#### Automated Verification:

- Bucketing spec passes: `pnpm exec vitest run src/__tests__/derive-financials-bucketing.test.ts`
- Golden master passes with the extended fingerprint: `pnpm test:parity`
- New E2E passes: `pnpm test:e2e e2e/investments-listing-kosztorys.spec.ts`

#### Manual Verification:

- With the kosztorys tables empty, `pnpm test:parity` **fails** on the new floor rather than passing
  green.

---

## Testing Strategy

### Unit Tests

- Phase 3's two-branch spec is the primary asset: it pins both the switched figures and the unchanged
  fallback, and the fallback half protects the 84 investments that have no kosztorys.
- Phase 6's "one sum zero, one non-zero → still screams" case is the guard on the silencing rule's
  single real hazard.
- Every membership list touched in Phase 5 stays hand-authored.

### Integration Tests

- `pnpm test:integration` (5435 `db-test`) covers the DB-backed specs. Run `pnpm db:import:test`
  first — the test DB shares the dump's blind spot.
- `pnpm test:parity` is the over-reach detector, but only after Phase 7 gives it a kosztorys
  fingerprint. Before that it is green by blindness.

### Manual Testing Steps

1. `pnpm db:import` (the local DB is behind the dump), then `pnpm seed:kosztorys-recon`.
2. Compare `/inwestycje` against each seeded investment's v2 Podsumowanie: bilans netto = −„Do
   zapłaty", marża equal.
3. Compare against v1 — expect disagreement, and confirm it is the kosztorys/transactions difference.
4. Open an investment with no kosztorys; confirm every figure is unchanged from before.
5. Confirm the transfer dialog offers neither type, and that a legacy row still edits and cancels.

## Performance Considerations

One extra round trip on the listing, returning one row per investment. `kosztorys-tree.ts:16-25`
records that round-trip count is the Neon cost driver — true, and it is why a per-investment loop
(~109 reads) is excluded; it is **not** a licence to ship an unbounded payload in one trip. The
listing's cost now grows with the number of investments (~1 000 rows, four numeric columns at the
1 000-investment horizon), not with the size of their kosztoryses (49 MB at the same horizon under the
rejected option D — measured, see Phase 1).

## Migration Notes

No schema change, no migration, no prod migration step. Cache key bumped to `-v3` if the cached
payload's shape changes.

## Whole-tree Gate

Run once, after Phase 7.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`
- DB-backed suite passes: `pnpm test:integration`
- Golden master passes with the kosztorys fingerprint: `pnpm test:parity`

## References

- Research: `context/changes/2026-08-12-ex-555-write-switch-labor-rabat/research.md`
- Owner rulings 1–12: `context/changes/2026-08-12-ex-555-write-switch-labor-rabat/change.md`
- Sequenced after: `context/changes/2026-08-12-ex-557-legacy-deposit-types/plan.md`
- Linear: EX-555
- Anti-precedent: `src/migrations/20260222_drop_materialized_columns.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Kosztorys totals aggregated in SQL

#### Automated

- [x] 1.0 SQL↔TS parity spec passes: `pnpm test:integration` — d9da2daa
- [x] 1.1 Cache-tag guard passes: `pnpm exec vitest run src/__tests__/lib/queries/balances-cache-tags.test.ts` — d9da2daa

### Phase 2: One switch rule, shared

#### Automated

- [x] 2.1 Reading specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/summary-reading.test.ts` — 47347c6c

### Phase 3: Listing read-switch

#### Automated

- [x] 3.1 Listing specs pass: `pnpm exec vitest run src/__tests__/lib/queries/shape-investments.test.ts`
- [x] 3.2 Balance/margin specs pass: `pnpm exec vitest run src/__tests__/calculate-balance.test.ts src/__tests__/calculate-margin.test.ts` (plan named a `lib/db/` path these specs never had)

### Phase 4: v2 Marża tab

#### Automated

- [ ] 4.1 Margin tab specs pass: `pnpm exec vitest run src/__tests__/components/kosztorys/summary/tabs/summary-margin-tab.test.ts` — NOT authored: the repo has no React render harness (no `@testing-library/react`, no jsdom env), so this box is browser-level and owed to the E2E backlog at the review gate. The plane swap the tab now depends on is covered at unit level by `financialsOnReading` in `src/__tests__/lib/kosztorys/summary-reading.test.ts`.

### Phase 5: Write-switch

#### Automated

- [x] 5.1 Constants specs pass: `pnpm exec vitest run src/__tests__/transfer-constants.test.ts src/__tests__/transfer-rabat.test.ts`
- [x] 5.2 Draft guard passes: `pnpm exec vitest run src/__tests__/components/forms/expense-form/draft-type-coercion.test.ts`

### Phase 6: Reconciliation silencing

#### Automated

- [x] 6.1 Reconciliation specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/reconciliation.test.ts` (20 tests)

### Phase 7: Close the blind spots

#### Automated

- [x] 7.1 Bucketing spec passes: `pnpm exec vitest run src/__tests__/derive-financials-bucketing.test.ts` (290 tests)
- [x] 7.2 Golden master passes with the extended fingerprint: `pnpm test:parity` — the floor needed `db-test` to actually carry kosztorys rows (prod dumps carry none), so `pnpm seed:kosztorys:test` was added and the fixture regenerated; it was already ~101/105 entities stale before this change
- [x] 7.3 New E2E passes: `pnpm test:e2e e2e/investments-listing-kosztorys.spec.ts`
