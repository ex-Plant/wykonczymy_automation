# Wydatek netto — brutto liczone z netto — Plan Brief

> Full plan: `context/changes/2026-07-29-netto-expense-grossup/plan.md`
> Change identity + owner decisions: `context/changes/2026-07-29-netto-expense-grossup/change.md`

## What & Why

A netto-billed expense stores its billed figure as **netto**. Every brutto axis in the panel uses
that amount as if it were brutto. Invert it: netto is the input, brutto = `netto × (1 + rate)`.

## Starting Point

`MaterialyBreakdownRowT.net` means brutto on a `gross` row and netto on a `netBilled` one,
discriminated by `origin`. The table's Netto column branches on it; the **Brutto column does not**
(`materials-breakdown-table.tsx:60`), so a netto row shows the same number in both columns and
Różnica `−0,00`. Separately, `materialsPair` adds `netBilled` to both axes at face value — correct
at rozliczenie netto/mieszany, understated at rozliczenie brutto.

## Desired End State

A `netBilled` row shows its amount under Netto and `amount × (1 + rate)` under Brutto in every mode;
`Razem` brutto becomes a brutto total; Różnica prints one minus. At rozliczenie **brutto** only,
„Do zapłaty" brutto gains `netBilled × vatRate`. v1 unchanged.

## Key Decisions Made

| Decision                 | Choice                                                                                     | Why                                                                                                                                  | Source           |
| ------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| Model                    | Every expense is shown on the settlement plane; a rate is only a **bridge** between planes | brutto → netto uses the materiały concession, netto → brutto uses VAT. Only the first bridge exists today — that IS the defect       | Owner 2026-07-29 |
| Scope                    | **Panel v2 only** — v1 knowingly left divergent                                            | v1 has no money axis at all; fixing one term inside a wrong sum moves bilans by an unexplainable amount                              | Owner 2026-07-29 |
| Gross-up rate            | `vatRate`, always                                                                          | The netto → brutto bridge is VAT by definition. A netto row's stored `amount` is the RECEIPT brutto (seller's ~23%), the wrong plane | Owner 2026-07-29 |
| Settlement-mode gate     | **None**                                                                                   | The brutto axis means „on the brutto plane"; mode only decides whether that axis is displayed                                        | Analysis         |
| Two rates competing?     | No — `netRate` only touches `gross` rows, `vatRate` only `netBilled` ones                  | They run in opposite directions on different row types; „which single rate governs the table" has no answer                          | Owner 2026-07-29 |
| Where the branch lives   | `breakdownRowPair` in `summary-economics.ts`, not in the component                         | `origin`'s meaning gets decided once; the table becomes plumbing, and the rule is unit-testable                                      | Q                |
| Row shape                | `MaterialyBreakdownRowT` unchanged — no second amount field                                | The builder is server-side and doesn't know the rates; adding them would drag presentation into `lib/db`                             | Analysis         |
| Wave-2 Netto fallback    | Untouched                                                                                  | It governs the netto reading of _brutto_ rows — independent of this bridge                                                           | Owner            |
| `computeMixedSettlement` | No change                                                                                  | It reads the netto axis only, which never moves                                                                                      | Research         |
| Tests                    | Unit only, in the existing `summary-economics.test.ts`                                     | Pure arithmetic on both planes; no server change, no new interaction                                                                 | Plan             |

## Scope

**In scope:** `breakdownRowPair` + the table reading both axes through it; the Różnica double-minus;
`vatRate` through `materialsPair` / `summaryLineMaterials` / `computeSummarySplit` /
`computeDoZaplatyRM` so the brutto axis carries the netto bucket's VAT; unit specs.

**Out of scope:** `deriveFinancials`, `totalMaterialCosts`, bilans, marża, the investments listing,
the investment page tiles, the Sheets bridge, `/raporty`, `preview-kosztorys.ts`,
`computeMixedSettlement`, migrations.

## Architecture / Approach

Two independent phases, either order. All valuation arithmetic in `summary-economics.ts`; the
settlement-mode decision stays in the panel beside the existing `effectiveNetRate` gate, so the
economics module stays pure. The new parameter is defaulted, so every existing caller and spec keeps
today's behaviour until threaded.

## Phases at a Glance

| Phase         | What it delivers                                              | Key risk                                                                |
| ------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1. Table      | Brutto column + `Razem` derive from netto; Różnica sign fixed | „Rozliczone R+M" holds `gross` rows only — must render exactly as today |
| 2. Settlement | `materialsPair` brutto axis carries the netto bucket's VAT    | Must not touch the netto axis in any mode (mieszany reads only that)    |

**Prerequisites:** none. `investments.vat_rate` is `NOT NULL DEFAULT 0.08` — **no migration**.
**Estimated effort:** ~1 session.

## Open Risks & Assumptions

- **Accepted divergence:** the table's `Razem` brutto stops reconciling with `totalMaterialCosts`,
  and at rozliczenie brutto „Do zapłaty" stops reconciling with the listing's bilans. Intended, owner
  decision. No automated gate asserts either (the Σ invariants assert `row.net`, which never
  changes), so nothing goes red — but the mismatch is real and lives until the v1 change lands.
- **No rate is frozen at the moment a figure is computed.** Every brutto/netto figure in the app is
  derived live from the investment's current `vat_rate` / `materials_net_rate`, so changing either
  rewrites history — including an offer a client already received. Kosztorys snapshots don't cover it
  (they hold items, not the settlement). Out of scope here; owed by the v1 change.
- **`materialsNetRate` is null on all 96 investments.** That is not „unconfigured" — the control
  reads „Rozliczanie wydatków: Brutto — po kwotach z paragonu (domyślne)"
  (`materials-net-pricing-control.tsx:17`) and switching off deliberately clears the rate (`:49`).
  So the brutto → netto bridge is currently inactive everywhere, and only the new netto → brutto one
  will actually fire in production.

## Success Criteria (Summary)

- Investment 31: „Materiały budowlane netto" → 100,00 netto / 105,00 brutto / −5,00; „Pozostałe
  koszty netto" → 20,00 / 21,00 / −1,00; `Razem` brutto 190 786,57; Korekta Różnica `14,29`.
- Investment 42 (tryb brutto): „Do zapłaty" brutto rises by `netBilled × 0,08`, netto unchanged;
  switching to netto or mieszany restores today's figures.
- „Materiały wliczone w robociznę" table unchanged; full vitest + typecheck green.
