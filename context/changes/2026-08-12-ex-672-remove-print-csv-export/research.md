---
date: 2026-08-12T00:00:00+02:00
researcher: ex-Plant
git_commit: 26e284e4cd7b8e413c178af41723ccab4d0510ff
branch: staging
repository: wykonczymy
topic: 'EX-672 — remove transfer print + CSV export and the header-fields layer'
tags: [research, codebase, transfers, export, print, header-fields, financial-stats]
status: complete
last_updated: 2026-08-12
last_updated_by: ex-Plant
---

# Research: EX-672 — remove transfer print + CSV export and the header-fields layer

**Date**: 2026-08-12
**Researcher**: ex-Plant
**Git Commit**: 26e284e4cd7b8e413c178af41723ccab4d0510ff
**Branch**: staging
**Repository**: wykonczymy

## Research Question

What exactly has to be deleted, kept, and rewired to remove the transfer print + CSV export
feature and the `headerFields` / `useHeaderFieldsStore` layer — and what does the ticket get wrong?

## Summary

The deletion is real and sizeable (~450 lines of module deleted outright plus wiring in six files),
but **the ticket's own framing is wrong in three places**, and one of them is a hidden regression
that ships silently.

1. **Deleting the toolbar removes invoice download.** `transfer-export-toolbar.tsx:38` also renders
   `InvoiceDownloadButton` — the one feature the ticket declares out of scope. It is the toolbar's
   _only_ mount point in the app.
2. **The v1 tiles do not stop being clickable.** The toggle affordance is `ToggleStatButtons`' own
   `useState`, not the store. Removing the store costs nothing on screen.
3. **`FinancialStats` is not v1-only**, so `HeaderFieldT` does not die with EX-673 as assumed —
   `/raporty` renders it unconditionally, with no version param at all.

The print/CSV pair is genuinely self-contained otherwise: no E2E coverage, no nav entry, one
Vitest spec, and every module below it has consumers only within the pair — with two exceptions
(`download.ts`, `lib/actions/export.ts`) that the invoice path shares and that must survive.

## Detailed Findings

### The invoice-download trap (the one real regression)

`transfer-data-table.tsx:65-74` renders the toolbar inside `DataTable`'s `toolbar` render prop:

```tsx
<div className="ml-auto flex items-center gap-2">
  {' '}
  // :66
  <CancelledTransactionAuditButton baseUrl={baseUrl} /> // :67
  <CancelledFilterButton baseUrl={baseUrl} /> // :68
  {headerFields &&
    headerFields.length > 0 && ( // :69  ← the gate
      <TransferExportToolbar config={config} columnVisibility={cv} sorting={sorting} />
    )}
  <ColumnToggle table={table} columnVisibility={cv} /> // :72
</div>
```

and `transfer-export-toolbar.tsx:34-40` renders **three** buttons, not two:

```tsx
<PrintButton … />              // :36  delete
<CsvButton … />                // :37  delete
<InvoiceDownloadButton … />    // :38  KEEP — out of scope
```

`invoice-download-button.tsx` has exactly one importer: the toolbar (`transfer-export-toolbar.tsx:7`).
Delete the toolbar as the ticket describes and invoice download disappears from all four pages that
have it today. It must be lifted directly into the `div` at `transfer-data-table.tsx:66`, taking
only `config.query.where`.

**Consequence worth a ruling:** because the gate is on `headerFields`, invoice download is currently
_absent_ from the manager dashboard — `manager-dashboard.tsx:33` mounts `TransfersSection` with no
`headerFields`. Mounting `InvoiceDownloadButton` ungated therefore **adds** the button to the
dashboard. That is a visible behavior change beyond the ticket; see Open Questions.

Once the toolbar goes, the `sorting` argument of the render prop becomes unused (`ColumnToggle`
still needs `cv`), and `getVisibleColumnIds` (`transfer-export-toolbar.tsx:16-24`) dies with it.

### The store costs nothing on screen — the accepted trade-off was overstated

`ToggleStatButtons` (`src/components/ui/toggle-stat-buttons.tsx`) owns the whole visible affordance
locally:

- `:48` `const [hidden, setHidden] = useState<Set<string>>(() => new Set())`
- `:50-58` `toggle()` updates that local set **and then** calls the optional `onToggle?.(label)`
- `:62` `computeSummary(allEntries, hidden)` — the on-screen bilans, computed from local state
- `:85,:95` `isHidden && 'opacity-40'` — the dimming

`financial-stats.tsx` supplies the store as a _mirror only_: `:84-85` pulls `toggle`/`reset`,
`:87-89` resets on mount, `:124` passes `onToggle={toggle}`. It is the only writer in the app;
`print-button.tsx:27` is the only reader.

