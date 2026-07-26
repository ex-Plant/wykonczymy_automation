---
change_id: investment-summary-panel
title: Replace the investment page's stat tiles with the kosztorys Podsumowanie panel
status: implemented
created: 2026-07-26
updated: 2026-07-26
archived_at: null
branch: investment-summary-panel
worktree: null
---

## Notes

Replace the investment detail page's financial stat tiles (`FinancialStats` / `ToggleStatButtons`)
with the kosztorys Podsumowanie panel — the Podsumowanie + Wydatki tabs only. The tiles and the panel
already show the same client-facing figures; the panel shows them better (a settlement table with a
waterfall + the „Struktura kosztów" pie, instead of eight toggleable buttons).

Owner's calls so far (2026-07-26):

- **v2 (kosztorys) is the default reading, and the v1/v2 toggle STAYS** until the owner explicitly
  calls the experiments over. It moves INSIDE the panel: only Robocizna and Rabat differ between the
  two readings (Materiały and Wpłaty come from transactions on both), and the panel already receives
  both figures — it computes the reconciliation scream from them. The substitution itself already
  exists as `financialsFromKosztorys`. Side effect: an investment with no kosztorys rows falls back
  to the v1 reading instead of showing an all-zero panel.
- **Marża / Wypłaty / Strata / Rozliczone R+M** go to an owner-only strip ABOVE the panel, not into
  the Podsumowanie table. They are a different plane (company profitability, not the client
  settlement), and Podsumowanie shares components with the client share view — putting them inside is
  one gating mistake away from leaking marża to a client.
- **Tabs:** Podsumowanie + Wydatki only, and the materiały transaction list comes out of Wydatki —
  the transfers table directly below the panel already lists every transaction.

### Known entanglements

- **The tiles feed the print header.** `print-button.tsx` filters `headerFields` by the tile
  visibility store and derives its bilans from it, so removing the tiles kills the dynamic
  „odznacz kafelek → wypada z bilansu i z wydruku" behaviour. Owner: the browser print is being
  phased out in favour of a PDF anyway, and the dynamic bilans is NOT a requirement to carry over.
  No PDF generation exists in the repo yet — that is separate, later work.
- **The panel's netto/brutto axis is per-browser `localStorage`** today. Mounting the panel on a
  second page duplicates that problem; `2026-07-26-investment-settlement-mode` moves the axis onto
  the investment and should land first.
- **The panel is a bottom-anchored `Collapsible` overlay** glued to the editor grid
  (`absolute inset-x-0 bottom-0`, `h-0` → `h-full`). The tabs and blocks inside are portable; the
  shell is not — the content has to come out of `KosztorysTotalsPanel`.
