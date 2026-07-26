# Persisted materials net pricing — Implementation Plan

> **GATE LIFTED 2026-07-26 — all four phases are cleared to build.** Earlier revisions of this
> banner blocked Phases 2 and 3 on whether materials are re-invoiced to the client with VAT. The
> owner answered: **the client pays exactly the amount entered in the form** — no VAT on top at
> rozliczenie netto or mieszany — so the reduction is a genuine concession, not a bookkeeping
> fiction. And the reduction is an **independent commercial decision**: two investments settled
> identically can be priced differently, so it stays its own field rather than being derived from
> the settlement mode. The owner also confirmed the brutto exclusion in his own words: at
> rozliczenie brutto VAT _is_ added on top, and then there is nothing to strip.

> A fifth phase — costing the settled bucket netto instead of brutto — was drafted here and
> **parked as EX-595** (owner, 2026-07-26): the defect is real and the rule is unconditional
> (settled material is always netto, it is not a mode), but the rate source is unresolved and the
> fix is a change of its own.

## Overview

Turn the panel's client-only "price materiały netto" experiment into a persisted per-investment
setting, and make the money it gives away visible in the two figures that must absorb it: the
investor balance rises, the margin falls. The discount is a VAT strip computed by division, gated on
the investment's settlement mode, and defaulting to off so no existing investment's figures move.

## Current State Analysis

The reduction exists today only in the browser, in two halves that already disagree with each other:

- the on/off flag persists in `localStorage` via `usePersistedEnum` — `src/components/kosztorys/summary/hooks/use-materials-net-pricing.ts`
- the percent is a plain `useState` seeded from the investment's VAT rate — `src/components/kosztorys/summary/summary-panel-content.tsx:184`

So the flag survives a reload and the percent does not. Both feed `computeDoZaplatyRM`, whose
`materialyPair` takes the `reduction != null` branch (`src/lib/kosztorys/summary-economics.ts:40`)
and prices the brutto bucket at `grossBase × (1 − reduction)`.

Server-side, nothing knows about any of this:

- `calculateMargin` = `totalLaborCosts − totalPayouts − totalRabat − totalLoss − totalSettled`
  (`src/lib/db/calculate-margin.ts:13`) — no materiały term at all
- `calculateBalance` = `totalIncome − (totalMaterialCosts + totalLaborCosts) + totalRabat`
  (`src/lib/db/calculate-balance.ts:6`) — materiały at full face value

That gap is the diagnosed defect: on investment 31, v1's bilans and v2's „Do zapłaty" differed by
14 452,85, the entire difference being materiały priced with the reduction on one side and without it
on the other.

Two independent errors are folded into the current behaviour, and both are fixed here:

1. **The reduction is not a VAT strip.** `brutto × (1 − 0,23)` on 123 zł gives 94,71, but netto is 100. Stripping VAT is division by `1 + rate`, not subtraction of `rate`. At ~180 000 zł of
   materiały that is ~7 700 zł wrongly taken out of the margin.
2. **Nobody absorbs the difference.** The client is billed less and no figure records the company
   eating it.

## Desired End State

An investment carries an optional materials net rate. When set, and when the investment settles
netto or mieszany:

- the difference `materialsGrossBase − materialsGrossBase / (1 + rate)` is computed once, server-side
- `Bilans inwestora` rises by it — the client owes less
- `Marża` falls by it — the company absorbs it
- it renders as its own labelled row wherever it moves a figure: the panel's Podsumowanie and the
  investment card's owner figures

When the rate is unset (every existing investment) or the investment settles brutto, the difference is
zero and every figure reads exactly as it does today.

Verify by: setting a rate on one investment, confirming the same discount amount appears in the panel
row, in the reduction of Marża on the investment card, and in the rise of Bilans inwestora; then
switching that investment to rozliczenie brutto and confirming all three return to their unset values.

### Key Discoveries:

- `materialsGrossBase` already exists on `InvestmentFinancialsT`, already excludes settled rows, and
  is already the exact base the discount must multiply — `src/lib/db/investment-financials.ts:72`. The
  netto-billed bucket (`materialsNetBilled`, line 75) is the one that must stay frozen: it is already
  netto and stripping it again double-deducts VAT.
- `calculateMargin` / `calculateBalance` both take the whole `InvestmentFinancialsT` rather than loose
  numbers. Adding the discount as a **field on that object** means neither signature changes and no
  call site has to be found and re-threaded.
