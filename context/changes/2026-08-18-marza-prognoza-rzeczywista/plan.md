# Marża: forecast beside actual, both from the kosztorys — Implementation Plan

## Overview

Add a **second** margin figure everywhere the first one lives, without touching the first. The new
actual margin sources the crew cost from the kosztorys (`subcontractorDueByPlane`) instead of
`Σ PAYOUT`, and drops `materialsNetDiscount`. Beside it, a **forecast** margin prices the przedmiar
at the client price against the przedmiar priced at one subcontractor plane — a scenario, toggled
z narzędziami / bez narzędzi.

Nothing is redefined. `calculateMargin` and every surface that renders it stay exactly as they are;
the new figure is a second function and a second column. That is the owner's explicit requirement —
he wants to see the old and the new reading side by side — and it is also what keeps the existing
specs meaningful instead of silently tautological.

## Current State Analysis

- `calculateMargin` (`src/lib/db/calculate-margin.ts:16`) is six terms over one `InvestmentFinancialsT`.
  Four production call sites: the listing (`shape-investments.ts:64`), the v1 detail block
  (`inwestycje/[id]/page.tsx:100`), `/raporty` (`raporty/page.tsx:71`), and the hidden Marża tab
  (`summary-margin-tab.tsx:47`).
- The Marża tab is hidden by one line — `summary-panel-content.tsx:186`, `TODO(EX-649)`. The tab,
  `financials` plumbing and role gates are all wired and untouched.
- `subcontractorDueByPlane` (`src/lib/kosztorys/subcontractor-due.ts:39`) is the only należne
  primitive. Client-side only, one production call site (`use-kosztorys-editor.ts:335`). It **skips
  `plane === null` etapy** and raises `hasUnconfirmedPlane`, already gated on the etap actually
  holding qty.
- **No aggregate prices the przedmiar at a subcontractor plane.** `sectionSubtotalsForView` returns
  `plannedNet: null` outside `'client'` (`settlement-aggregates.ts:106`) and `columnTotalsForRows`
  does the same. The per-row primitive exists — `rowPlannedNetForView` (`calc.ts:113`) — but it goes
  through `netForQtyForView`, so it **carries the rabat on the client view**. The forecast must be
  pre-rabat (decision 1), so it needs `plannedQty × viewPrice(row, view)`, not that helper.
- `subcontractorPrice(row, plane)` (`calc.ts:63`) reads disjoint per-plane field pairs; an `'amount'`
  override is a frozen flat unit price. Measured on the local DB: 567 items carry a hand-typed amount
  on **both** planes, 1181 on neither, **3** on exactly one. The scenario toggle therefore behaves
  sensibly per row with no special handling.
- `selectKosztorysClientTotals` (`src/lib/db/kosztorys-client-totals.ts:35`) is the listing's
  one-row-per-investment Postgres fold, with a header comment recording why (10 MB of rows at 200
  investments, 49 MB at 1000) and stating that TS is the reference implementation and the SQL is the
  copy, pinned by `src/__tests__/lib/db/kosztorys-client-totals.test.ts`.
- Everything the new fold needs is reachable in SQL: `stage_progress.qty_done`,
  `kosztorys_stages.plane`, the per-item override pairs, and `investments.w_tools_coeff` /
  `own_tools_coeff`.
- `fetchKosztorysClientTotals` (`balances.ts:89`) already tags `kosztorysStages` — a należne fold
  needs a key bump but **no new tag**.
- `financial-golden-master-db.test.ts:139-160` hashes item count, executed qty and the global rabat.
  It does **not** hash `plane`, `worker_id`, or the subcontractor override pairs.
- `investment-render-parity-db.test.ts:147` builds **both** sides on the kosztorys plane
  (`readingFromKosztorys`, `:123`) — v1 never enters it.

## Desired End State

- The investments listing shows **two** owner-only margin columns: `Marża` (unchanged) and
  `Marża v2`. A `Marża v2` cell reads `ustaw etapy` instead of an amount whenever the investment has
  an etap that carries executed work and has no settlement plane.
- The kosztorys summary panel's `Marża` tab is visible to ADMIN/OWNER on both hosts and hidden on the
  client share. Inside it, a toggle picks **Prognoza** or **Marża rzeczywista**; each carries a short
  description of exactly how it is computed. Under Prognoza a second toggle picks the scenario
  (default **z narzędziami**); under Marża rzeczywista that toggle is absent.
