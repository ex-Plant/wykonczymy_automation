---
change_id: sheet-measured-qty-from-formula
title: Import Pomiar z natury when the cell holds a formula that is not the stage sum
status: implemented
created: 2026-08-20
updated: 2026-08-20
archived_at: null
branch: kosztorys-client-view-offer-settlement-variants
worktree: null
---

## Notes

The sheet import drops „Pomiar z natury" whenever the cell holds a formula. The rule was written for
the blank offer sheet, where that cell is `=SUM(<stage columns>)` and the pomiar is the stage sum by
construction — comparing it against the stages could never fire.

A live scan of all 56 linked sheets says that formula is nearly extinct: 2 rows across the whole
base. What the owners actually type is `=N{row}` / `=J{row}` — pomiar mirrors Przedmiar — in
267–448 rows per sheet, and all of them are discarded today. The owner's ruling: a cell they filled
IS a pomiar whatever produced the number, so etapy summing to zero against it is a real rozjazd.

New rule: skip the cell only when its formula REFERENCES a stage-quantity column (any shape —
`=SUM(D5:M5)`, `=D5+E5`). Every other formula contributes its value.

Effect measured on live sheets: ~750 pozycje across 20 investments surface in the
„z pomiarem do rozpisania na etapy" worklist; 9 investments stay clean. 480 of the 524 counted are
rows with NOTHING in the stages — whole pozycja never transcribed. Rows where pomiar is 0 and the
stages are not: 3 in the entire base, so a „pomiar ≠ 0" filter would change nothing.

No money figure moves — `sheetMeasuredQty` feeds only this diagnostic and the „Rozjazd między
arkuszem Google a apką" column. Backfill needs no re-import: the existing „Zaciągnij pomiary
z arkusza" action writes the column alone.

Separate finding, NOT in scope here: 23 of 56 sheets fail `resolveLaborColumns` outright — 12 on the
missing section column, 10 on „Wartość netto", 1 on „Przedmiar".