- `deriveFinancials(rows, categoryCosts = [], settledCategoryCosts = [])` already has optional
  trailing params (`src/lib/db/investment-financials.ts:65`). Two more optional params default the
  discount to 0, so `/raporty` and the client-share path keep today's behaviour with no edit.
- `sumAllInvestmentFinancials` (`src/lib/db/sum-transfers.ts:218`) builds the per-investment map and
  already holds the investment id per row — the natural join point for the per-investment rate.
- `settlementMode` is the template for the whole write path: column
  (`src/migrations/20260726_3_add_settlement_mode_to_investments.ts`), Payload field
  (`src/collections/investments.ts:113`), zod-validated action
  (`src/lib/actions/kosztorys.ts:152`), `router.refresh()` host
  (`src/components/investments/investment-summary-panel-client.tsx:25`).
- `audit-investment-parity.ts:47` compares `bilans` and `marża` from both paths against a committed
  golden master — it moves the moment either formula changes.

## What We're NOT Doing

- **`/raporty` does not learn to compute the discount.** It aggregates a filtered transfer set across
  all investments into one blended `InvestmentFinancialsT` with no per-investment split; applying a
  per-investment rate there needs a new per-investment materiały aggregate under the same filter.
  Deferred to its own Linear issue. This plan only makes the resulting inaccuracy impossible to miss.
- **No column on the investments list.** The list's Marża becomes correct, but the discount gets no
  column of its own — it would be empty on every row until a rate is set.
- **No backfill.** Unset means off, permanently, for every investment that exists today.
- **No "preview a rate without saving" affordance.** The browser-local override is deleted, not
  reworked; it is the mechanism that caused the diagnosed disagreement.
- **The rate is not derived from the investment's VAT rate.** Materiały can sit on a different rate
  than robocizna, and the field also carries the on/off state.

## Implementation Approach

Compute the discount once, at the same place every other financial aggregate is derived, and carry it
on `InvestmentFinancialsT` as a plain number. The two formulas then each gain one term, and every
existing reader of those formulas is correct with no change. Surfaces that cannot supply the rate
(reports, the client share) pass nothing and get 0 — the same value an unset investment produces, so
"can't compute it" and "there is nothing to compute" collapse into one safe default.

The gating on settlement mode lives with the computation, not with the readers, so no surface can
forget it.

## Critical Implementation Details

**Ordering.** Phase 3 changes the panel's arithmetic from subtraction to division. That moves numbers
on screen for anyone who currently has the localStorage flag on, independently of whether a rate has
been saved. It is not a pure refactor of where state lives, and it must not be described as one in
the commit.

**The mixed mode is not partial.** Materiały sit entirely inside the netto section of tryb mieszany,
so the discount applies to the whole materiały base there — not to a fraction of it.

**„Subtraction is a bug" is a reinterpretation, not a reading of intent.** The source comment at
`src/lib/kosztorys/summary-economics.ts:29-31` records `gross × (1 − reduction)` as a deliberate
owner experiment — "the reduction % is a panel control, default = VAT rate… to test whether a
straight brutto reduction is the right model". Two different intents produce two different
arithmetics, and only one of them is a bug:

- intent „materiały po cenie netto" → division by `1 + rate` is right, subtraction is a bug
- intent „zbij klientowi materiały o x%" → subtraction is right and the rate is just a knob, which
  happens to default to the VAT rate

The plan assumes the first. Confirm it with the owner before Phase 3 lands — the field name
(`materialsNetRate`) commits to that reading, and renaming it later is more expensive than asking.

---

## Phase 1: Persist the rate

### Overview

