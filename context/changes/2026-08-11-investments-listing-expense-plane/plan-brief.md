# Wydatki w liście inwestycji na płaszczyźnie rozliczenia materiałów — Plan Brief

> Full plan: `context/changes/2026-08-11-investments-listing-expense-plane/plan.md`
> Decisions: `context/changes/2026-08-11-investments-listing-expense-plane/change.md`
> Research: `context/changes/2026-08-11-investments-listing-expense-plane/research.md`

## What & Why

The investments listing sums raw `categoryCosts` — amounts exactly as recorded — so it adds brutto
receipts to amounts entered netto and drops the uncategorised correction. Investment 31 reads
191 080,57 zł on the listing and 152 648,46 zł netto in its own summary panel. The panel is right.

## Starting Point

The correct arithmetic already exists in one module (`summary-economics.ts`) and reconciles to the
grosz. Two things stop the listing from using it: `netCategoryCosts` — the map saying which part of a
category is already netto — is produced by `deriveCategoryBreakdowns` and then thrown away at
`sum-transfers.ts:230`; and the GROSS-mode gate lives as an inline expression inside a panel
component, so every new surface has to reproduce it from memory.

## Desired End State

Every money column on `/inwestycje` stands on the plane the investor is actually billed on, per row,
matching that investment's summary panel to the grosz. A „Korekta" column makes the category columns
sum to the total. Three new columns: „Wydatki wliczone w robociznę", „Bilans netto" (relabel),
„Bilans brutto".

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Mode marking on the listing | None | After the fix every column is on the billed plane, so each row is correct in GROSS too | Change |
| Role gate on new columns | None | MANAGER sees Korekta and Wydatki wliczone w robociznę | Change |
| Two balance columns | Fixed pair, not mode-switched | In MIXED both stand at once — the rule `settlementModeToGridAxis` already applies | Change |
| Carrying the netto part | `netCategoryCosts` onto `InvestmentFinancialsT` | `categoryCosts` alone is underspecified; no consumer should get it without the plane | Plan |
| GROSS gate | Extracted to `effectiveMaterialsNetRate` | The inline copy in the panel is why the listing lacks the gate at all | Plan |
| Test coverage | Synthetic unit tests, no test-DB fixture | Independent of the prod restore that zeroes this plane on every `db:import:test` | Plan |
| Column visibility | All three always visible | A fixed column set over a data-dependent one | Plan |
| Audit script | Repaired, listing side via `shapeInvestments` | `lessons.md:19` — parity must run the real assembly | Plan |

## Scope

**In scope:** the listing's category columns + „Wydatki inwestycyjne"; a „Korekta" column; „Wydatki
wliczone w robociznę"; „Bilans netto" relabel + „Bilans brutto" (needs `vatRate` on `InvestmentRefT`);
repair of the parity test and the audit script.

**Out of scope:** stats v1 tiles on the investment page and the transfers export header (a different
defect — repricing there would double-count the concession); `/raporty`; the Sheets mirror; a netto
fixture in the test DB; any listing export.

## Architecture / Approach

`deriveCategoryBreakdowns` → (new) `netCategoryCosts` on `InvestmentFinancialsT` → `shapeInvestments`
prices each category through `billedMaterials` at the effective rate → the table renders billed
figures. Every plane crossing goes through the panel's own function, so „Σ kolumn === total" holds by
construction rather than by agreement between two formulas.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Bramka i kabel | Gate extracted, `netCategoryCosts` carried, remainder exported | Type fanout: `derive-financials-bucketing.test.ts` needs two edits in step, and `summary-reading.test.ts:13` uses `as` so `tsc` stays silent |
| 2. Naprawa figury | Listing on the billed plane + „Korekta" column | The netto part is a subset — feeding the raw category total as `grossBase` divides it twice |
| 3. Nowe kolumny | `totalSettled`, „Bilans netto"/„Bilans brutto", `vatRate` plumbed | `vat_rate` is nullable — needs the `DEFAULT_VAT` fallback or the column reads NaN |
| 4. Detektory | Parity test gets rate+mode; audit script calls the real assembly | Neither adds coverage on its own — they restore detectability |

**Prerequisites:** local dev DB holding investment 31 (rate 0,25, mode NET) for the manual pass; the
db-test container for the integration gate.
**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- **The netto plane stays invisible to every real-data guard.** The test DB has 0/109 investments with
  a rate and 0 netto expense rows, and no fixture is being created. The repaired parity test is
  correct but unexercised on this axis; the only real-data check is the audit script, run by hand
  against the dev DB.
- The audit script is still not wired into any gate — a next drift is detectable, not detected.
- „Bilans brutto" assumes VAT rides the prace alone (`totalLaborCosts`), consistent with
  `summary-economics.ts`. If the owner ever expects VAT on materiały, this column is wrong.

## Success Criteria (Summary)

- Investment 31's listing row reads 105 712,10 · 47 156,35 · 20,00 · −240,00 · 152 648,46 ·
  1 004 421,85 and matches its Podsumowanie to the grosz
- The category columns plus „Korekta" add up to „Wydatki inwestycyjne" on every row
- An investment with no materials rate is unchanged from before
