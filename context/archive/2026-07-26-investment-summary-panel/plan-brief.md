# Investment Summary Panel — Plan Brief

> Full plan: `context/changes/2026-07-26-investment-summary-panel/plan.md`

## What & Why

Swap the investment detail page's eight toggleable financial tiles for the kosztorys Podsumowanie
panel. Both already show the same client-facing figures; the panel shows them better — a settlement
table with a waterfall and the „Struktura kosztów" pie instead of a row of buttons. The company-plane
figures (Marża / Wypłaty / Strata / Rozliczone R+M) move to a separate owner-only strip above it, so
a gating mistake inside the panel can never leak marża into a client-facing view.

## Starting Point

The page renders `InvestmentStatsVersions` behind `<Suspense>`, which awaits the kosztorys tree,
computes `kosztorysClientTotals`, and pairs a transactions reading with a kosztorys reading through
`StatsVersionToggle`. The panel it will render instead already exists and runs on two other routes —
the editor and the public client share link. This is a **reuse-and-strip** change, not a build: almost
every block, table, pie and money helper is already written.

## Desired End State

Below the info list: an owner-only `StatButton` strip, then the panel in a `CollapsibleSection` with
three views — Podsumowanie (settlement + pie), Wydatki (per-category breakdown, no transaction list),
Wpłaty (three Razem buckets, no per-deposit list). The v1/v2 reading toggle sits in the panel's top
bar. The transfers table below is unchanged, the editor and share route render exactly as today, and
`/raporty` keeps its tiles.

## Key Decisions Made

| Decision             | Choice                                  | Why                                                                                                                                        |
| -------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Serving two hosts    | Split shell from content                | The overlay contract is one className; splitting keeps a single source of truth for every view and leaves the public share route untouched |
| VAT / rabat globalny | Omit from this page                     | `SummarySettingsBar` is the only editor-context consumer in scope; no second mutation surface                                              |
| Views in scope       | Podsumowanie + Wydatki + Wpłaty         | Robocizna and Podwykonawcy stay editor-only; the mnożnik ceny control does not come along                                                  |
| Transaction lists    | Stripped from Wydatki and Wpłaty        | The transfers table directly below already lists every transaction                                                                         |
| „Nie określono"      | Display-only, already exists            | `deposits-table.tsx:53-57` builds all three buckets; `bucketDepositsByPlane` still folds unmarked into netto per the 2026-07-23 ruling     |
| Panel `localStorage` | Shared across surfaces                  | The owner's view/pricing pick following them between page and editor is the intended behaviour                                             |
| Owner figures        | Reuse `StatButton`, no deselect         | The deselect only ever fed the print header, which is not being carried over                                                               |
| Loading / empty      | Reuse the existing v1 fallback pattern  | No skeleton primitive exists in the repo; no kosztorys rows ⇒ transaction reading, no toggle                                               |
| Sequencing           | Depends on `investment-settlement-mode` | It puts the netto/brutto axis on the investment and deletes the shared `localStorage` axis key                                             |

## Scope

**In scope:** shell/content split with a `views` allowlist; opt-in `SummarySettingsBar`; `totalsOnly`
deposits and list-free Wydatki; one new query (`fetchDepositTransactionsForInvestment`); the panel host
on the investment page; the reading toggle moved into the top bar; the owner strip; tiles off this page.

**Out of scope:** Robocizna and Podwykonawcy views; mnożnik ceny; VAT/rabat editing here; any change to
the settlement math; `localStorage` namespacing; the dynamic print bilans; PDF generation; E2E.

## Architecture / Approach

`KosztorysTotalsPanel` keeps only the `Collapsible` overlay and delegates to a new portable
`SummaryPanelContent` (top bar + tab dispatch + derivations). A `views` allowlist and the existing
`clientView` flag decide what renders, generalizing the persisted-view fallback the panel already has.
The investment page derives every panel input from data it already fetches, except the deposit rows.
A thin client wrapper holds the v1/v2 state and feeds the panel one of two robocizna/rabat pairs —
the same two figures `financialsFromKosztorys` swaps.

## Phases at a Glance

| Phase                         | What it delivers                           | Key risk                                                  |
| ----------------------------- | ------------------------------------------ | --------------------------------------------------------- |
| 1. Split shell/content        | Portable panel content + `views` allowlist | Regressing the public `/k/<token>` share route            |
| 2. Strip the tabs             | List-free Wydatki, totals-only Wpłaty      | Flag defaults silently changing the editor                |
| 3. Mount on the page          | Panel live on `/inwestycje/[id]`           | Figures drifting from the editor's on the same investment |
| 4. Reading toggle inside      | v1/v2 in the panel top bar                 | Substituting more than robocizna + rabat                  |
| 5. Owner strip + retire tiles | Owner figures split out, tiles gone        | Breaking `/raporty`, which shares the component           |

**Prerequisites:** `2026-07-26-investment-settlement-mode` merged to `staging`.
**Estimated effort:** ~2 sessions across 5 phases; most of it is moves and prop threading.

## Open Risks & Assumptions

- The prerequisite branch is unmerged and in a sibling worktree; Phase 3 is blocked until it lands.
- Sharing `localStorage` means switching views on one surface changes the other — accepted, but it is
  the first thing to revisit if it reads as a bug.
- The reconciliation scream needs `priceView="client"` on a host with no grid; miss it and the scream
  silently never fires.
- Deleting `stats-version-toggle.tsx` and possibly `kosztorys-driven-financials.ts` is gated on
  typecheck, not grep.

## Success Criteria (Summary)

- Every Podsumowanie figure on `/inwestycje/<id>` matches the editor's for the same investment and mode.
- The v1/v2 toggle moves only Robocizna and Rabat.
- A MANAGER never sees Marża or Wypłaty; `/k/<token>` and `/raporty` are unchanged.