Add the per-investment rate as a real column with a write path, and make it readable by both the
investment detail page and the investments list.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/20260726_4_add_materials_net_rate_to_investments.ts`

**Intent**: Add the nullable rate column. Nullable is load-bearing — it is how "never set" is
distinguished from "deliberately 0%", which is what keeps every existing investment's figures still.

**Contract**: `investments.materials_net_rate` — numeric, NULL allowed, no default, no backfill.
Hand-written per `AGENTS.md` › Migrations; copy the structure of
`20260726_3_add_settlement_mode_to_investments.ts` minus the enum block.

#### 2. Payload field

**File**: `src/collections/investments.ts`

**Intent**: Expose the rate so it round-trips through the ORM and is editable in the admin panel as a
fallback.

**Contract**: `materialsNetRate`, `type: 'number'`, **not** `required` and **no** `defaultValue` —
either would destroy the null-means-off semantics. Stored as a fraction (0,23 = 23%), matching the
`vatRate` field two entries above it.

#### 3. Write action

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: One action to set or clear the rate, following `updateInvestmentSettlementModeAction`
line for line.

**Contract**: `updateInvestmentMaterialsNetRateAction(investmentId, materialsNetRate: number | null)`,
zod schema `z.object({ materialsNetRate: z.coerce.number().min(0).max(1).nullable() })`. The bounds
matter for the same reason `investmentVatSchema` has them — a bad rate feeds two financial figures.
Revalidates `['investments']` only: like the settlement mode, the rate is not denormalised onto items.

#### 4. Reference data carries the rate and the mode

**Files**: `src/types/reference-data.ts`, `src/lib/queries/reference-data.ts`

**Intent**: The investments list computes Marża per row (`src/lib/queries/investments.ts:53`) and
therefore needs both the rate and the settlement mode per investment. Neither is on `InvestmentRefT`
today.

**Contract**: `InvestmentRefT` gains `materialsNetRate: number | null` and
`settlementMode: SettlementModeT`; the reference-data query selects both.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`
- Migration applies against the local docker DB

#### Manual Verification:

- Setting the rate from the Payload admin panel persists across a reload
- An investment with no rate set reads null, not 0, after a round-trip

---

## Phase 2: The difference in the two figures

### Overview

Compute the discount where every other aggregate is derived, carry it on the financials object, and
add one term to each of the two formulas.

### Changes Required:

#### 1. Derive the discount

**File**: `src/lib/db/investment-financials.ts`

**Intent**: Compute the discount alongside the existing material buckets, gated on settlement mode, so
no reader can apply it to a brutto-settled investment by accident.

**Contract**: `deriveFinancials` gains two optional trailing params — the rate (`number | null`) and
the settlement mode. It sets a new `materialsNetDiscount` field on its return value:

```
rate == null || mode === 'GROSS'  →  0
otherwise                         →  materialsGrossBase − materialsGrossBase / (1 + rate)
```

Only `materialsGrossBase` — never `totalMaterialCosts` — is the base; `materialsNetBilled` is already
netto. Both new params default such that every existing call site (reports, client share, the two
kosztorys pages) yields 0 without being touched.

#### 2. The type

**File**: `src/types/investment-financials.ts`

**Intent**: `materialsNetDiscount` becomes part of the financials contract so both formulas can read
it without a second argument.

**Contract**: `InvestmentFinancialsT` gains `materialsNetDiscount: number`. Non-optional — a missing
value would silently read as `undefined` inside an arithmetic expression and poison both figures with
`NaN`.

#### 3. The two formulas

**Files**: `src/lib/db/calculate-margin.ts`, `src/lib/db/calculate-balance.ts`

**Intent**: The company absorbs the difference and the client is billed less by it — the same
two-sided shape a `RABAT` has (`AGENTS.md` › Transfer Business Logic).

**Contract**: margin subtracts `materialsNetDiscount`; balance adds it. Signatures unchanged — both
already take the whole financials object. The doc comments above each need the new term explained, in
the same register as the existing rabat/strata lines.

#### 4. Per-investment map

**File**: `src/lib/db/sum-transfers.ts`

**Intent**: The investments list's Marża must be as correct as the detail page's. The map builder
already iterates per investment; it needs the rate and mode for each one.

**Contract**: `sumAllInvestmentFinancials` looks up each investment's rate and settlement mode and
passes them into its `deriveFinancials` call (line 218).

#### 5. Detail page supplies the rate

**File**: `src/app/(frontend)/inwestycje/[id]/page.tsx`

**Intent**: The one page whose figures the diagnosis was run against.

**Contract**: its `deriveFinancials` call (line 63) passes the investment's rate and settlement mode.

#### 6. Parity golden master

**File**: `src/scripts/audit-investment-parity.ts` and its committed fixture

**Intent**: Both compared figures move, so the recorded master is stale by construction.

**Contract**: regenerate the fixture after the formulas land. Regeneration is not verification — the
unit tests below are what proves the formulas right; the master only pins them afterwards.

#### 7. Unit tests

**File**: `src/__tests__/lib/db/investment-financials.test.ts` (mirroring the source path per
`AGENTS.md` › Testing)

**Intent**: The formulas are pure arithmetic, so unit tests give full signal cheaply. The division is
the specific thing worth pinning — subtracting the rate is the bug being fixed and a test must fail
if anyone reintroduces it.

