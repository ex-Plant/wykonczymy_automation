---
change_id: sheet-compare-footer-inconsistency
title: Show the sheet's own footer inconsistencies in „Porównaj z arkuszem", not only in the import
status: implemented
created: 2026-08-24
updated: 2026-08-24
archived_at: null
branch: sheet-compare-footer-inconsistency
worktree: null
---

## Notes

„Pobierz i zastąp" and „Porównaj z arkuszem" read the same sheet and compute the same figures, but
reported them so differently that the two windows contradicted each other on the same investment
(Planetowa 44a): the import showed two amber deltas, the comparison showed a green ✓.

Three defects, one cause — the comparison treated the sheet's own summary rows as an aside:

1. **The „wartość netto" disagreement was not shown at all.** `MoneyBlock` read that footer row only
   through `matchedAgainst === 'measuredNet'`; a row that matches NO app figure — precisely the
   disagreeing case — left `sheetMeasured` null and the whole line disappeared.
2. **The „R netto" disagreement was a footnote under a green verdict**, so the block's status said
   „everything agrees" while an amber sentence underneath said it did not.
3. **The two windows put the same number under opposite column headers.** In the import, „Ta
   aplikacja" is our pricing of the SHEET's own prace (the stored kosztorys is not in that table at
   all); in the comparison the same 116 489,30 zł sits under „Arkusz Google". Both borrowed the
   arkusz↔aplikacja headers for a check that is arkusz↔arkusz.

Fix: the footer check gets its own block in the comparison, with headers that say what the two
columns actually hold — „Wpisane na dole" / „Suma jego prac". The arkusz↔aplikacja table above it
keeps its own meaning, and its verdict stays green when the two sides genuinely agree: sheet-internal
inconsistency is a different question and now has its own ⚠.

The predicate for „the sheet disagrees with itself" (`sheetValue !== null && !matches`) lived inside
`evaluateImportGate`; it moved to `footer-totals.ts` as `footerDisagreements` so both dialogs read one
rule.

## Why the import's verdict was reworded

„Nasz odczyt prac nie daje sumy, którą arkusz Google ma w podsumowaniu — sprawdź ceny i rabaty."
names the wrong cause. Both live disagreements on Planetowa 44a are broken footer arithmetic, not
prices:

- **−2650 zł** — `S456` totals section headers from a hand-written list of 13, and the sheet has 14
  sections. `S316` („WC / parter", 2 650 zł) is simply absent from the formula.
- **−405 zł** — `X130` holds `=3*-135`, a correction typed straight into the etap-value column in
  place of that row's formula. The etap QUANTITY (`G130`) is empty, so we read 0 there; the sheet's
  „R netto" sums the value columns and picks the −405 zł up.

Neither is a cena or a rabat, so the verdict now points at the footer's own sums.

## What the review gate changed (see `review-gate.md`)

Two things the first pass got half-right, both fixed in `footer-totals.ts` rather than in a dialog —
the two windows now agree by construction instead of by each applying the same correction:

- **„R netto" is checked only against its namesake.** Its label names one figure; letting it match
  whichever candidate it happens to equal is how a footer summing the wrong columns lands on the
  OFFER total and reads as agreement. „wartość netto" keeps the full candidate scan, because
  Przedmiar and Pomiar are both defensible readings of THAT label. The first fix put this in a view
  helper (`againstNamedFigure`) that only the comparison window called, so the import kept the false
  ✓ — the same contradiction, sides swapped.
- **A row with no app-side counterpart is not a disagreement.** The Pomiar column is optional in the
  header; without it there is no like-for-like sum for „wartość netto", and falling back to Przedmiar
  accused a perfectly parsed sheet of a five-figure error. `appValue` is now `number | null` and
  `footerDisagreements` skips such a row — the mirror image of skipping a row the sheet doesn't
  carry.
