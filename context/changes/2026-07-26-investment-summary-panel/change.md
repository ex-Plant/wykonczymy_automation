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

## Correction (2026-07-26, after phase 5)

The plan built one panel with the v1/v2 toggle swapping two figures inside it, and retired the tiles
from the page outright. **Wrong reading of the owner's intent.** The axis is a _temporary comparison
affordance_: the point is to look at the old page and the new one and check the totals agree, so v1
must be the page **exactly as it was** — same queries, same computations, same layout — and only v2 is
new work.

Restructured in `36204b17`:

- The reading is a **search param**, `?widok=v1|v2` (default `v2`, `src/lib/constants/stats-version.ts`).
  Client state can't do this: v1 has to skip v2's server fetches, which only a server render can. It
  also makes each reading a link, so both can sit open in adjacent tabs.
- `?widok=v1` renders `FinancialStats` and nothing else, off the original three-query `Promise.all`.
- `?widok=v2` renders the owner strip + the panel; `InvestmentSummaryPanel` owns **every** v2 fetch
  and derivation (kosztorys tree, deposits, materiały breakdown, `vatRate`, settlement mode).
- Reverted the two extra columns added to `fetchReferenceData` / `InvestmentRefT` — that query is
  shared, so v1 was paying for them.

Delete the whole axis (param, toggle, `FinancialStats` on this page) once the owner calls the
comparison over.

### UI follow-ups (2026-07-26, owner, `f679d50c`)

Three calls that supersede the "Owner's calls so far" bullets above:

- **No pies on the investment page.** `SummaryPanelContent` gained `showPies` (default `true`); the
  investment host passes `false`, so Podsumowanie / Wydatki / Wpłaty render without „Struktura
  kosztów", „Struktura wydatków inwestycyjnych" and „Udział wpłat netto / brutto". The editor and the
  client share view (`/k/<token>`) keep theirs — the flag is per host, not a global removal.
- **No collapsible.** The panel is no longer wrapped in `CollapsibleSection`, so there is no
  „Podsumowanie" trigger to click — it renders open. Consequence: a long Wpłaty list makes the page
  taller instead of scrolling inside a bounded region (`SummaryScrollRegion` only clips inside a
  height-bounded flex column).
- **Owner strip moved BELOW the panel**, contradicting the "ABOVE the panel" bullet in Notes. It is
  still a separate gated component (`InvestmentOwnerFigures`) for the same leak reason — only its
  position changed.

Also: the tabs are Podsumowanie + **Wydatki + Wpłaty** (`INVESTMENT_PANEL_VIEWS`), not the two the
Notes bullet names.