**Contract**: cases — no rate set → discount 0; rate set + netto → `123` yields exactly `23`, not
`28,29`; rate set + mieszany → same; rate set + brutto → 0; margin falls and balance rises by the
same amount.

**The double-strip guard is its own named case, not a clause.** Owner's check, 2026-07-26: an
expense already entered netto (faktura bez VAT) must not have VAT taken off a second time. Feed an
investment **both** buckets — say 123 brutto and 100 netto-billed — and assert the discount is
exactly `23`: computed off `materialsGrossBase` alone, untouched by the netto bucket. Reading
`totalMaterialCosts` instead (the sum of both) is the one edit that reintroduces the double cut,
and it must turn this test red rather than quietly move złotówki.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `pnpm exec vitest run src/__tests__/lib/db/investment-financials.test.ts`
- Parity audit passes against the regenerated fixture: `pnpm test:parity`
- Type checking passes: `pnpm exec tsc --noEmit`

#### Manual Verification:

- An investment with no rate shows exactly the Marża and Bilans it showed before this change
- Setting 23% on a netto investment lowers Marża and raises Bilans by the same amount
- Switching that investment to rozliczenie brutto returns both figures to their unset values
- The investments list's Marża for that investment matches the detail page's

---

## Phase 3: Panel writes to the server, and the difference is visible

### Overview

Delete the browser-local state, point the existing control at the new action, correct the panel's own
arithmetic to division, and surface the discount as a labelled row.

### Changes Required:

#### 1. Delete the localStorage hook

**File**: `src/components/kosztorys/summary/hooks/use-materials-net-pricing.ts` (deleted)

**Intent**: The persisted value is the only truth. Keeping a browser-local override would reinstate
exactly the split that produced the diagnosed disagreement.

**Contract**: file removed; its `table-columns:kosztorys-materials-net` key is abandoned. Gate the
deletion on typecheck, not grep.

#### 2. Panel reads the persisted rate

**File**: `src/components/kosztorys/summary/summary-panel-content.tsx`

**Intent**: Replace the flag-plus-unsaved-percent pair with the single server value.

**Contract**: the `useMaterialsNetPricing` and `useState(vatPercent)` pair (lines 178, 184) is
replaced by a `materialsNetRate: number | null` prop plus a change handler prop, mirroring how
`settlementMode` / `onSettlementModeChange` already work through this component. The prop threads up
through `KosztorysEditorDataT` the same way `settlementMode` does.

#### 3. Division, not subtraction

**File**: `src/lib/kosztorys/summary-economics.ts`

**Intent**: The panel must show the same number the server computed. Today its `reduction != null`
branch multiplies by `(1 − reduction)`.

**Contract**: `materialyPair`'s reduction branch becomes `gross / (1 + rate)` for the netto side.
This is the change that moves on-screen numbers for existing users independently of any saved rate —
see Critical Implementation Details.

#### 4. The control saves

**Files**: `src/components/kosztorys/summary/tabs/summary-expenses-tab.tsx`,
`src/components/investments/investment-summary-panel-client.tsx`

**Intent**: The control stays exactly where it is, under the materiały table — only its destination
changes.

**Contract**: the checkbox clears the rate (writes null) and re-enabling it writes the investment's
VAT rate as the opening value; the number field autosaves debounced, matching the other editor field
saves, then `router.refresh()`. The client host owns the write, as it already does for the settlement
mode.

#### 5. The visible row

**Files**: `src/components/kosztorys/summary/tables/summary-totals-table.tsx` (or the breakdown table,
whichever the discount belongs beside), `src/components/investments/investment-owner-figures.tsx`

**Intent**: A figure that silently lowers Marża is unverifiable — which is the exact problem that
started this change.

**Contract**: label **„Obniżka materiałów"**, deliberately not „Rabat" (that word names a transfer
type in this app) and not „Różnica" (unqualified, it reads as a reconciliation error next to the
Wpłaty/Rabat rows). Rendered negative, consistent with the Wpłaty and Rabat rows settled earlier
today. On the investment card it joins Marża and Strata in the owner figures strip, under the same
role gate. Shown only when non-zero.

#### 6. Brutto notice

**File**: `src/components/kosztorys/summary/tabs/summary-expenses-tab.tsx`

**Intent**: With the rate saved but the investment settling brutto, the discount is inert. Without a
notice the owner sees a saved 23% and a Marża that does not reflect it, with no explanation.

**Contract**: a short line by the control — the discount does not apply to a brutto-settled
investment. The saved rate is deliberately kept, not cleared: returning to netto restores the previous
figures with nothing to re-enter.

