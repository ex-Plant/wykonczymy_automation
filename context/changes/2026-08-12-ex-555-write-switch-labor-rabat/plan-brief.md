# EX-555 — Robocizna + rabat from the kosztorys — Plan Brief

> Full plan: `context/changes/2026-08-12-ex-555-write-switch-labor-rabat/plan.md`
> Research: `context/changes/2026-08-12-ex-555-write-switch-labor-rabat/research.md`
> Owner rulings 1–12: `context/changes/2026-08-12-ex-555-write-switch-labor-rabat/change.md`

## What & Why

The same investment shows one bilans on `/inwestycje` and another in its own Podsumowanie, because
the listing derives robocizna and rabat from transactions while v2 derives them from the kosztorys.
This puts the listing — and v2's own Marża tab, which was never switched — on the kosztorys, and stops
the transfer form offering `LABOR_COST` and `RABAT` so nobody can keep feeding the plane we stopped
reading. Existing rows stay as legacy in full.

## Starting Point

The listing is one transactions `GROUP BY` end to end and never touches the kosztorys. The v2 panel
already owns the read-switch but keeps it inline in its own JSX, and its Marża tab reaches past the
switch straight into `financials`. The listing's cached read carries no kosztorys tag at all, so even
after the switch a `qtyDone` edit would not invalidate it. The write-switch itself is two array
entries with a single consumer.

## Desired End State

`/inwestycje` and v2 agree on bilans and marża; v1 legitimately disagrees and stays legacy. No new
`LABOR_COST` or `RABAT` is bookable, while every existing row still renders, filters, edits, cancels
and syncs to the sheet. The reconciliation alert still fires on old investments carrying both planes
and goes quiet on an investment that has neither figure booked. A kosztorys edit invalidates the
listing.

## Key Decisions Made

| Decision                 | Choice                                                                      | Why                                                                                                                               | Source   |
| ------------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Both types together      | One change                                                                  | `clientTotalsFromSubtotals` returns both figures from one pass; rabat alone leaves a two-plane hybrid                             | Owner    |
| Existing rows            | Legacy, untouched                                                           | No backfill; enum, sheet sync and cancellation all keep working                                                                   | Owner    |
| Where the seam sits      | `shapeInvestments`, not `deriveFinancials`                                  | Seam A makes the reconciliation compare a number with itself and five specs go green on `x === x`                                 | Research |
| How the figures are read | SQL aggregate (B), not batched rows (D), not materialized columns (C)      | C has an anti-precedent and no chokepoint; D ships 49 MB at 1 000 investments to produce 2 000 numbers                            | Measured |
| Fallback                 | No kosztorys rows → transactions                                            | Same rule the panel already uses; 84 of 96 investments have no kosztorys                                                          | Owner    |
| v1                       | Stays on transactions                                                       | Legacy, kept for side-by-side comparison                                                                                          | Owner    |
| v2 Marża tab             | Switched too                                                                | It was reading `financials` directly, one layer below the switch                                                                  | Owner    |
| `balanceGross` VAT base  | Moves to the kosztorys pair                                                 | Netto and brutto must be grossed by the pair the netto was built from                                                             | Plan     |
| Reconciliation           | Kept, silenced per investment when Σ `LABOR_COST` = 0 **and** Σ `RABAT` = 0 | Its job is verifying old investments before v1 retires; per-figure silencing would mute the "robocizna booked, rabat missing" gap | Owner    |
| Write-switch gates       | Payload admin + `z.enum` accepted; sessionStorage draft fixed               | Only the draft reaches an ordinary user (EX-557 precedent)                                                                        | Owner    |
| Wpłaty sets              | No change                                                                   | Verified on prod: the two definitions are identical on live data                                                                  | Owner    |

## Scope

**In scope:** kosztorys totals aggregated in SQL + its cache tags + the SQL↔TS parity guard · extraction of the has-rows rule ·
listing read-switch incl. `balanceGross` · v2 Marża tab · two array entries + the draft coercion ·
per-investment reconciliation silencing · the tests that would otherwise pass blind · three docs.

**Out of scope:** existing `LABOR_COST`/`RABAT` rows · the type union, spec table, labels or sheet
lists · v1 · materialized columns · Payload-admin and `z.enum` hardening · the wpłaty filter ·
owner-side data fixes (ten uncategorised corrections, mis-typed rabat rows).

## Architecture / Approach

One aggregate SQL read returns the client-view pair per investment — one row each, not one row per
kosztorys item. The formula collapses to `SUM` plus a three-branch `CASE` (no filtering, no rounding on
the path to these two figures), so Postgres folds the rows and the app never receives them. The TS
formula stays the reference implementation and a DB-backed parity spec pins the SQL copy against it.
The has-rows rule moves into `summary-reading.ts` so listing and panel
read one rule instead of two copies. `shapeInvestments` takes the totals map as plain data and applies
the switch per row, keeping the module free of `server-only` so the parity audit can still call the
real row builder.

## Phases at a Glance

| Phase                       | What it delivers                                                  | Key risk                                                                                             |
| --------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1. SQL-aggregated totals    | One row per investment, cached read with kosztorys tags          | The formula now exists twice (SQL + TS) — pinned by a DB-backed parity spec                          |
| 2. Shared switch rule       | Has-rows rule extracted out of the panel                          | The reconciliation feed must stay bound to `financials`                                              |
| 3. Listing read-switch      | The figures actually change on `/inwestycje`                      | `balanceGross`'s VAT base moves; the parity audit's invariant becomes conditional                    |
| 4. v2 Marża tab             | v2 internally consistent                                          | The `canSeeMargin` payload gate must survive the rewiring                                            |
| 5. Write-switch             | Both types gone from the form; draft coercion                     | Must **not** copy EX-557's `INVESTMENT_TYPES` removal — it would null `investment` on 89 legacy rows |
| 6. Reconciliation silencing | Alert stays useful, stops false-alarming                          | Silencing is per investment, never per figure                                                        |
| 7. Blind spots              | Fingerprint, renamed specs, staleness E2E, docs                   | The suite is green-by-blindness until this lands                                                     |

**Prerequisites:** EX-557 first (same file, and it establishes a pattern this change must not copy).
`pnpm db:import` before implementation — the local DB is behind the dump.
**Estimated effort:** several sessions; Phases 1 and 7 carry the weight.

## Open Risks & Assumptions

- **Every debounced autosave in the editor expires the whole listing aggregate.** Accepted cost of
  correct invalidation; the next visit to `/inwestycje` pays a full recompute.
- **The formula exists in two languages.** The SQL aggregate is a copy of the TS client-view path;
  a divergence would be the classic "two planes, both green". The parity spec is the only thing
  standing against it — it must cover every discount branch, not the happy path.
- **The test dataset has zero kosztorys rows**, so every guard in this change is only as good as
  Phase 7's floor. Until that lands, green means nothing here.
- **An old investment with no bookings is indistinguishable from a new one** under the silencing rule.
  Mitigated by a one-off manual review of the 7 kosztorys-bearing investments.
- Marża and bilans start reacting to the kosztorys rabat — the kosztorys↔marża link deferred since
  2026-07-16, made deliberately here.

## Success Criteria (Summary)

- On a kosztorys-bearing investment, `/inwestycje` bilans netto = −v2 „Do zapłaty", and the listing's
  Marża = v2's Marża.
- An investment with no kosztorys shows figures byte-identical to before.
- Neither type is offered in the transfer dialog; a legacy row still edits, cancels and syncs.
- A `qtyDone` edit changes the listing without a manual refresh.
- `pnpm test:parity` fails on an empty kosztorys dataset instead of passing green.
