---
change_id: ex-560-reload-from-preset
title: Reload a kosztorys from a preset onto a non-empty investment, reversibly
status: archived
created: 2026-08-12
updated: 2026-08-12
archived_at: 2026-08-12T11:08:59Z
branch: konradantonik/ex-560-przeladuj-z-szablonu
worktree: null
---

## Notes

„Przeładuj z szablonu" na niepustą inwestycję: snapshot przed wipem, atomowo, odwracalne przez
istniejące przywracanie. Port ścieżki importu z arkusza (`applyKosztorysImport`) na `applyPreset`.

Owner ruling (2026-08-12, EX-560): the preset stays a **separate fast path** next to the sheet
import — the case is a fresh investment where a little was entered by hand and the owner wants to
start over without setting up a sheet. Fully reversible via the forced pre-wipe snapshot, so no
objection to allowing it.

Rejected during planning: **carrying przedmiar / etapy / postęp across the swap** by matching prace on
sekcja + opis. The owner cut it — the feature exists to swap the szablon _at the start_ of an
investment, and loading a szablon onto a kosztorys with real recorded work has no business meaning, so
protecting that case is complexity for nothing. Dropping it removed a whole phase. Related: no
"effectively empty" gate (a reversible wipe makes stub-vs-real a distinction that buys nothing), no
escalated confirmation, and `seedInvestmentFromPreset`'s `'not-empty'` guard stays refusing — that is
the investment-creation path, not this one.

Owner rulings at the review gate (2026-08-12):

- **The rabat globalny is cleared by a reload.** It is not captured in the snapshot payload, so left
  alone it survived against a zeroed przedmiar and rendered „do zapłaty" negative. Consequence the
  dialog states explicitly: restoring the pre-reload point does **not** bring the rabat back.
- **The restore point is named after the szablon** („Przed wczytaniem: «nazwa»"), so repeated swaps
  stay distinguishable. Deliberately left uncapped — a manual row surviving the sweep is the feature.

Rejected in the same ruling: treating an "effectively empty" tree (stub rows, no progress) as empty.
With a reversible wipe, distinguishing a stub from a real rozpiska buys nothing — one path covers both.

The `'not-empty'` guard in `seedInvestmentFromPreset` stays as-is; that is the investment-creation
path, not this one.

Owner rulings 2026-08-12 (round 2): only the rozpiska is wiped — VAT, coefficients and the global
discount survive; no escalated warning on the confirm dialog, because the whole move is reversible.

Round 3 — **the merge design was dropped.** Intermediate drafts tried to carry przedmiar (and then
etapy + postęp) across the swap by matching prace. The owner called a step back: the feature exists
to swap the szablon **at the start** of an investment, and reloading a szablon onto a kosztorys with
real work recorded against it makes no business sense in the first place, so protecting that case is
complexity for nothing. Plain replacement: everything except the investment's settings goes. This
removed an entire phase (the shared praca-identity extraction) from the plan.

Plan: `plan.md` (three phases), condensed in `plan-brief.md`.