#### 7. Client share stays closed

**File**: `src/lib/queries/client-kosztorys.ts`

**Intent**: The rate is an owner-plane setting. The client share must render the discount's effect on
its own „Do zapłaty" but must never offer the control.

**Contract**: the share passes the rate but no change handler; the panel already gates owner-only
affordances on `clientView`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit` (this is the gate for the hook deletion)
- Linting passes: `pnpm lint`

#### Manual Verification:

- The saved rate survives a reload — both the on/off state and the number
- The panel's materiały netto figure matches the server-computed discount exactly (123 → 100)
- The „Obniżka materiałów" row shows the same amount by which Marża fell
- The client share renders the discounted „Do zapłaty" and offers no control
- A brutto-settled investment with a saved rate shows the notice and no discount anywhere

---

## Phase 4: Guard the reports page

### Overview

Reports keep computing without the discount. Make that visible rather than silent, and file the real
fix.

### Changes Required:

#### 1. The warning

**File**: `src/app/(frontend)/raporty/page.tsx`

**Intent**: The page will show a Marża that does not match the sum of the per-investment Marża values.
An unmarked wrong number is worse than an absent one — decisions get made on it.

**Contract**: a prominent warning above the figures stating that the totals do not account for
materiały discounts and therefore disagree with the investments list. Deliberately loud, not a muted
footnote; it stays until the deferred fix lands.

#### 2. The Linear issue

**Intent**: The deferred work has a real shape and must not evaporate.

**Contract**: an issue in project "Wykonczymy" describing the per-investment materiały aggregate under
the reports filter, and naming the removal of the Phase 4 warning as its definition of done. Record
the id here once filed. Reality-check the Linear MCP first; if unreachable, say so rather than claim a
filing.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`

#### Manual Verification:

- The warning is visible on `/raporty` without scrolling
- The Linear issue exists and names the warning's removal as its completion condition

---

## Testing Strategy

### Unit Tests:

The discount derivation and the two formulas — pure arithmetic, full signal at unit level. The
division case (`123 → 23`, never `28,29`) is the one that must fail loudly if anyone reverts to
subtracting the rate. Gating cases: unset rate, brutto mode, mieszany mode. Exclusion case: the
netto-billed bucket must not be discounted.

### Integration Tests:

None added. The write path is a copy of `updateInvestmentSettlementModeAction`, which is already
exercised; the risk this change carries is arithmetic, not persistence.

### Manual Testing Steps:

1. Pick an investment with material spend and no rate set — record Marża and Bilans inwestora
2. Set 23% — confirm both moved by the same amount, and that the amount equals
   `materiały brutto − materiały brutto / 1,23`
3. Confirm the „Obniżka materiałów" row shows that same amount
4. Confirm the investments list shows the same Marża as the detail page
5. Switch to rozliczenie brutto — confirm both figures return to step 1's values and the notice appears
6. Switch back to netto — confirm the rate is still saved and the figures return
7. Reload — confirm both the on/off state and the number survived
8. Open the client share — confirm the discounted „Do zapłaty" and no control
9. Open `/raporty` — confirm the warning is visible

## Migration Notes

One nullable column, no backfill, no data preservation owed. Null is the permanent "off" state, so
every investment that exists today keeps its figures untouched — that is owner decision 1, not an
implementation convenience. Applied to prod by a human via `pnpm db:migrate:prod`, before the code
that reads the column ships.

## References

- Diagnosis and owner decisions: `context/changes/2026-07-26-materials-net-pricing-persisted/change.md`
- Write-path template: `src/lib/actions/kosztorys.ts:152`, `src/collections/investments.ts:113`
- Migration template: `src/migrations/20260726_3_add_settlement_mode_to_investments.ts`
- Two-sided figure precedent (RABAT): `AGENTS.md` › Transfer Business Logic

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Persist the rate

#### Automated

- [x] 1.1 Type checking passes
- [x] 1.2 Linting passes
- [x] 1.3 Migration applies against the local docker DB

### Phase 2: The difference in the two figures

#### Automated

- [ ] 2.1 Unit tests pass
- [ ] 2.2 Parity audit passes against the regenerated fixture
- [ ] 2.3 Type checking passes

### Phase 3: Panel writes to the server, and the difference is visible

#### Automated

- [ ] 3.1 Type checking passes
- [ ] 3.2 Linting passes

### Phase 4: Guard the reports page

#### Automated

- [ ] 4.1 Type checking passes
- [ ] 4.2 Linting passes
