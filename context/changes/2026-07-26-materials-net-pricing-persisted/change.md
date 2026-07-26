---
change_id: materials-net-pricing-persisted
title: Persist the materiały netto reduction per investment and flow its różnica into bilans and marża
status: new
created: 2026-07-26
updated: 2026-07-26
archived_at: null
branch: null
worktree: null
---

## Notes

Persist the materiały netto reduction per investment; a „Różnica" figure that raises Bilans
inwestora and lowers Marża, adopted by the investment detail page, the investments list, and
/raporty.

### Why this exists

Diagnosed 2026-07-26 while dogfooding EX-594 on investment 31: v1's „Bilans inwestora"
(−13 189,23) and v2's „Do zapłaty" (−1 263,62) disagreed by 14 452,85. Same figure, opposite sign
convention — the entire gap was materiały, 180 660,57 (v1) vs 166 207,72 (v2).

Cause: the panel always passes a reduction into `computeDoZaplatyRM`, so `materialyPair` takes the
`reduction != null` branch (`src/lib/kosztorys/summary-economics.ts:40`) and prices materiały at
`grossBase × (1 − 0,23) + netBilled`. v1's bilans reads `totalMaterialCosts` at face value. The
reduction defaults ON: `useMaterialsNetPricing()` defaults to `'net'`, and
`materialsReductionPercent` is seeded from the VAT rate (`summary-panel-content.tsx:180`).

Two defects behind it, both fixed by this change:

- the reduction lives in **localStorage + a plain `useState`**, so it can never reach the
  server-rendered v1 figures, and the percent silently resets to the VAT rate on every reload
  while the on/off flag persists — the pair is already inconsistent with itself.
- the różnica is **absorbed by nobody**: the client is billed less, but no figure records the
  company eating it.

### Owner decisions (2026-07-26)

1. **Default is `null` = off, face value.** Existing investments keep today's v1 figures; the
   reduction applies only where explicitly set. Rejected: defaulting to 23% everywhere, which
   would silently rewrite marża and bilans on every investment including closed ones.
2. **Every surface adopts it** — investment detail, the investments list, and /raporty. A surface
   that kept ignoring the różnica would just replace the diagnosed disagreement with a new one.

### The domain reading to implement

Różnica behaves like a `RABAT`: two-sided, per `AGENTS.md` › Transfer Business Logic.

- `różnica = materialsGrossBase × percent` (the netto-billed bucket is frozen against it by
  design — `materialsNetBilled` is already netto and cutting it again double-deducts VAT)
- `bilans += różnica` — the client is billed less, so they owe less
- `marża −= różnica` — the company absorbs the VAT

This is a **new term in marża**: `calculateMargin` today is
`robocizna − wypłaty − rabat − strata − rozliczone` and carries no materiały term at all
(`src/lib/db/calculate-margin.ts:13`).

### Known blast radius

`deriveFinancials` takes only transfer aggregates today; the per-investment percent has to be
threaded in, and the list query needs it joined per row rather than fetched one investment at a
time.

- `src/lib/db/calculate-margin.ts` / `src/lib/db/calculate-balance.ts` — the two figures
- `src/lib/queries/investments.ts:53` — the investments list computes marża per row
- `src/app/(frontend)/raporty/page.tsx:64` — reports aggregate marża across investments
- `src/app/(frontend)/inwestycje/[id]/page.tsx:105,126` — both readings' tiles
- `src/scripts/audit-investment-parity.ts:49` — the parity golden master will move
- `src/components/kosztorys/summary/hooks/use-materials-net-pricing.ts` — the localStorage hook
  this replaces
- `src/components/kosztorys/summary/summary-panel-content.tsx:180` — the unpersisted
  `materialsReductionPercent` state

Owes a hand-written migration (per `AGENTS.md` › Migrations) for the new investment column.
Naming follows the glossary: English identifiers, `discount` not `rabat`.
