# Marża: forecast beside actual, both from the kosztorys — Plan Brief

> Full plan: `context/changes/2026-08-18-marza-prognoza-rzeczywista/plan.md`
> Decisions & rationale: `context/changes/2026-08-18-marza-prognoza-rzeczywista/change.md`
> Research: `context/changes/2026-08-18-marza-prognoza-rzeczywista/research.md`

## What & Why

The app has one margin, and it prices the crew by what has already been paid out (`Σ PAYOUT`) — so an
investment where nobody has been paid yet reads as pure profit, and one where the crew was overpaid
reads as a loss the kosztorys never predicted. EX-649 replaces the crew term with what the kosztorys
says the crew is owed, and adds a second reading beside it: a **forecast** from the przedmiar, priced
at one of the two subcontractor scenarios. Owner requirement, stated twice and load-bearing for the
whole plan: **the old margin stays live and unchanged** — he wants to see how it was computed next to
how it will be.

## Starting Point

`calculateMargin` is six terms over one financials object, with four call sites (listing, v1 detail
block, `/raporty`, and the Marża tab). The Marża tab is fully wired but hidden behind a single
`TODO(EX-649)` line. `subcontractorDueByPlane` already computes the needed figure — client-side only,
one call site, and it already skips plane-less etapy while raising a qty-gated flag. Nothing anywhere
prices the przedmiar at a subcontractor plane, and the one per-row helper that comes close applies the
rabat by construction. The listing's kosztorys figures come from a one-row-per-investment SQL fold
whose header comment records why (49 MB of rows at 1000 investments) and pins TS as the reference
implementation.

## Desired End State

The investments listing carries **two** owner-only margin columns — `Marża` untouched, `Marża v2`
beside it. The kosztorys summary panel's `Marża` tab is visible again, with a toggle between
**Prognoza** and **Marża rzeczywista**, a second toggle for the scenario under the forecast only
(default z narzędziami), and a short description under each figure saying exactly how it is computed.
Where an etap holds executed work with no settlement plane, the actual margin is withheld — both in
the panel and on the listing — in favour of a call to set the etapy.

## Key Decisions Made

| Decision                  | Choice                                                | Why                                                                                                       | Source |
| ------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------ |
| Old formula               | Untouched; the new one is added beside it             | Owner wants both readings visible; as a side effect every existing spec keeps its subject                 | Owner  |
| Rabat in the forecast     | Absent — przedmiar at full price                      | A rabat is not granted up front                                                                           | Owner  |
| Manual-rate signalling    | None                                                  | The override is per-plane, so the scenario already distinguishes them; measured 3/1751 rows with only one | Plan   |
| Listing                   | Second column `Marża v2`; forecast not on the listing | The forecast is read at one investment, not compared in a table                                           | Owner  |
| Plane-less etap with work | Withhold the amount, show „ustaw etapy"               | Zero would assert the work was free; a default would guess what the owner must click anyway               | Owner  |
| „Obniżka materiałów"      | Out of the new margin, unchanged in the bilans        | Margin is about robocizna; material enters only when billed inside it                                     | Owner  |
| Wypłaty                   | Stay in `Podwykonawcy`, not on the Marża tab          | The margin answers "what is owed", the reconciliation "what was paid"                                     | Owner  |

## Scope

**In scope:** two pure formulas (`marginForecast`, `marginV2`) plus a pre-rabat przedmiar primitive; the
un-hidden Marża tab with both toggles, both descriptions and the withheld state; a second SQL fold for
subcontractor-due with its cache entry and a SQL↔TS parity spec; the `Marża v2` listing column and a
second parity row computing the right side from the tree; the subcontractor axis added to the
golden-master input signature; the living-doc updates.

**Out of scope:** any change to `calculateMargin`, the v1 detail block, `/raporty`, the `Wypłaty` column
or the `Obniżka materiałów` tile; the forecast on the listing or on the investment page; needed-vs-paid
reconciliation inside the Marża tab; exposing either figure on the client share; migrations; E2E.

## Architecture / Approach

Bottom-up. The two formulas land first as React-free modules with their specs, so every later phase
composes tested arithmetic. The editor gets them next, where the whole tree is already in memory. Only
then is the actual margin's new term re-expressed in Postgres and pinned against the TS — the same
"TS is the reference, SQL is the copy" arrangement the client-totals fold already documents. The
listing column comes after that, and the last phase repairs the golden master's blind spot and the
prose.

## Phases at a Glance

| Phase                | What it delivers                                            | Key risk                                                                        |
| -------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1. Formulas          | `marginForecast`, `marginV2`, pre-rabat przedmiar primitive | Reusing the discounting helper and inflating the forecast by exactly the rabat  |
| 2. „Marża" tab       | Tab visible, both toggles, descriptions, withheld state     | Persisting the scenario in the `kosztorys-*` family the disclosure lock governs |
| 3. Listing fold      | Subcontractor-due in SQL, cached, pinned by a parity spec   | SQL and TS drifting on the plane-less-with-work gate                            |
| 4. „Marża v2" column | Second column, plus a non-tautological parity row           | Writing a parity row that calls the same function on both sides                 |
| 5. Guards & docs     | Golden-master input signature, living docs                  | Reading "material discount removed" as "reclaimed VAT booked as profit"         |

**Prerequisites:** none — no migration, no new credential, no upstream slice.
**Estimated effort:** ~2–3 sessions across 5 phases.

## Open Risks & Assumptions

- Measured on the local DB: 40 of 50 etapy have no settlement plane, and only one investment has them
  all set. `Marża v2` will therefore be withheld nearly everywhere on day one. That is the intent — the
  column lights up as the data is filled in — but it means the new column looks broken until it isn't.
- The forecast excludes the rabat while the actual margin subtracts it, so the two figures are not on
  the same basis and the difference between them is not "work not yet done". The descriptions in the
  tab are the only place this is explained; they are load-bearing.
- Whether the forecast should also drop out of the investment page's summary panel (no rows there) is
  settled in the plan as "yes", but it means the same tab renders one figure on one host and two on
  the other.
- The golden master must be taught the subcontractor axis in the same change, or a routine kosztorys
  edit starts reporting as code drift on every pre-push run.

## Success Criteria (Summary)

- `Marża` and `Marża v2` sit side by side on the listing and legitimately differ; `Marża` is
  byte-for-byte the figure it is today.
- `Marża v2` on the listing equals `Marża rzeczywista` in the panel for the same investment, proven by
  two independently computed sides.
- The Marża tab is absent for MANAGER and on the client share, and cannot be summoned by editing
  localStorage.
- `pnpm test:parity` passes after the golden master is regenerated.
