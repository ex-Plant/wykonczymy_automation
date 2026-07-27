# Subcontractor Price Guard — Plan Brief

> Full plan: `context/changes/2026-07-27-subcontractor-price-guard/plan.md`

## What & Why

The subcontractor price in the two tool-plane views can be set to anything and nothing stops it from
eating the client margin. This adds one rule — the subcontractor price may not exceed 80% of the
client price — and enforces it at every door the price can come through.

## Starting Point

Pricing is already pure and centralized: `calc.ts` resolves all three modes (auto / własny mnożnik /
kwota stała) and every figure the rule needs already sits on the row. The two editable cells already
have an early-return seam that refuses unparseable input, and `DecimalField` already implements
reject-and-snap-back for an out-of-range entry. There is no validation of any kind on the
subcontractor price today.

## Desired End State

Typing a price above the ceiling leaves the row untouched, turns the cell red, and pops a tooltip
naming the maximum in złotych. The „Cena" cell renders red whenever the row breaches the ceiling and
amber whenever it merely exceeds the global-coefficient rate — so a lowered client price or a raised
global coefficient surfaces even though nobody touched the subcontractor columns. The global
coefficient itself cannot be set above 0.8. No total changes.

## Key Decisions Made

| Decision            | Choice                                                             | Why                                                                                                                     | Source  |
| ------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------- |
| Warning baseline    | Price above the **investment's global coefficient** rate, any mode | Makes the two rules one ladder: amber above the default rate, red above 80%                                             | Shaping |
| Error behaviour     | **Block the write**, red cell + in-place tooltip                   | The owner learns the ceiling at the moment of typing, not from a summary later                                          | Shaping |
| Scope of the check  | **Standing row state**, not just the keystroke                     | Otherwise a lowered client price or a raised global coefficient walks past the rule unseen                              | Shaping |
| Threshold home      | **Code constant**, not a per-investment setting                    | 80% is a business rule, not a negotiated parameter; a DB column everyone leaves at default is forever                   | Shaping |
| Rejection feedback  | Red cell + tooltip, cleared on the next accepted entry             | Same channel as the existing blocked-action tooltip; a toast would fire mid-typing with the message in the wrong corner | Plan    |
| Where the red lives | „Cena" only, never „Mnożnik"                                       | The rule is about the price; a red multiplier points at the wrong cell when the client price is what moved              | Plan    |
| Global coefficient  | Capped at 0.8 in settings                                          | One field would otherwise breach the rule on every „auto" row at once, unfixable row-side                               | Plan    |

## Scope

**In scope:** the pure rule + its unit test; write rejection in the „Mnożnik" and „Cena" cells;
standing red/amber on „Cena"; an `open` prop on `SimpleTooltip`; `max` on the global-coefficient
fields.

**Out of scope:** any change to a total or settlement figure; a summary banner or bad-row counter; a
DB column for the threshold; any guard on the client-price column; migrations.

## Architecture / Approach

`subcontractor-price-guard.ts` owns the threshold, both comparisons, the tolerance, and the Polish
messages, returning `{ severity, message } | null` over `ViewPricingT`. It computes no price of its
own — it reads `subcontractorPrice` and `effectiveCoeff` from `calc.ts`. Three consumers read that
verdict and do nothing else: the two cells' `onChange` (block), the „Cena" cell's render (colour +
tooltip), and the settings field (`max` prop). Nothing is shared between them but the rule.

## Phases at a Glance

| Phase           | What it delivers                               | Key risk                                                                                      |
| --------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1. The rule     | Pure module + boundary unit test               | Off-by-a-hair at the two thresholds — which is exactly what the test pins                     |
| 2. The grid     | Write rejection + standing red/amber on „Cena" | `SimpleTooltip` needs an `open` prop; cell-local rejection state is a shape no cell has today |
| 3. The settings | Global coefficient capped at 0.8               | None — `DecimalField.max` already does the work                                               |

**Prerequisites:** none.
**Estimated effort:** one session.

## Open Risks & Assumptions

- Assumes no amber/warning colour token exists yet in the grid's palette; if not, one gets added
  rather than an arbitrary bracket colour.
- An investment whose global coefficient already exceeds 0.8 (set before this change) will render
  every „auto" row red until the coefficient is lowered. **Accepted by the owner (2026-07-27): let it
  glow.** No grandfathering, no one-off migration of existing coefficients.

## Success Criteria (Summary)

- A price above 80% of the client price cannot be typed into a row.
- A row that breaches the rule from the side (client price lowered, global coefficient raised) reads
  red without anyone opening the subcontractor columns.
- Every total in „Podsumowanie" is identical to before the change.
