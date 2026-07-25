---
change_id: subcontractor-view-settlement-only
title: Subcontractor views become settlement-only — plane-filtered pomiar, no przedmiar-anchored columns
status: implemented
created: 2026-07-25
updated: 2026-07-25
archived_at: null
branch: subcontractor-view-settlement-only
worktree: null
---

## Notes

widok podwykonawcy liczy tylko etapy swojego planu (pomiar, wartość, podsumy, Razem) i chowa kolumny
zakotwiczone w przedmiarze (Pozostało, % wykonania, przekroczenie, podsuma przedmiaru); widok Klient
bez zmian

Follows EX-565 (etap-tool-plane). That slice gated only the per-etap wartość axis (U–AE) behind
`stageAppliesToView`; every figure derived from „Pomiar z natury" — which is Σ of all ten etap qty
columns by EX-494 — stayed plane-blind. So in a subcontractor view the other plane's executed qty
still lands in the row's wartość/pozostało/% and in the section subtotals + „Razem", repriced at the
wrong plane's rate. The grid therefore contradicts „Podsumowanie podwykonawców" on the same screen,
which already values each etap at its own plane's price.

Owner ruling (2026-07-25, this session): the subcontractor view stops being „the same rozpiska at a
different price" and becomes the crew's bill. Przedmiar has no plane — it is typed once per row for
the whole offered scope — so any figure comparing a plane-filtered pomiar against a whole przedmiar
is meaningless there and gets hidden rather than filtered.

### Two rulings settled by throwaway spike (2026-07-25)

An ad-hoc spike explored this and the owner reviewed it in the browser. Direction approved; the code
is thrown away and rebuilt through the normal ceremony. Reference diff (may go stale, do not apply
blind): `scratchpad/adhoc-subcontractor-view.patch` in the session scratchpad.

1. **The other plane's etap columns are removed, not blanked.** A first pass rendered them as
   „nie dotyczy" cells — rejected: it built a wall of dead cells across every row, and the qty columns
   still read as if they counted. A crew's bill does not list the other crew's etapy at all. Nothing
   becomes uneditable, because quantities are entered in the Klient view, which shows every etap.
2. **An unassigned etap (no tryb picked) belongs to NO plane.** Not defaulted to „z narzędziami". It
   appears in neither subcontractor view and counts toward neither settlement figure. Known cost: while
   any etap is unassigned the two crews' bills no longer sum to the executed work — the unconfirmed-plane
   warning is the only thing that says so. Accepted deliberately: a missing amount with a warning beats
   an amount charged to a crew nobody picked.

### Open questions raised at review (not yet decided)

- **„Podsumowanie podwykonawców" no longer carries a distinct number.** Once the grid is plane-filtered,
  „Razem netto" in a subcontractor view equals that plane's figure in the panel exactly — rabat was
  already client-only in pricing, so there is not even a pre/post-rabat delta. The panel's remaining job
  is showing BOTH crews at once plus the unconfirmed warning. Decide whether it keeps rendering amounts
  or collapses to a comparison + warning.
- **„Razem netto" means two different things by view** — post-rabat in Klient (what the client pays),
  pre-rabat in a subcontractor view (what the crew is owed). Both correct locally, one label. Decide
  whether the header disambiguates or whether the question simply doesn't arise on a crew's bill.
- **Global discount leaks into the subcontractor plane.** `globalDiscountAmount` is computed on the
  view-aware total, so standing in a subcontractor view applies a client concession to that crew's
  amount, and `laborCostsNetFromKosztorys` drifts with whichever view is on screen. Same class of bug
  one level up. Decide whether it is in scope here or its own change.
