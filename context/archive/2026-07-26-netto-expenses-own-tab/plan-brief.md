# Netto expenses get their own tab — Plan Brief

> Full plan: `context/changes/2026-07-26-netto-expenses-own-tab/plan.md`

## What & Why

Dogfooding EX-567 showed that a netto expense disappears into the brutto list, marked only by a grey
sub-line, and that clicking it lands on a transfers list that filters it out. Both come from one gap:
the transactions row never carries its transfer type. Put the type on the row and the list can split
into three tabs _and_ build an honest link.

## Starting Point

The „Wydatki" transactions list has a two-way toggle — „Wydatki inwestycyjne" (unsettled) vs
„Materiały wliczone w robociznę" (settled). Netto rows ride in the first, distinguished only by
`billed !== amount`. Every row's href hardcodes `type=INVESTMENT_EXPENSE`. The toggle only appears at
all when a _settled_ row exists. `DataTable` has no footer.

## Desired End State

A tab per non-empty dataset — brutto (with korekty), netto, settled — each with a „Razem" footer, so
the two expense totals still add to the breakdown's „Razem" above. Netto tab leads with the netto
figure. Every row shows a chevron and links filtered by its own type. `clientView` gets tabs and
totals but no links and no chevron.

## Key Decisions Made

| Decision          | Choice                                  | Why                                                                                                                   | Source                  |
| ----------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Tab semantics     | Three **mutually exclusive** sets       | A row under two tabs makes every Σ ambiguous                                                                          | Owner ruling 2026-07-26 |
| Korekty placement | Stay in „Wydatki inwestycyjne"          | The Sheet itself labels them `'Korekta → wydatki inwest.'` (`transfers.ts:315`); they count into `totalMaterialCosts` | Research                |
| Netto tab amount  | Netto leads, brutto beneath             | The leading number should be the one the tab totals                                                                   | Owner                   |
| Reconciliation    | Per-tab „Razem" footer                  | The split breaks the on-screen list↔breakdown check; the footer restores it                                           | Owner                   |
| Empty datasets    | Only non-empty tabs render              | Also fixes the `hasSettled` gate that hid the toggle wholesale                                                        | Owner                   |
| Affordance        | Trailing chevron, not hover             | Hover + cursor-pointer already shipped (`data-table-row.tsx:58`) and is exactly what was judged unobvious             | Research + owner        |
| Guard             | Unit test on a pure partition helper    | Pins `Σ(brutto) + Σ(netto) === totalMaterialCosts` where it can break, immune to UI churn                             | Owner                   |
| B5                | Left unchanged; new sibling guard added | B5 keys on `settled`, not on tabs, so it stays green                                                                  | Research                |

## Scope

**In:** `MaterialTransactionRowT.type`, the query mapper, the partition helper + its guard, the
three-tab UI with per-tab totals, `DataTable` footer support, type-derived hrefs, the chevron column.

**Out:** netto splitting in `buildFinancialFields` (investment-page stat buttons — a real but separate
gap), the breakdown/pie above the list (already splits netto), any money derivation, any schema
change.

## Phases

1. **Type on the row + the reconciliation guard** — one field, one line, one pure helper, one test.
2. **Three tabs + per-tab „Razem"** — carries the only shared-component change (`DataTable` footer).
3. **Honest row links + a visible affordance** — href from `row.type`, chevron suppressed in
   `clientView`.