**So dropping the store leaves the tiles clickable, still dimming, still recomputing the bilans.**
The only thing lost is the print header's ability to follow the tiles — and per `lessons.md:226`
that linkage is _already_ dead under the default `?widok=v2`, because the tiles don't render there
and the empty store takes print's all-fields branch unconditionally.

`ToggleStatButtons` survives both EX-672 and EX-673 regardless: two dashboard components use it
without `onToggle` (`user-register-stats.tsx:33`, `register-balance-chart.tsx:30`), and it has its
own spec (`src/__tests__/toggle-stat-buttons.test.ts`).

### `HeaderFieldT` outlives EX-673 too

`FinancialStats` is rendered from two places, and only one is version-gated:

- `inwestycje/[id]/page.tsx:103-110` — inside the `version === 'v1'` branch
  (`:47` `parseStatsVersion(sp[STATS_VERSION_PARAM])`, default **v2**, `lib/constants/stats-version.ts:6-14`)
- `raporty/page.tsx:75-81` — **unconditional, no version param on that page at all**

`FinancialFieldT = HeaderFieldT & { amount: number }` (`types/export.ts:12`) feeds it via
`buildFinancialFields` (`lib/db/map-category-costs.ts:104-140`). So `HeaderFieldT` stays live after
EX-673 unless `/raporty` is also in that ticket's scope. The `change.md` claim "the type dies with
v1 in EX-673" is wrong and has been corrected.

Optional follow-up, not forced: once `calculateBalance` dies, `HeaderFieldT.amount?` is redundant,
and `FinancialFieldT` could flatten to a standalone `{ label; value; amount }` — deleting
`HeaderFieldT` outright. Judgment call, better as its own small change.

### Module-by-module disposition

**Delete outright** (~450 lines; every consumer is inside the pair):

| Module                                             | Lines | Sole consumers                           |
| -------------------------------------------------- | ----- | ---------------------------------------- |
| `components/transfers/print-button.tsx`            | 75    | toolbar `:5`                             |
| `components/transfers/csv-button.tsx`              | 54    | toolbar `:6`                             |
| `components/transfers/transfer-export-toolbar.tsx` | 41    | data table `:9`                          |
| `lib/export/print.tsx`                             | 107   | print-button `:8`, its spec              |
| `lib/export/print-iframe.ts`                       | 26    | print-button `:9`                        |
| `lib/export/csv.ts`                                | 21    | csv-button `:9`                          |
| `lib/export/sort-rows.ts`                          | 47    | print-button `:13`, csv-button `:11`     |
| `lib/export/transfer-columns.ts`                   | 53    | `print.tsx:2`, `csv.ts:1` — nothing else |
| `stores/header-fields-store.ts`                    | 18    | loses reader and writer together         |
| `__tests__/build-print-html.test.ts`               | 91    | dies with `print.tsx`                    |

**Must survive:**

- `lib/export/download.ts` — `use-invoice-zip.ts:5` calls `triggerDownload` at `:117`.
  (One sub-agent listed this as deletable; grep disproves it. Verified directly.)
- `lib/actions/export.ts` (`fetchFilteredTransfers`) — `invoice-download-button.tsx:9` calls it at `:29`.
- `lib/export/invoice-zip.ts` and the whole invoice path (5 importers incl. kosztorys
  `materials-transactions-table.tsx:12`).
- `types/export.ts` `HeaderFieldT` / `FinancialFieldT` — see above.

**Needs rework, not deletion:** `lib/export/header-fields.ts`. Its `calculateBalance` has a second
consumer outside the print path — `__tests__/investment-render-parity-db.test.ts:15` imports it
aliased as `sumVisibleFields` and uses it at `:122`. That is the parity test `lessons.md:19-24` was
written about. Deleting the module breaks it; the sum has to be inlined into the spec (or moved to
a home the spec owns) and the parity comparison drops from three surfaces to two.

### The four `headerFields` producers

All four become dead computations. `tsc` will **not** flag any of them — `headerFields?` is optional
on `TransferTableConfigT` — which is exactly the trap the ticket names.

| Page                       | Block                    | Also-unused after removal                                                                      |
| -------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| `inwestycje/[id]/page.tsx` | `:73-76` (passed `:132`) | `HeaderFieldT` import `:26`. `financialFields` (`:67`) stays — feeds `FinancialStats` `:105`   |
| `kasa/[id]/page.tsx`       | `:62-66` (passed `:82`)  | `HeaderFieldT` import `:16`, **and the `formatPLN` import `:8`** — `:64` is its only call site |
| `pracownicy/[id]/page.tsx` | `:56-59` (passed `:72`)  | `HeaderFieldT` import `:15`, **and `formatPLN`** — sole call site                              |
| `raporty/page.tsx`         | `:59-62` (passed `:88`)  | `HeaderFieldT` import `:17`. `financialFields` stays — feeds `FinancialStats` `:76`            |

