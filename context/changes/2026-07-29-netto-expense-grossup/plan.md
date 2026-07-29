# Wydatek netto — brutto liczone z netto przez stawkę — Implementation Plan

## Overview

A netto-billed expense (`INVESTMENT_EXPENSE_NET`) stores its billed figure as **netto**. Everywhere
the panel shows a brutto axis, that netto amount is currently used **as if it were brutto** — face
value, no VAT added. Invert it: netto is the input, brutto = `netto × (1 + rate)`.

Two independent planes, in one change:

1. **Presentation** — the „Wydatki inwestycyjne" table's Brutto column and its `Razem`. Wrong today
   in **every** settlement mode; fixed unconditionally.
2. **Settlement** — the brutto axis of `materialsPair`, i.e. „Do zapłaty" / the brutto waterfall.
   Grossed up **only at rozliczenie brutto** (`settlementMode === 'GROSS'`), per the owner's ruling
   of 2026-07-29.

**Deliberately out of scope: the whole v1 plane.** `deriveFinancials`, `totalMaterialCosts`, bilans,
marża, the investments listing and the investment page keep computing exactly what they compute
today — which is already wrong for unrelated, larger reasons (see „Known divergence"). Owner
decision, 2026-07-29: get the panel right first, fix v1 as its own change.

## Current State Analysis

### The presentation defect (mode-independent)

`MaterialyBreakdownRowT.net` carries **two different meanings**, discriminated by `origin`
(`src/types/investment-financials.ts:32`): on a `gross` row it holds the recorded brutto; on a
`netBilled` row it holds the netto. `buildMaterialyBreakdown` writes the netto straight into that
field (`src/lib/db/map-category-costs.ts:63-68`).

The table honours the discriminator in **one** of two columns:

- `netOf` branches on `origin` (`materials-breakdown-table.tsx:44-45`) — correct.
- The Brutto cell renders `row.net` raw (`:60`), as does `totalGross` (`:46`) — **no branch**.

Result on a `netBilled` row: Brutto and Netto show the identical number and Różnica is `−0,00`.
Reproduced on investment 31 („11 Listopada 40", VAT 5%, tryb netto): rows „Materiały budowlane
netto" 100,00 = 100,00 and „Pozostałe koszty netto" 20,00 = 20,00. `Razem` brutto is therefore not
a brutto total — it folds 120,00 in at face value instead of 126,00.

Same table, same expression: **Różnica renders a double minus** on a negative row. `:65` glues a
`−` in front of `formatNet(...)`, which prints its own sign, so the negative „Korekta (bez
kategorii)" row shows `−−14,29`.

### The settlement defect (rozliczenie brutto only)

`materialsPair` adds `netBilled` to **both** axes at face value
(`src/lib/kosztorys/summary-economics.ts:49-52`). At rozliczenie netto and mieszany that is correct
— the investor is billed netto and owes no VAT on it. At rozliczenie **brutto** every other figure
carries VAT toward the investor and this one does not, so „Do zapłaty" understates by
`netBilled × vatRate`.

`computeMixedSettlement` needs **no change**: it grosses only the still-owed netto
(`:171`), and tryb mieszany is by definition not tryb brutto.

### Rate availability

`investments.vat_rate` is `numeric NOT NULL DEFAULT 0.08` (verified against the local schema, and
`src/migrations/20260710_0_add_vat_rate_to_investments.ts`). **No migration.** Every host already
passes `vatRate` and `settlementMode` to `SummaryPanelContent` as required props, so the fix reaches
the editor, the investment page and the client share without new plumbing at the page level.

### The gate already has a home

`summary-panel-content.tsx:213` computes `effectiveNetRate = settlementMode === 'GROSS' ? null :
materialsNetRate` — the settlement-mode decision lives in the panel, and `summary-economics.ts`
stays pure arithmetic (the file states this rule itself at `:33`). The new gate goes beside it, same
shape.

### Key Discoveries

- `src/lib/constants/transfers.ts:214` — `INVESTMENT_EXPENSE_NET` has `billedAmount: 'netAmount'`;
  `billedAmountFor` (`:413`) is what puts netto into the breakdown row.
- The `Σ === totalMaterialCosts` invariants are asserted over **`row.net`**, not over rendered
  totals (`src/__tests__/derive-financials-bucketing.test.ts:260,289,325`;
  `src/__tests__/map-category-costs.test.ts:60`). This change never writes `row.net`, so all of them
  stay green.
- `src/__tests__/lib/kosztorys/summary-economics.test.ts:297` — „the netto-billed bucket is frozen
  against the materiały toggle" asserts today's behaviour against the **materiały rate**. The new
  gross-up rate is a separate, defaulted parameter, so that suite stays green unchanged.
- Settlement call sites of `materialsPair`: `summary-panel-content.tsx:217`
  (`computeDoZaplatyRM`), `summary-overview-tab.tsx:86` (`.net` only — gross-up invisible),
  `summary-breakdown-table.tsx:75` (`summaryLineMaterials`), `brutto-netto-summary.tsx:88`
  (`computeSummarySplit`), `mixed-summary.tsx:43` (`computeMixedSettlement` — untouched).

## Desired End State

- In the „Wydatki inwestycyjne" table a `netBilled` row shows its stored amount under **Netto**, and
  `amount × (1 + rate)` under **Brutto**, with a real Różnica. `Razem` brutto is a brutto total.
  Unconditional — every settlement mode, both the concession rate and the VAT fallback.
- Różnica prints one minus sign, and stays honest on a negative row.
- At rozliczenie **brutto**, „Do zapłaty" brutto and the brutto waterfall include
  `netBilled × vatRate`. At netto and mieszany nothing moves.
- v1 (bilans, „Koszty inwestora", per-category columns, „Korekta (bez kategorii)" tile) is
  byte-for-byte unchanged.

### The model (owner, 2026-07-29)

1. An investor settles on **one** plane — netto or brutto. That is `settlementMode`.
2. Every expense carries **one** stored amount, and its type says which plane it is on: brutto (the
   receipt) or netto.
3. Show it on the settlement plane. Already there → untouched. Not there → convert.

A rate is only ever a **bridge between planes**, and the two bridges run in opposite directions:

| Bridge         | Rate                                   | Where                                    |
| -------------- | -------------------------------------- | ---------------------------------------- |
| brutto → netto | stawka materiałów (`materialsNetRate`) | a brutto expense read on the netto plane |
| netto → brutto | VAT inwestycji (`vatRate`)             | a netto expense read on the brutto plane |

**Only the first bridge exists in the code today.** That is the whole defect — in the table's Brutto
column and in `materialsPair` alike. This change builds the second one.

They are not two competing rates for one figure: each governs a different row type, in a different
direction. Asking „which single rate governs the table" (an earlier framing in this plan) has no
answer, because the two row types start on opposite planes.

## What We're NOT Doing

- `deriveFinancials`, `totalMaterialCosts`, `calculateBalance`, `calculateMargin` — untouched.
- The investments listing („Koszty inwestora", Bilans, Materiały budowlane / wykończeniowe /
  Pozostałe koszty, Wydatki inwestycyjne) and the investment page header tiles — untouched.
- The Sheets bridge / `preview-kosztorys.ts` / `/raporty` financial calls — untouched.
- `computeMixedSettlement` — no change needed, see above.
- Any migration, any schema change, any data backfill.

## Known divergence (accepted)

After this change the panel's „Wydatki inwestycyjne" `Razem` brutto no longer reconciles with
`totalMaterialCosts`, and at rozliczenie brutto „Do zapłaty" no longer reconciles with the listing's
bilans. **This is intended.** v1 has no money axis at all: `totalMaterialCosts` adds brutto receipts
to netto amounts in one scalar (`investment-financials.ts:94`), and `calculateBalance` folds in the
settlement mode through a single term that is hard-zeroed at GROSS (`:88`) while never adding VAT to
robocizna. Correcting one term inside that sum would move the bilans by an amount nobody could
explain. Deferred to its own change.

No automated gate asserts either reconciliation (verified above), so nothing goes red.

## Implementation Approach

Two phases, independent, either order. Phase 1 is the visible bug and the smaller diff.

All valuation arithmetic lands in `src/lib/kosztorys/summary-economics.ts` — including the row-level
one, so the meaning of `origin` is decided in exactly one place instead of being re-branched in a
component. The table becomes plumbing.

---

## Phase 1: Brutto column derives from netto

### Changes

**`src/lib/kosztorys/summary-economics.ts`** — new export beside `billedMaterialsPair`:

```ts
// One breakdown row on both axes. `row.net` is brutto on a `gross` row and netto on a `netBilled`
// one, so the plane a row starts on — and therefore which bridge it needs — is decided here rather
// than re-branched in each column of the table.
export function breakdownRowPair(
  row: { net: number; origin: 'gross' | 'netBilled' },
  // brutto → netto: the materiały concession. null = billed off the receipt, no bridge.
  netRate: number | null,
  // netto → brutto: VAT, always. A netto row's stored `amount` is the RECEIPT brutto (seller's VAT,
  // typically 23%) — the company reclaims that, so it is the wrong plane to bill the investor on.
  vatRate: number,
): MoneyPairT {
  if (row.origin !== 'netBilled') return billedMaterialsPair(row.net, netRate)
  return { net: row.net, gross: row.net * (1 + vatRate) }
}
```

The two rates never compete: `netRate` only ever touches a `gross` row, `vatRate` only ever a
`netBilled` one. The company-plane („Rozliczone R+M") table holds `gross` rows only and passes
`netRate = null`, so it stays brutto-only exactly as today.

**The Netto column's VAT fallback (`materialsNetRate ?? vatRate`, wave 2) is untouched.** It governs
the netto reading of _brutto_ rows and is independent of this bridge.

**`src/components/kosztorys/summary/tables/materials-breakdown-table.tsx`**:

- replace `netOf` with `pairOf = (row) => breakdownRowPair(row, netRate, vatRate)`; the component
  gains a `vatRate` prop (the tab already holds it)
- Brutto cell (`:60`) and `totalGross` (`:46`) read `.gross`, not `row.net`
- Różnica = `net − gross` (naturally ≤ 0 on a positive row), rendered by `formatNet` **without** a
  hand-glued `−`. Fixes the `−−14,29` double minus and stays correct on the negative Korekta row,
  where netto is legitimately _above_ brutto.
- Row-visibility filter (`:35`) keeps testing `row.net !== 0` — a zero-netto row has zero brutto too.

### Success Criteria

#### Automated

- [ ] `pnpm exec vitest run src/__tests__/lib/kosztorys/summary-economics.test.ts` — new
      `breakdownRowPair` block: `netBilled` row grosses up; `gross` row unchanged; `netRate = null`
      is identity on both; a negative row keeps its sign and its ratio.
- [ ] `pnpm exec vitest run` — green; in particular `derive-financials-bucketing` and
      `map-category-costs` Σ invariants untouched.
- [ ] `pnpm typecheck`

#### Manual

- [ ] Investment 31 → `/inwestycje/31/kosztorys_v2` → „Materiały": „Materiały budowlane netto" shows
      100,00 netto / 105,00 brutto / −5,00; „Pozostałe koszty netto" 20,00 / 21,00 / −1,00; `Razem`
      brutto 190 786,57.
- [ ] „Korekta (bez kategorii)" Różnica reads `14,29`, not `−−14,29`.
- [ ] „Materiały wliczone w robociznę" table (netRate = null) renders exactly as before.

---

## Phase 2: Brutto settlement adds VAT to the netto bucket

### Changes

**No settlement-mode gate.** The brutto axis _means_ „on the brutto plane", so a netto expense read
there is `netto × (1 + vatRate)` regardless of mode — the mode only decides whether that axis is
displayed. This is the same second bridge as Phase 1, applied to the aggregate instead of the row.

**`src/lib/kosztorys/summary-economics.ts`** — `materialsPair` gains `vatRate`; the netto axis is
untouched, only the brutto one changes:

```ts
export function materialsPair(materials: MaterialsT, netRate: number | null, vatRate: number) {
  const base = billedMaterialsPair(materials.grossBase, netRate)
  return {
    net: base.net + materials.netBilled,
    // The netto bucket crosses to the brutto plane here — the one place it was previously added bare.
    gross: base.gross + materials.netBilled * (1 + vatRate),
  }
}
```

`summaryLineMaterials`, `computeSummarySplit` and `computeDoZaplatyRM` already receive `vatRate` (or
sit next to it) — thread it through. `computeMixedSettlement` reads `materialy.net` only (`:169`), so
the netto axis it depends on does not move; pass `vatRate` for the shared shape and nothing changes.

No panel gate, no new prop, no threading past the economics module.

### Success Criteria

#### Automated

- [ ] `pnpm exec vitest run src/__tests__/lib/kosztorys/summary-economics.test.ts` — new cases:
      `materialsPair` brutto axis gains `netBilled × vatRate`; the **netto axis never moves** in any
      case; `computeDoZaplatyRM` brutto rises by the same amount.
- [ ] The existing „the netto-billed bucket is frozen against the materiały toggle" suite (`:297`)
      needs its **gross-axis** assertions updated — they encode the defect. Every netto-axis
      assertion in it must stay untouched and green: that suite's real subject is that the materiały
      concession cannot reach this bucket, which remains true.
- [ ] `pnpm exec vitest run` — green.
- [ ] `pnpm typecheck`

#### Manual

- [ ] Investment 42 („Bialostocka 5", tryb brutto, VAT 8%, one netto expense): „Do zapłaty" brutto
      rises by `netBilled × 0,08`; netto unchanged.
- [ ] Switch 42 to tryb netto → netto figures identical to before the change; to mieszany → all
      figures identical (it reads the netto axis only).
- [ ] Investment 31 (tryb netto) → „Do zapłaty" identical to before the change.

---

## Testing Strategy

Pure arithmetic on both planes, so everything lands as unit specs in the existing
`src/__tests__/lib/kosztorys/summary-economics.test.ts`. No new DB spec (nothing server-side moves),
no E2E (no new interaction — the same panel, different numbers).

Risk covered: **the two axes of one figure disagreeing**. Every new case asserts the netto axis is
unmoved while the brutto axis changes, which is exactly the failure this change exists to prevent
and the shape the existing „frozen bucket" suite already uses.

## Performance Considerations

None — two multiplications per render.

## References

- Research: `context/changes/2026-07-29-netto-expense-grossup/research.md`
- Owner rulings 2026-07-29: `change.md`, research §„Rozstrzygnięcia właściciela"
- Domain background: `context/reference/kosztorys-editor-domain-notes.md`

## Progress

#### Phase 1 — Brutto column derives from netto

- [ ] `breakdownRowPair` in `summary-economics.ts` + spec
- [ ] `materials-breakdown-table.tsx` reads both axes through it
- [ ] Różnica double-minus fixed
- [ ] `pnpm typecheck` + full vitest green

#### Phase 2 — Brutto settlement adds VAT to the netto bucket

- [ ] `netBilledGrossRate` param through `materialsPair` / `summaryLineMaterials` /
      `computeSummarySplit` / `computeDoZaplatyRM` + specs
- [ ] `netBilledGrossRate` gate in `summary-panel-content.tsx`, threaded to both overview blocks
- [ ] `pnpm typecheck` + full vitest green
