---
change_id: materials-net-pricing-persisted
title: Give marża a materiały term — persist the netto reduction per investment and fix the settled-material VAT
status: implementing
created: 2026-07-26
updated: 2026-07-26
archived_at: null
branch: investment-summary-panel
worktree: null
---

## Notes

Marża carries no materiały term at all today, and that is wrong in two directions once the
company's VAT deduction is accounted for. Persist the materiały netto reduction per investment,
correct the settled-material cost to netto, and adopt both on the investment detail page, the
investments list, and /raporty.

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

> **AMENDED 2026-07-26 — read „The VAT-deduction correction" below alongside it.** The owner
> confirmed the company **deducts input VAT**. An earlier note here claimed that inverts the sign
> of the marża term below; it does not. `marża −= różnica` is the correct DELTA under both
> readings — VAT deduction moves the BASELINE the delta is taken from, not the sign. The reading
> below stands as written; what it misses is a separate, absolute term, spelled out below.

Różnica behaves like a `RABAT`: two-sided, per `AGENTS.md` › Transfer Business Logic.

- `różnica = materialsGrossBase × percent` (the netto-billed bucket is frozen against it by
  design — `materialsNetBilled` is already netto and cutting it again double-deducts VAT)
- `bilans += różnica` — the client is billed less, so they owe less
- `marża −= różnica` — the company absorbs the VAT

This is a **new term in marża**: `calculateMargin` today is
`robocizna − wypłaty − rabat − strata − rozliczone` and carries no materiały term at all
(`src/lib/db/calculate-margin.ts:13`).

### The VAT-deduction correction (owner, 2026-07-26)

**The company deducts input VAT on purchases.** Every figure below follows from that one fact,
which the reading above did not know. A material bought for 1230 brutto costs the company 1000 —
the 230 comes back from the tax office. So the reduction is not the company _eating_ VAT; it is
the company _forgoing_ a margin it would otherwise earn on the material.

One formula covers all three material regimes:

```
material's contribution to marża = what the client was billed − the real net cost
```

| Regime                             | Billed | Real cost | True term | Today's code |
| ---------------------------------- | ------ | --------- | --------- | ------------ |
| `INVESTMENT_EXPENSE` (brutto)      | 1230   | 1000      | **+230**  | absent       |
| the same, with the reduction on    | 1000   | 1000      | **0**     | absent       |
| `INVESTMENT_EXPENSE_NET`           | 1000   | 1000      | **0**     | absent ✔     |
| `settled` („wliczone w robociznę") | 0      | 1000      | **−1000** | **−1230** ✘  |

**What this does NOT change: the reduction's delta.** Rows 1→2 move the term by −230 under VAT
deduction; without deduction the same pair moves 0 → −230, also −230. So `marża −= różnica` is
right either way, and the plan built on it stands. Deduction moves the level, not the delta.

Three consequences, in severity order:

1. **`totalSettled` overstates the cost by the VAT** — it sums `amount` (the brutto receipt) but
   the company's real cost is netto, so **marża is understated by ~23% of every settled material**.
   This is live data, not a hypothetical: settled R+M has shipped and is in use. Owner ruling
   (2026-07-26): materiał wliczony w robociznę is **always** netto — not a mode, not a variant, so
   there is nothing to gate. **Parked as EX-595**, because the rate source is unresolved: a brutto
   expense stores neither a net amount nor a VAT rate, the investment's `vatRate` is the client's
   rate on prace (8% or 23%) rather than the shop's, and the existing `netAmount` column is the
   more accurate but more invasive source.
2. **The netto expense type is already correct** on both figures — bilans takes `netAmount`, marża
   takes nothing. The originally-diagnosed "różnica absorbed by nobody" is not a defect under VAT
   deduction. Nothing to fix there.
3. ~~**A plain brutto material may earn the company the VAT**~~ — **REJECTED by the owner,
   2026-07-26.** „Materiał to koszt, który klient zwraca w cenie brutto." Material is a
   pass-through: the client returns what was spent, the company comes out at zero, and marża
   therefore owes materiały **no term at all**. Today's absence of one is correct by design, not
   an oversight. Do not add a `+VAT` term, and do not re-derive this from the fact that input VAT
   is reclaimed — the owner has been asked twice and ruled the same way both times.

   This also fixes the reduction's meaning: it is a plain concession off a pass-through cost (the
   client returns less than was spent, the company eats the difference), not the giving-back of an
   unbooked earn. Marża falling by the różnica is both the right delta **and** the right level.

**Answered (owner, 2026-07-26) — the gate is lifted.** Two facts, both from the owner:

- **The client pays exactly the amount entered in the form.** No VAT is added on top of a
  materiały figure at rozliczenie netto or mieszany. The company does **not** book the reclaimed
  VAT as profit — see (3): material is a pass-through cost returned at brutto, so marża carries no
  materiały term and the reduction is a straight concession.
- **At rozliczenie brutto VAT _is_ added on top, and then the reduction makes no sense.** This is
  the owner's own reason for the settlement-mode gating the plan already carries — it is now a
  confirmed rule rather than an assumption.

**The reduction is an independent commercial decision, not a consequence of the settlement mode.**
Two investments settled identically can be priced differently — one gets the materiały discount,
one does not. So the rate is its own field, and Phase 1's shape stands as written.

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