`ownerName` (kasa `:57`) and `saldo` (kasa `:49`, pracownicy `:54`) are shared with `InfoList` /
`SaldoDisplay` and stay.

### Adjacent dead code found while tracing (not in ticket scope)

- **`TransferTableConfigT.totalPayouts?` (`types/export.ts:28`) is already dead** — written at
  `inwestycje/[id]/page.tsx:133` and `raporty/page.tsx:89`, read by nothing. (The `totalPayouts=`
  at `:107`/`:78` are `FinancialStats` props — a different path.)
- **`context` / `contextId` / `ExportContextT` (`types/export.ts:4,25,26`) are dead** — written at
  `inwestycje/[id]:130-131` and `kasa/[id]:79-80`, zero readers repo-wide.
- `invoice-download-button.tsx:27` carries a comment referencing "Print/CSV exports" that goes stale.

### Test and coverage picture

- One spec dies: `__tests__/build-print-html.test.ts` (6 cases).
- One spec needs rework: `__tests__/investment-render-parity-db.test.ts:15,122`.
- **No CSV spec, no toolbar spec, no stat-tile-click spec.**
- **No Playwright coverage at all** — grep across `e2e/` for drukuj/csv/print/eksport/faktur returns
  zero functional hits. So no E2E is owed for the removal, and none exists to update.
- `__tests__/map-category-costs.test.ts:152` mentions "(listing, export, print)" in a comment while
  importing a _different_ `calculateBalance` (`@/lib/db/calculate-balance`, `:7`). Comment only.

## Code References

- `src/components/transfers/transfer-data-table.tsx:69-71` — the `headerFields` gate; the single entry point
- `src/components/transfers/transfer-export-toolbar.tsx:36-38` — the three buttons, one of which stays
- `src/components/ui/toggle-stat-buttons.tsx:48,50-58,62,85` — the local toggle state that makes the store expendable
- `src/components/investments/financial-stats.tsx:84-89,124` — the store's only writer
- `src/components/transfers/print-button.tsx:27-36` — the only reader; the second `calculateBalance`
- `src/lib/export/download.ts:2` ← `src/hooks/use-invoice-zip.ts:5,117` — why `download.ts` stays
- `src/lib/actions/export.ts:12` ← `src/components/transfers/invoice-download-button.tsx:9,29` — why the action stays
- `src/types/export.ts:4,12,25-28` — `HeaderFieldT`, `FinancialFieldT`, and three dead config fields
- `src/app/(frontend)/raporty/page.tsx:75-81` — `FinancialStats` with no version gate
- `src/components/dashboard/manager-dashboard.tsx:33` — the mount with no `headerFields`

## Architecture Insights

- **The gate conflated two features.** `headerFields` is print's data, yet it gates invoice download
  too, purely because all three buttons were parked in one toolbar component. The split at
  `fe580e33` ("split export toolbar into PrintButton and CsvButton") divided the buttons but left
  the shared gate — so a data dependency of one feature became the visibility condition of another.
  Lifting `InvoiceDownloadButton` out is the fix, and it is a strict improvement independent of this
  deletion.
- **A mirror store outlived its reason.** `header-fields-store` exists only to carry local component
  state across to a second consumer on the same page. Everything user-visible was always local;
  once the remote consumer goes, so does the store, with no UI consequence. Under v2 it has been
  inert since 2026-07-26.
- **Deleting print retires one of the two `calculateBalance`s** that `lessons.md:21` names as
  standing drift (static formula vs sum-of-visible-cards). Half of a documented duplication falls
  out of this change for free.
- **Optional config fields hide their own death.** Three fields on `TransferTableConfigT`
  (`headerFields`, `totalPayouts`, `context`/`contextId`) are written by pages and read by nobody,
  and the optionality means the compiler is silent. This is the structural reason the ticket's
  "gate on `tsc`, not grep" warning is right — but it also means `tsc` alone won't find the
  _producers_; those need grep, then `dead-code-scanner`.

## Historical Context (from prior changes)

- `context/archive/2026-07-26-investment-summary-panel/change.md:36-40` — **pre-authorizes this
  deletion.** Owner: browser print "is being phased out in favour of a PDF anyway, and the dynamic
  bilans is NOT a requirement to carry over. No PDF generation exists in the repo yet — that is
  separate, later work." Same doc sets EX-673's mandate: delete the whole `?widok` axis once the
  comparison is called over.
- `context/archive/2026-08-08-summary-panel-filter-blind/review-gate.md:11` — the investment page
  keeps a `statsWhere` aggregate fetch alive for two consumers, `headerFields` **and**
  `TransfersSection.totalPayouts`. Since `totalPayouts` on the config turns out to be dead, this is
  the one place where a perf win may fall out — but `financialFields` still feeds `FinancialStats`
  under v1, so the fetch cannot simply go. Under `?widok=v2` it becomes purely vestigial, which is
  EX-673's win to collect, not this ticket's.
