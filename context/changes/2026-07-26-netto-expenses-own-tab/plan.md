# Netto expenses get their own tab — Implementation Plan

## Overview

Split the kosztorys v2 Podsumowanie → „Wydatki" transactions list into **three mutually exclusive
dataset tabs** — brutto investment expenses (with korekty), netto investment expenses, and materials
settled into robocizna — and make every row's link land on a list that actually contains that row.

Both problems came out of dogfooding EX-567 and share one root cause: `MaterialTransactionRowT` never
carries the transfer type, so the tab filter has nothing to partition on and the row href has to
guess. Fixing the type on the row unblocks both.

## Current State Analysis

- **The row type is available and discarded.** `fetchMaterialTransactionsForInvestment`
  (`src/lib/queries/reference-data.ts:290+`) queries `type: { in: [...EXPENSES_TAB_TYPES] }` and reads
  `doc.type` when computing `billed` via `billedAmountFor`, but `MaterialTransactionRowT`
  (`src/types/reference-data.ts:77`) has no `type` field. The component currently infers "this is a
  netto row" from `row.billed !== row.amount` — a proxy, not the fact.
- **The href is hardcoded wrong.** `materials-transactions-table.tsx:98-102` builds
  `?type=INVESTMENT_EXPENSE&id=…` for every row. `buildTransferFilters`
  (`src/lib/queries/transfer-filters.ts`) turns that into `where.type = { in: ['INVESTMENT_EXPENSE'] }`,
  so clicking a netto row or a korekta lands on a list that filters out the very row clicked. The
  netto half is new from EX-567; the korekta half is pre-existing.
- **The toggle's visibility gate is wrong for three sets.** `hasSettled = rows.some(r => r.settled)`
  (`materials-transactions-table.tsx:74`) hides the entire `ToggleGroup` unless a _settled_ row
  exists — so an investment with netto expenses but no settled materials would never see a netto tab.
- **`CORRECTION` belongs in the brutto tab, per the domain authority.** The Sheet labels a korekta
  `'Korekta → wydatki inwest.'` (`src/lib/constants/transfers.ts:315`) and validation requires it
  negative (`src/lib/utils/validation.ts:9`) — it reads as an adjustment _to_ wydatki inwestycyjne,
  not a category of its own. It also counts into `totalMaterialCosts`
  (`derive-financials-bucketing.test.ts:243-255`, where the `25` is a korekta inside `1125`), so
  hiding it would leave a total with no drill-down.
- **B5 does not break at the data layer.** The guard at `derive-financials-bucketing.test.ts:240`
  asserts Σ`billedAmountFor` over the **unsettled** rows === `totalMaterialCosts` — keyed on
  `settled`, not on tabs, so it stays green. What the split breaks is the _on-screen_ reconciliation:
  the visible tab's Σ no longer equals the breakdown's „Razem". That needs a **new** guard,
  `Σ(brutto tab) + Σ(netto tab) === totalMaterialCosts`, not an edit to the old one.
- **`DataTable` has no footer.** Nothing in `src/components/ui/data-table/` renders a `<tfoot>`; a
  per-tab „Razem" has to be added to both the plain body and `virtualized-table-body.tsx`.
- **The hover affordance already exists and was judged insufficient.**
  `data-table-row.tsx:58` already applies `hover:bg-muted cursor-pointer transition-colors` (plus
  `router.prefetch` on mouse-enter) whenever a href resolves. That is precisely the state the owner
  called „not obvious enough", so the remedy must be something visible _without_ interaction.
- **Client parity is free.** `buildClientKosztorysEditorData` (`src/lib/queries/client-kosztorys.ts`)
  calls the same fetch, so the new field reaches the unauthenticated share read with no second edit.
  It is wrapped in `unstable_cache` with `KOSZTORYS_TAGS`, so a stale entry serves rows without
  `type` until invalidated — the component must not crash on a missing `type`.

## Desired End State

In Podsumowanie → „Wydatki", the transactions list offers a tab per **non-empty** dataset:
„Wydatki inwestycyjne" (brutto + korekty), „Wydatki netto", „Materiały wliczone w robociznę". Each
tab shows only its own rows and a „Razem" footer summing them, so the owner can add the first two and
land on the breakdown's total. On the netto tab the leading amount is the **netto** figure (the one
the tab totals and the one that bills the investor), with brutto beneath it. Every row carries a
visible chevron and links to a transfers list filtered by that row's own type, so the target row is
always present. Under `clientView` there are no links and no chevron.