- `Marża rzeczywista` in the panel equals `Marża v2` on the listing for the same investment, computed
  through two independent paths (SQL fold vs the editor's tree) and pinned by a spec.
- `calculateMargin`, the v1 detail block, `/raporty`, the `Wypłaty` column and the
  `Obniżka materiałów` tile are byte-for-byte unchanged.

### Key Discoveries

- Adding rather than redefining removes the whole "old specs go tautological" risk named in
  `research.md`. Every existing margin assertion keeps its subject.
- `hasUnconfirmedPlane` already carries the exact semantics decision 4 needs (qty-gated), so the SQL
  side has a TS oracle to match rather than a new rule to invent.
- The forecast's two halves are one function with a view parameter: `Σ plannedQty × viewPrice(row, view)`
  at `'client'` and at the chosen plane.
- `topBarSlot` (`summary-panel-content.tsx:88-89,257`) exists for exactly this kind of toggle, and
  `StatsVersionToggle` is the in-repo precedent for "two readings of one number".

## What We're NOT Doing

- Not touching `calculateMargin`, `calculate-balance.ts`, `deriveFinancials`, or `financialsOnReading`.
- Not changing the v1 detail block, `/raporty`, the `Wypłaty` column, or the `Obniżka materiałów` tile.
- Not putting the forecast on the investments listing (decision 3).
- Not exposing either figure to the client share — the `preview` gate stays.
- Not adding needed-vs-paid reconciliation to the Marża tab; that stays in `Podwykonawcy` (decision 5).
- Not backfilling or migrating anything — no stored figure changes.
- Not writing an E2E spec in this change; browser coverage is deferred to the review gate.

## Implementation Approach

Bottom-up. Phase 1 lands the two pure functions with their specs, so every later phase composes
tested arithmetic. Phase 2 puts them on screen in the editor, where the whole tree is already in
memory. Phase 3 re-expresses the actual margin's new term in SQL and pins it against phase 1's TS.
Phase 4 renders it on the listing. Phase 5 repairs the guards the change would otherwise leave lying
and updates the living docs.

## Critical Implementation Details

**The forecast must not go through `netForQtyForView`.** That helper applies the rabat on the client
view, and decision 1 is that the forecast carries no rabat — neither per-item nor global. Use
`plannedQty × viewPrice(row, view)` directly. Using `rowPlannedNetForView` would silently discount the
client half and not the subcontractor half, inflating the forecast margin by exactly the rabat.

**The golden master must be taught the subcontractor axis in the same phase that the listing starts
reading it** (phase 5 immediately after phase 4), or a pre-push run reports a data edit as code drift.

---

## Phase 1: The two formulas

### Overview

Two pure functions plus their specs. No React, no DB, no rendering.

### Changes Required

#### 1. Forecast pricing primitive

**File**: `src/lib/kosztorys/calc.ts`

**Intent**: Expose the offer figure **pre-rabat** at any view, which no helper does today —
`rowPlannedNetForView` discounts on the client view. The forecast needs both halves priced on the
same, undiscounted basis.

**Contract**: `rowPlannedForView(row: ViewPricingT, view: PriceViewT): number` =
`row.plannedQty * viewPrice(row, view)`. Docblock must state why it exists beside
`rowPlannedNetForView` and that the omission of the rabat is a decision, not an oversight.

#### 2. Forecast margin

**File**: `src/lib/kosztorys/margin-forecast.ts` (new)

**Intent**: The przedmiar priced for the client minus the przedmiar priced for one crew — the whole
forecast, for one scenario.

**Contract**: `marginForecast(rows: KosztorysV2RowT[], plane: ToolPlaneT): { clientNet: number; subcontractorNet: number; margin: number }`.
No stages argument by construction: the przedmiar is the offer, independent of what has been executed
and of any etap's plane. Excludes rabat, strata and settled material (decision 1 + change.md).

#### 3. Actual margin (v2)

**File**: `src/lib/kosztorys/margin-v2.ts` (new)

**Intent**: The new actual margin, as a formula over already-derived inputs so both the editor and
the listing can call it with figures each obtained its own way.

**Contract**:

```
marginV2({ laborCostsNet, discountNet, subcontractorDue, totalSettled, totalLoss })
  = laborCostsNet - discountNet - subcontractorDue - totalSettled - totalLoss
```

`laborCostsNet` is the pre-rabat kosztorys robocizna and `discountNet` the kosztorys rabat — i.e. the
pair `SummaryReadingT` already carries, passed apart so the subtraction is visible. `materialsNetDiscount`
is deliberately absent. A separate exported predicate — or a `withheld: boolean` on the result —
expresses decision 4: **when the investment has an etap with executed work and no plane, there is no
number**. Model it so a caller cannot render an amount by accident; returning the margin and a flag
the caller may ignore is the failure mode to avoid.

### Success Criteria

#### Automated Verification

- New spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/margin-forecast.test.ts`
- New spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/margin-v2.test.ts`
- New spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/calc.test.ts` (covering
  `rowPlannedForView` against `rowPlannedNetForView` on a discounted row — they must differ on the
  client view and agree on a subcontractor plane)
- Existing margin specs still pass untouched: `pnpm exec vitest run src/__tests__/calculate-margin.test.ts`

#### Manual Verification

- None — this phase renders nothing.

---

## Phase 2: The „Marża" tab

### Overview

Un-hide the tab and give it the two figures, the two toggles and the two descriptions.

### Changes Required

#### 1. Un-hide the tab

**File**: `src/components/kosztorys/summary/summary-panel-content.tsx`

**Intent**: Replace the `TODO(EX-649)` line with the restore condition the comment itself specifies,
preserving the current disclosure posture (client share never sees it).

**Contract**: `if (value === 'margin') return !preview && financials !== undefined` at `:186`; delete
the TODO block. The render guard at `:333` and the `view` fallback at `:190` stay as they are.

#### 2. Figure toggle and scenario toggle

**File**: `src/components/kosztorys/summary/tabs/summary-margin-tab.tsx`

**Intent**: One figure on screen at a time, picked by a toggle; the scenario toggle belongs to the
forecast only and must not render while the actual margin is shown, where it would imply an effect it
does not have.

**Contract**: Local `useState` for both picks — **not** `usePersistedEnum`. The `kosztorys-*`
localStorage family is what the disclosure lock (`use-kosztorys-view-state.ts:22-26`) treats as
client-writable, and this tab renders inside a component tree that also serves `(share)`. Scenario
defaults to `'w_tools'` (decision: z narzędziami, the conservative half). Use the same `ToggleGroup`
primitive as the tab bar at `:232`.

#### 3. The two panels

**File**: `src/components/kosztorys/summary/tabs/summary-margin-tab.tsx`

**Intent**: Render each figure with its own rows and its own explanation of how it is computed.

**Contract**: Keep the existing `SummaryTable` / `SummaryRow` / `faceValue` / `axis="net"` shape.

_Marża rzeczywista_ rows, in order: `Robocizna` (+), `Rabat` (−), `Należne podwykonawcom` (−),
`Materiały wliczone w robociznę` (−), `Strata` (−), `Marża` (bold, `danger` when negative). No
`Obniżka materiałów` row. Label for the crew cost must come from `SUBCONTRACTOR_FIGURE_LABELS`
(`constants.ts:24-28`) rather than a fresh string, so it cannot drift from the `Podwykonawcy` tab.
No `Zaliczki` / `Pozostało` rows (decision 5).

_Prognoza_ rows: `Wartość przedmiaru` (+), `Należne podwykonawcom (przedmiar)` (−), `Marża
prognozowana` (bold). No rabat, strata or material rows at all — their absence is the definition.

Each figure carries a short prose description directly under its table stating what it is computed
from. These are the only two places in the app that will explain the difference, so they are
load-bearing, not decoration.

#### 4. Withheld state

**File**: `src/components/kosztorys/summary/tabs/summary-margin-tab.tsx`

**Intent**: When an etap carrying executed work has no settlement plane, the actual margin is not
shown at all — a zero-cost crew is a false statement, not a missing one.

**Contract**: In place of the amount, a short call to action naming what is missing. The forecast is
**unaffected** and still renders: it prices the przedmiar at a chosen plane and never consults an
etap's plane.

#### 5. Feed the tab

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`, `src/components/kosztorys/summary/kosztorys-totals-panel.tsx`, `src/components/investments/investment-summary-panel.tsx`

**Intent**: Both hosts must supply what the two new figures need. The editor already holds every
input on its reactive spine; the investment page does not.

**Contract**: The editor passes `subcontractorDue` (`use-kosztorys-editor.ts:335`) and the row set the
forecast needs. `KosztorysTotalsPanel` stays a pass-through (`ComponentProps<typeof SummaryPanelContent>`).
For `InvestmentSummaryPanel`, the same phase-3 fold that serves the listing supplies the actual
margin; **the forecast is not rendered on that host** — decision 3 keeps it where the kosztorys is,
and the investment page has no rows. Drop `'margin'`'s forecast half there rather than shipping a
tree to compute it.

### Success Criteria

#### Automated Verification

- Panel gating spec covers the new visible tab: `pnpm exec vitest run src/__tests__/components/kosztorys/summary/summary-panel-content.test.ts`
- Phase-1 specs still pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/margin-v2.test.ts src/__tests__/lib/kosztorys/margin-forecast.test.ts`

#### Manual Verification

- As OWNER on `/inwestycje/31/kosztorys_v2`, the `Marża` tab is present and switches between
  Prognoza and Marża rzeczywista.
- The scenario toggle appears only under Prognoza, defaults to z narzędziami, and changes the amount
  when switched.
- As MANAGER, the `Marża` tab is absent on both the editor and the investment page.
- On the client share link, the `Marża` tab is absent, and setting `kosztorys-view:<id>` in
  localStorage by hand does not make it appear.
- On an investment with an etap that has executed work and no settlement plane, Marża rzeczywista
  shows the call to action instead of an amount, while Prognoza still shows amounts.

---

## Phase 3: The listing fold

### Overview

Express the crew cost and the withheld signal in Postgres, one row per investment, and pin the SQL
against the TS.

### Changes Required

#### 1. Subcontractor fold

**File**: `src/lib/db/kosztorys-subcontractor-due.ts` (new)

**Intent**: `subcontractorDueByPlane`'s combined figure and its unconfirmed-plane flag, for every
investment at once, without shipping any tree.

**Contract**: `selectKosztorysSubcontractorDue(db): Promise<{ investmentId: number; due: number; hasUnconfirmedPlane: boolean }[]>`.
Per etap: `Σ over items of qty_done × subcontractorPrice(item, stage.plane)`, where the price
reproduces `calc.ts:63` exactly — `'amount'` → the stored value, `'coeff'` → `client_price × value`,
`null` → `client_price × investments.<plane>_coeff`. Etapy with `plane IS NULL` contribute nothing and
instead set `hasUnconfirmedPlane` **when and only when** some item has `qty_done > 0` on that etap —
the same qty gate as `subcontractor-due.ts:47`. Rabat is absent by construction on this plane and must
not appear in the SQL. A new file rather than a widening of `kosztorys-client-totals.ts`: that fold
answers "what does the client owe", this one "what does the crew". Mirror its header comment
convention — state that TS is the reference and this is the copy, and name the spec that pins it.

#### 2. Cache

**File**: `src/lib/queries/balances.ts`

**Intent**: Serve the new fold cached, under the tags that already cover every table it reads.

**Contract**: A `fetchKosztorysSubcontractorDue` beside `fetchKosztorysClientTotals`, reusing
`KOSZTORYS_CLIENT_TOTALS_TAGS` (`:81-87` — `kosztorysStages` is already in it, so no new tag). Its own
`unstable_cache` key, versioned from `-v1`. Follow the precedent recorded at `:60-63`: a change to a
cached payload's **shape** requires a key bump.

#### 3. Parity spec

**File**: `src/__tests__/lib/db/kosztorys-subcontractor-due.test.ts` (new)

**Intent**: Make the two-planes-both-green drift impossible for this figure, the way
`kosztorys-client-totals.test.ts` does for the client pair.

**Contract**: DB-backed. Build a fixture investment with etapy across both planes plus one plane-less
etap with executed work, and items covering all three pricing modes (`amount`, `coeff`, derived) on
each plane. Assert the SQL result equals `subcontractorDueByPlane(rows, stages).combined` and that the
flags agree. Must fail red when either side is perturbed.

### Success Criteria

#### Automated Verification

- Parity spec passes: `pnpm exec vitest run src/__tests__/lib/db/kosztorys-subcontractor-due.test.ts`
- The existing client-totals parity spec still passes: `pnpm exec vitest run src/__tests__/lib/db/kosztorys-client-totals.test.ts`

#### Manual Verification

- None — verified by the parity spec.

---

## Phase 4: The „Marża v2" column

### Overview

The second column on the listing, plus the parity row that keeps it honest.

### Changes Required

#### 1. Row shape

**File**: `src/lib/queries/shape-investments.ts`

**Intent**: Add the new margin to the listing row without disturbing the existing one.

**Contract**: Consume the phase-3 fold beside `kosztorysTotals` and emit `marginV2: number | null` —
`null` expressing decision 4 (withheld), never `0`. Existing `margin` untouched, same call at `:64`.

#### 2. Column

**File**: `src/components/tables/investments.tsx`

**Intent**: Render `Marża v2` immediately after `Marża`, behind the same role gate.

**Contract**: Inside the existing `isAdminOrOwner` block, header `Marża v2`, right-aligned like its
neighbours, `BalanceCell` for an amount and a short `ustaw etapy` call to action for `null`. Keep the
cell numeric-aligned; the call to action is the exception, not a new column style.

#### 3. Parity row

**File**: `src/__tests__/investment-render-parity-db.test.ts`

**Intent**: Guard that the listing's new column and the editor's tab agree, across the SQL/TS seam
that is the most likely place for this change to drift.

**Contract**: The existing `'marża'` row at `:147` is **unchanged** — it still compares the old column
against `calculateMargin`. Add a `'marża v2'` row whose left side is `listingRow.marginV2` (through the
real `shapeInvestments`, as the surrounding comment at `:126-130` insists) and whose right side is
`marginV2(...)` fed by `subcontractorDueByPlane` **over the tree** — deliberately not the SQL fold, or
the row is a tautology. Assert the withheld case as `null` on both sides, not as `0`.

### Success Criteria

#### Automated Verification

- Listing shape spec passes: `pnpm exec vitest run src/__tests__/lib/queries/shape-investments.test.ts`
- Parity spec passes with the new row: `pnpm exec vitest run src/__tests__/investment-render-parity-db.test.ts`

#### Manual Verification

- On `/inwestycje` as OWNER, `Marża` and `Marża v2` sit side by side and differ on an investment that
  has both booked wypłaty and a kosztorys.
- Investments whose etapy lack a settlement plane show `ustaw etapy` in `Marża v2` and an unchanged
  amount in `Marża`.
- As MANAGER, neither margin column is present.
- `Marża v2` on the listing equals `Marża rzeczywista` in the kosztorys panel for the same investment.

---

## Phase 5: Guards and living docs

### Overview

Repair the golden master's blind spot and bring the prose in line.

### Changes Required

#### 1. Golden-master input signature

**File**: `src/__tests__/financial-golden-master-db.test.ts`

**Intent**: The per-investment input hash (`:139-160`) does not cover the subcontractor axis. Once the
listing reads it, an edit to an etap's plane or an item's override moves `marginV2` without moving the
hash, and the guard reports a data change as code drift.

**Contract**: Extend the signature SQL with `kosztorys_stages.plane`, `worker_id`, and the four
per-item override columns, then regenerate: `pnpm test:golden:update`. Regeneration is gated on the
dataset floor (`:237`), so `pnpm db:import:test` + `pnpm seed:kosztorys:test` must run first.

#### 2. Living docs

**Files**: `context/foundation/investment-financials-and-discount.md`,
`context/domain/01-domain-distillation.md`, `context/domain/02-glossary.md`,
`context/foundation/manual-checks.md`, `context/foundation/roadmap.md`,
`context/reference/kosztorys-editor-domain-notes.md`

**Intent**: Record the second figure without letting anyone read it as a reversal of what it is not.

**Contract**:

- `investment-financials-and-discount.md`: a new section for the v2 margin beside the existing formula
  at `:84-86`, which stays as the v1 statement. **The 2026-07-26 VAT ruling at `:97-102` stays intact
  and binding**; only its downstream consequence at `:103-105` gains a "this consequence holds for the
  v1 margin" qualifier. State explicitly that dropping `materialsNetDiscount` from the v2 margin is the
  removal of a term, not the booking of reclaimed VAT as profit — the reading rejected twice.
- `01-domain-distillation.md`: add the v2 formula beside `:122-124`; correct `:210`
  („kosztorys v2 rozłączony od marży") as superseded by EX-555.
- `02-glossary.md`: entries for the v2 margin, the forecast, and the subcontractor-due figure. English
  identifiers only — a Polish root with an English affix is banned by rules 1–3.
- `manual-checks.md`: new checks from phases 2 and 4. The `Obniżka materiałów` section at `:425-440`
  stays — the term still moves the v1 margin and the bilans.
- `roadmap.md`: a row for this slice; note that band 2 reopened.
- `kosztorys-editor-domain-notes.md`: correct `:844-853` (v2 disconnected from marża) and note that the
  plan-vs-actual sketch at `:208-221` is superseded by this change.

### Success Criteria

#### Automated Verification

- Golden master passes after regeneration: `pnpm test:parity`

#### Manual Verification

- None — prose only.

---

## Testing Strategy

### Unit Tests

- `marginForecast`: both halves priced pre-rabat; a row with a per-item rabat and an investment with a
  global rabat both leave the forecast unchanged; an `'amount'` override on one plane and a coefficient
  on the other yields different amounts per scenario.
- `marginV2`: each term subtracts; `materialsNetDiscount` is structurally absent; the withheld state
  cannot be rendered as an amount.
- `rowPlannedForView` vs `rowPlannedNetForView`: differ on the client view for a discounted row, agree
  on a subcontractor plane.

### Integration Tests

- SQL↔TS parity for the subcontractor fold (phase 3), including all three pricing modes on both planes
  and the plane-less-with-work case.
- Listing↔editor parity for `marginV2` (phase 4), with the right side computed from the tree.

### Manual Testing Steps

Collected into `context/foundation/manual-checks.md` at the final phase, from the phase blocks above.

## Performance Considerations

One additional cached fold per listing render, tagged identically to the existing one — so a kosztorys
edit already invalidates both, and no new revalidation path appears. The fold must stay one row per
investment; if it ever needs per-etap output, that belongs to the editor's path, not the listing's.

## Migration Notes

None. No stored figure changes and no schema change. `marginV2` is computed on read like every other
figure here.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`
- Parity suite passes: `pnpm test:parity`
- Build succeeds: `pnpm build`

## References

- Research: `context/changes/2026-08-18-marza-prognoza-rzeczywista/research.md`
- Decisions: `context/changes/2026-08-18-marza-prognoza-rzeczywista/change.md`
- SQL-fold precedent: `src/lib/db/kosztorys-client-totals.ts:9-25`
- Toggle precedent: `src/components/investments/stats-version-toggle.tsx:16-29`
- Disclosure lock: `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts:22-26,52`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The two formulas

#### Automated

- [x] 1.1 `margin-forecast.test.ts` passes — 3d3710cf
- [x] 1.2 `margin-v2.test.ts` passes — 3d3710cf
- [x] 1.3 `calc.test.ts` covers `rowPlannedForView` — 3d3710cf
- [x] 1.4 Existing `calculate-margin.test.ts` passes untouched — 3d3710cf

### Phase 2: The „Marża" tab

#### Automated

- [x] 2.1 `allowed-summary-views.test.ts` covers the now-visible tab (the gate was extracted from `summary-panel-content.tsx` to make it testable without a renderer) — 30791066
- [x] 2.2 Phase-1 specs still pass — 30791066

### Phase 3: The listing fold

#### Automated

- [x] 3.1 `kosztorys-subcontractor-due.test.ts` SQL↔TS parity passes (fails red on both perturbations: dropping the qty gate on the unconfirmed flag, and swapping the plane column pair)
- [x] 3.2 `kosztorys-client-totals.test.ts` still passes

### Phase 4: The „Marża v2" column

#### Automated

- [ ] 4.1 `shape-investments.test.ts` passes
- [ ] 4.2 `investment-render-parity-db.test.ts` passes with the new `marża v2` row

### Phase 5: Guards and living docs

#### Automated

- [ ] 5.1 `pnpm test:parity` passes after golden-master regeneration