- `context/archive/2026-08-08-summary-panel-filter-blind/review-gate.md:17` — dismissed observation
  that the export header reports _filtered_ figures while the panel reports unfiltered ones. Moot
  after this change.
- `context/foundation/lessons.md:223-228` — a lesson written **about this exact machinery** ("A print
  header that falls back to 'all fields' degrades silently when its selector is removed"). Its
  subject disappears here; per the doc-lifecycle rule it must be retired or rewritten as part of
  this change, or the next reader hunts a store that no longer exists.
- `context/foundation/lessons.md:566-578` — `fetchFilteredTransfers` takes a caller-supplied `Where`
  and is bounded only by `requireAuth`. It survives this change (invoice download), so that
  constraint is unchanged — do not treat the shrinking caller list as a reason to relax it.
- `context/foundation/manual-checks.md:726,748` — two ticked checks assert „eksport CSV/druk działają
  bez zmian". They become stale and must be struck as part of this change.
- `context/foundation/roadmap.md:185,499-510` — slice **S-14 `kosztorys-export`** (status `deferred`,
  CSV of the _kosztorys_, unrelated feature) says at `:509` it "reuses the existing export
  infrastructure (transfers already CSV-export)". Deleting `lib/export/csv.ts` removes that reuse
  target; S-14's risk line goes stale and needs a note.

## Related Research

- `context/archive/2026-07-26-investment-summary-panel/` — origin of the `?widok` axis and of the
  accepted print degradation
- `context/archive/2026-08-08-summary-panel-filter-blind/` — the aggregate-fetch cost analysis on
  the investment page

## Open Questions

1. ~~**Invoice download on the manager dashboard.**~~ **RESOLVED (owner, 2026-08-12): keep it off the
   dashboard, and replace the accidental gate with an explicit one.**

   Not a role question — the button has no role check of its own, and its action allows
   ADMIN/OWNER/MANAGER (`lib/actions/export.ts:15`). A manager already has it on three of the four
   pages that render it (`inwestycje/[id]` `MANAGEMENT_ROLES`, `kasa/[id]` `ROLES`, `pracownicy/[id]`
   `ADMIN_OR_OWNER_MANAGER_ROLES`; only `/raporty` is `ADMIN_OR_OWNER_ROLES`). The gap is one
   _table_, not one role.

   Why it stays off: the dashboard's `where` is `buildTransferFilters(searchParams, { id: 0 })`
   (`manager-dashboard.tsx:38`) — no investment, register, or worker anchor, and `onlyOwnTransfers`
   is not passed. Since the fetch is deliberately unpaginated
   (`invoice-download-button.tsx:27-29`), the button there would ZIP **every invoice in the
   system**. The feature is "invoices for this table's current filter" — note it is _not_ strictly
   per-investment, `/raporty` already runs cross-investment on `urlFilters` — and the dashboard is
   the one table whose filter is nothing.

   **Implementation:** add an explicit `invoiceDownload?: boolean` to `TransferTableConfigT`, set by
   the four pages that should have it, and mount `InvoiceDownloadButton` in
   `transfer-data-table.tsx` on that flag. Reproducing today's behavior by re-deriving it from
   `headerFields` is not an option — that field is being deleted, and the current visibility is an
   artifact of print's data needs rather than a decision anyone made.

2. ~~**Is a PDF replacement owed?**~~ **RESOLVED (owner, 2026-08-12): no.** The July note
   (`context/archive/2026-07-26-investment-summary-panel/change.md:38-40`) framed print as "phased
   out in favour of a PDF", which reads as a replacement being expected; the 2026-08-12 ruling that
   both features are simply unnecessary supersedes it. No PDF work is in scope and none is owed.

3. ~~**Sweep the adjacent dead config fields?**~~ **RESOLVED (owner, 2026-08-12): yes, delete them.**
   `totalPayouts` (`types/export.ts:28`) and `context`/`contextId`/`ExportContextT` (`:4,25,26`)
   have zero readers repo-wide and live in the same type and the same call sites this change already
   edits. They go with it, along with their write sites (`inwestycje/[id]:130-131,133`,
   `kasa/[id]:79-80`, `raporty:89`).

4. ~~**Where does the parity test's sum live?**~~ **RESOLVED (owner, 2026-08-12): inline it; do not
   keep a file alive for a test.** `lib/export/header-fields.ts` is deleted outright and
   `investment-render-parity-db.test.ts` carries its own sum (the spec's existing `sumVisibleFields`
   alias becomes a local helper). The parity comparison drops from three surfaces to two — record
   that in the spec so the narrowed scope is deliberate, not accidental erosion (`lessons.md:19-24`).