Verify: unit suite green; manually, an investment with a netto expense shows three tabs whose two
expense „Razem" figures add to the breakdown „Razem", and clicking a netto row and a korekta row each
lands on a list containing that row.

### Key Discoveries

- `doc.type` is already in hand at the mapping site — the data-layer fix is one field, one line.
- `CORRECTION` placement is decided by the Sheet's own vocabulary, not by preference.
- The existing B5 guard is safe; the split needs a new sibling guard, not a rewrite.
- The chosen hover affordance was already shipped — planning it would have delivered nothing.

## What We're NOT Doing

- Not touching `deriveFinancials`, `billedAmountFor`, `TRANSFER_TYPE_SPECS`, or any money derivation.
- Not splitting netto in `buildFinancialFields` (the investment page's stat buttons) — a real,
  separate gap, unreported and out of scope here.
- Not changing the breakdown table or pie above the list; those already split netto per category.
- No schema change, no migration, no new query.

## Implementation Approach

Land the data field and its guard first, so the money invariant is pinned before any pixel moves.
Then the tabs (carrying the one shared-component change), then the links.

---

## Phase 1: Type on the row + the reconciliation guard

### Overview

Put the transfer type on `MaterialTransactionRowT`, extract the tab partition into a pure helper, and
guard the three-way reconciliation.

### Changes Required

- `src/types/reference-data.ts` — add `type: TransferTypeT` to `MaterialTransactionRowT`; update the
  docblock, which currently states the two-set invariant the split replaces.
- `src/lib/queries/reference-data.ts` — propagate `doc.type` in the row mapper of
  `fetchMaterialTransactionsForInvestment`.
- New pure helper (co-located with the table, or `src/lib/kosztorys/` if it needs a non-component
  home) partitioning rows into `grossExpenses` / `netExpenses` / `settled`: `settled === true` →
  settled; else `type === 'INVESTMENT_EXPENSE_NET'` → netto; else brutto. (Shipped the other way
  round — netto is tested BEFORE `settled`, mirroring `materialsNetBilled`, which ignores `settled`;
  the plan's order would hide a forged settled netto row from the two totals that must reconcile.)
  Tolerate a missing `type`
  (stale cache) by treating it as brutto rather than throwing.
- `src/__tests__/derive-financials-bucketing.test.ts` — new `it` beside the B5 case asserting
  `Σ(billed over grossExpenses) + Σ(billed over netExpenses) === totalMaterialCosts`, over a fixture
  containing a brutto expense, a korekta, a netto expense, and a settled row.

### Success Criteria

#### Automated

- [ ] 1.1 Type checking passes: `pnpm tsc --noEmit`
- [ ] 1.2 New partition guard passes: `pnpm exec vitest run src/__tests__/derive-financials-bucketing.test.ts`
- [ ] 1.3 Existing B5 guard still green in the same run (unchanged assertion)
- [ ] 1.4 Partition helper treats a row with no `type` as brutto (stale-cache tolerance)

---

## Phase 2: Three tabs + per-tab „Razem"

### Overview

Replace the two-way toggle with a tab list built from non-empty datasets, give the netto tab a
netto-leading amount column, and add footer support to the shared `DataTable`.

### Changes Required

- `src/components/ui/data-table/data-table.tsx` + `virtualized-table-body.tsx` — optional footer
  rendering (a `<tfoot>` driven by a new prop), applied identically in the virtualized and plain
  paths so the footer does not scroll away with the rows.
- `src/components/kosztorys/summary/tables/materials-transactions-table.tsx`
  - `DatasetT` becomes `'gross' | 'net' | 'settled'`; options built from the partition's non-empty
    sets, replacing the `hasSettled` gate. A single surviving set renders no `ToggleGroup`.
  - Default tab: `gross` when present, else the first non-empty set.
  - Netto tab column: header „Kwota netto", `billed` leading, `amount` as the grey sub-line —
    inverting today's arrangement on that tab only. Other tabs keep „Kwota brutto" with no sub-line
    (the netto sub-line was only ever there because netto rows sat among brutto ones).
  - „Razem" footer per tab summing `billed` over the visible rows, formatted with `formatNet`.

### Success Criteria

#### Automated

- [ ] 2.1 Type checking passes: `pnpm tsc --noEmit`
- [ ] 2.2 Full unit suite passes: `pnpm exec vitest run`
- [ ] 2.3 `DataTable` footer renders in both the virtualized and non-virtualized paths
- [ ] 2.4 No tab is offered for an empty dataset; a single non-empty set renders no toggle

---

## Phase 3: Honest row links + a visible affordance

### Overview

Derive the href from the row's own type and make the rows look navigable without a hover.

### Changes Required

- `src/components/kosztorys/summary/tables/materials-transactions-table.tsx`
  - `getRowHref` builds `?type=${row.type}&id=${row.id}`, fixing both the netto case and the
    pre-existing korekta case. Fall back to omitting the `type` param when `type` is missing, so a
    stale-cache row links to an unfiltered list rather than a wrong one.
  - Trailing chevron column (`ChevronRight`, muted), suppressed when `clientView` — the rows are not
    links there, so the affordance would lie.

### Success Criteria

#### Automated

- [ ] 3.1 Type checking passes: `pnpm tsc --noEmit`
- [ ] 3.2 Full unit suite passes: `pnpm exec vitest run`
- [ ] 3.3 Href carries the row's own type for each of the three expense types
- [ ] 3.4 `clientView` renders neither href nor chevron

---

## Testing Strategy

The one invariant worth automating is arithmetic: the two expense tabs must still add to
`totalMaterialCosts`. That lives in a unit test over the pure partition helper, beside the existing
B5 case, where it can be asserted in milliseconds and cannot rot with UI churn. The tab/link
behaviour is checked manually — an E2E over rendered footers would be slow and brittle for what is
fundamentally a filter and a string.

## Manual checks

Registered in `context/foundation/manual-checks.md` under this change:

- On an investment with brutto + netto + korekta rows, three tabs appear and each shows only its set.
- The brutto „Razem" plus the netto „Razem" equals the breakdown „Razem" above the list.
- Clicking a netto row lands on a transfers list containing that row; same for a korekta row.
- The client share view shows the tabs, no chevron, and no navigation on click.
- An investment with no netto and no settled rows shows no toggle at all.

## Performance Considerations

The partition is one pass over an already-fetched array; the footer sum is a second pass over the
visible subset. Both are trivial next to the existing virtualizer.

## Migration Notes

None — no schema change. The `unstable_cache` entry for the client read will serve rows without
`type` until `KOSZTORYS_TAGS` invalidates, which is why every consumer treats a missing `type` as
brutto/unfiltered rather than throwing.

## References

- Change notes: `context/changes/2026-07-26-netto-expenses-own-tab/change.md`
- EX-567 (netto expense type): `context/archive/2026-07-24-netto-expense-type/`
- EX-573 (spec table): `context/archive/2026-07-25-transfer-type-spec-table/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Type on the row + the reconciliation guard

#### Automated

- [x] 1.1 Type checking passes: `pnpm tsc --noEmit` — d638f984
- [x] 1.2 New partition guard passes: `pnpm exec vitest run src/__tests__/derive-financials-bucketing.test.ts` — d638f984
- [x] 1.3 Existing B5 guard still green in the same run — d638f984
- [x] 1.4 Partition helper treats a row with no `type` as brutto — d638f984

### Phase 2: Three tabs + per-tab „Razem"

#### Automated

- [x] 2.1 Type checking passes: `pnpm tsc --noEmit` — 7204b32a
- [x] 2.2 Full unit suite passes: `pnpm exec vitest run` — 7204b32a
- [ ] 2.3 `DataTable` footer renders in both the virtualized and non-virtualized paths — not automatable: vitest here is node-env, `*.test.ts` only, no RTL/jsdom; moved to the manual-checks registry
- [x] 2.4 No tab offered for an empty dataset; single non-empty set renders no toggle — 7204b32a

### Phase 3: Honest row links + a visible affordance

#### Automated

- [x] 3.1 Type checking passes: `pnpm tsc --noEmit` — 2d388c0a
- [x] 3.2 Full unit suite passes: `pnpm exec vitest run` — 2d388c0a
- [x] 3.3 Href carries the row's own type for each of the three expense types — 2d388c0a
- [ ] 3.4 `clientView` renders neither href nor chevron — chevron dropped on the owner's call, so this reduces to „no href under clientView"; not automatable here (no DOM harness), moved to the manual-checks registry
