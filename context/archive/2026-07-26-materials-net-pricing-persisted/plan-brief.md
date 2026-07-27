# Persisted materials net pricing — Plan Brief

> Full plan: `context/changes/2026-07-26-materials-net-pricing-persisted/plan.md`

## What & Why

The panel's "price materiały netto" control lives entirely in the browser, so the discount it applies
never reaches the server-rendered figures. Dogfooding on investment 31 surfaced the result: the v1
investor balance and the v2 „Do zapłaty" disagreed by 14 452,85 zł, the whole gap being materiały
priced with the reduction on one side and without it on the other. This change persists the setting
per investment and makes the money it gives away land where it belongs — the investor balance rises,
the margin falls.

## Starting Point

The on/off flag persists in `localStorage`; the percent is an unsaved `useState` seeded from the VAT
rate — so the flag survives a reload and the number does not. Server-side, `calculateMargin` has no
materiały term at all and `calculateBalance` counts materiały at full face value. Two further errors
ride along: the reduction is computed as `brutto × (1 − rate)`, which is not a VAT strip (123 zł gives
94,71, not 100), and nothing records the company absorbing the difference.

## Desired End State

An investment carries an optional materials net rate. Set it, and the difference
`brutto − brutto / (1 + rate)` lowers Marża and raises Bilans inwestora by the same amount, shown as
its own „Obniżka materiałów" row in the panel and beside Marża on the investment card. Leave it unset —
as every existing investment is — and nothing changes. Settle the investment brutto and the discount
switches off, with a notice saying so.

## Key Decisions Made

| Decision               | Choice                                                       | Why (1 sentence)                                                                                                     |
| ---------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Default state          | One nullable field, null = off                               | Existing investments keep today's figures, and one field cannot contradict itself the way the current pair does.     |
| Arithmetic             | Division by `1 + rate`, not subtraction of `rate`            | Subtracting 23% off brutto gives 94,71 where netto is 100 — roughly 7 700 zł wrongly taken from the margin at scale. |
| Settlement-mode gating | Applies at netto and mieszany; not at brutto                 | Owner ruling: a brutto-invoiced client pays brutto, so there is nothing to strip.                                    |
| Margin absorbs it      | `Marża −= różnica`, `Bilans += różnica`                      | If the balance moves and the margin does not, money vanishes from the model — the same two-sided shape a RABAT has.  |
| Where it's computed    | Once in `deriveFinancials`, carried on the financials object | Both formulas already take that object whole, so no signature and no call site has to be re-threaded.                |
| Browser-local state    | Deleted outright                                             | Keeping a local override reinstates exactly the split that caused the diagnosed disagreement.                        |
| `/raporty`             | Out of scope; loud warning on the page + a Linear issue      | Its blended cross-investment aggregate cannot take a per-investment rate without a new query.                        |
| Investments list       | Marża becomes correct; no discount column                    | The column would be empty on every row until a rate is set.                                                          |
| Rate source            | Its own field, not the investment's VAT rate                 | Materiały can sit on a different rate than robocizna, and the field also carries the on/off state.                   |

## Scope

**In scope:** nullable rate column + Payload field + write action; the discount derived once and added
as a term to both financial formulas; the investments list and detail page reading it; the panel
control switched from browser to server, its arithmetic corrected to division, and the discount shown
as a labelled row; a brutto-mode notice; a warning on `/raporty`.

**Out of scope:** computing the discount in `/raporty`; a discount column on the investments list; any
backfill; a preview-without-saving affordance; **any `+VAT` term on plain brutto materiały** — the
owner rejected it outright, materiały is a pass-through; **costing the settled bucket netto instead
of brutto** — a real defect, parked as EX-595.

## Architecture / Approach

`deriveFinancials` gains two optional trailing params — the rate and the settlement mode — and emits
`materialsNetDiscount` on `InvestmentFinancialsT`, computed only from `materialsGrossBase` (the
netto-billed bucket is already netto and would be double-stripped). `calculateMargin` subtracts it,
`calculateBalance` adds it; neither signature changes. Surfaces that cannot supply the rate pass
nothing and get 0 — identical to an unset investment, so "can't compute it" and "nothing to compute"
collapse into one safe default. The gate on settlement mode lives with the computation, so no reader
can forget it.

## Phases at a Glance

| Phase                             | What it delivers                                                              | Key risk                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1. Persist the rate               | Column, Payload field, write action, rate + mode on reference data            | A default or `required` on the field would destroy the null-means-off semantics                 |
| 2. The difference in the figures  | Discount derived and gated; one new term in each formula; unit tests; fixture | Discounting `totalMaterialCosts` instead of `materialsGrossBase` double-strips the netto bucket |
| 3. Panel writes, discount visible | localStorage deleted, control saves, division not subtraction, „Obniżka" row  | The division fix moves on-screen numbers for existing users regardless of any saved rate        |
| 4. Guard the reports page         | Loud warning + Linear issue for the real fix                                  | The warning quietly outliving its issue and becoming furniture                                  |

**Prerequisites:** none — the settlement-mode change this copies has already shipped.
**Estimated effort:** ~2 sessions across 4 phases; phase 2 carries the arithmetic risk, phase 3 the UI churn.

## Open Risks & Assumptions

- **GATE LIFTED (owner, 2026-07-26).** The client pays exactly the amount entered in the form — no
  VAT on top at rozliczenie netto or mieszany — so the reduction is a real concession and Phases
  2–3 have their subject. The reduction is also an independent commercial decision (two
  identically-settled investments can be priced differently), so it keeps its own field instead of
  being derived from the settlement mode. All four phases are cleared.
- **Settlement mode stops being inert.** Switching an investment between netto and brutto now moves
  Marża and Bilans with no change in transactions. Accepted deliberately: the two modes are different
  commercial arrangements, and the brutto-mode notice keeps the change from being silent.
- **Marża owes materiały no term of its own — owner ruling, 2026-07-26.** „Materiał to koszt,
  który klient zwraca w cenie brutto": a pass-through, company at zero, the reclaimed VAT is not
  booked as profit. So the baseline the discount is measured against is correct, and `marża −=
różnica` is right at the level as well as the delta. An earlier revision of this brief called
  the baseline wrong by the VAT and floated a `+VAT` term — that reading is rejected, do not
  revive it. The one materiały defect that does stand is the settled bucket, EX-595 (parked).
- **The parity golden master is regenerated, not verified.** The unit tests are what prove the
  formulas; the master only pins them afterwards.

## Success Criteria (Summary)

- An investment with no rate set reads exactly the Marża and Bilans it read before this change.
- Setting 23% on a netto investment lowers Marża and raises Bilans by `brutto − brutto / 1,23`, and
  that same amount is visible as its own row.
- The investments list, the detail page, and the panel agree on Marża for the same investment.
