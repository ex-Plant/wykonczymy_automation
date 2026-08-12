# EX-672 — Remove transfer print + CSV export and the header-fields layer

## Overview

Delete the transfer print and CSV-export features together with the `headerFields` layer they share
(`TransferTableConfigT.headerFields`, `useHeaderFieldsStore`, `lib/export/header-fields.ts`). The
owner ruled both features unnecessary (2026-08-12). ~530 lines of module go outright, plus wiring in
six files. Invoice download — which today rides in the same toolbar behind the same accidental gate —
is lifted out first so it survives untouched.

## Current State Analysis

- `transfer-export-toolbar.tsx` renders **three** buttons: `PrintButton`, `CsvButton`, and
  `InvoiceDownloadButton` (`:36-38`). It is `InvoiceDownloadButton`'s only importer.
- `transfer-data-table.tsx:69` gates the whole toolbar on `headerFields && headerFields.length > 0`.
  `headerFields` is _print's_ data, so invoice download's visibility is an artifact, not a decision —
  it is why the manager dashboard (`manager-dashboard.tsx:33`, no `headerFields`) lacks the button.
- Print is a second, independent reader of the financial figures: it computes its own balance via
  `calculateBalance` (`lib/export/header-fields.ts`) and filters fields through
  `useHeaderFieldsStore`, whose only writer is `financial-stats.tsx:84-89,124`.
- The store is a **mirror only**. `ToggleStatButtons` owns the visible affordance in local
  `useState` (`toggle-stat-buttons.tsx:48,50-58,62,85`) — toggle, `opacity-40` dimming and the
  on-screen bilans all survive its removal. Under the default `?widok=v2` the store→print linkage has
  been inert since 2026-07-26 (`lessons.md:226`).
- `headerFields?` is optional on `TransferTableConfigT`, so `tsc` will not flag a stranded producer.
  Three further config fields (`totalPayouts`, `context`, `contextId`) are already written-by-pages,
  read-by-nobody for the same reason.
- Coverage: one spec dies (`__tests__/build-print-html.test.ts`), one needs rework
  (`__tests__/investment-render-parity-db.test.ts:15,122` imports `calculateBalance` as
  `sumVisibleFields`). No CSV spec, no toolbar spec, **no Playwright coverage at all** for print/CSV.

## Desired End State

Print and CSV export no longer exist anywhere in the app: no buttons, no modules, no store, no
config field, no producers. Invoice download renders on exactly the four pages that have it today
(`inwestycje/[id]`, `kasa/[id]`, `pracownicy/[id]`, `/raporty`) and still not on the manager
dashboard — but now behind an explicit `invoiceDownload?: boolean`, not behind print's data. The
v1 stat tiles are unchanged on screen. `dead-code-scanner` reports nothing left over from the pair.

### Key Discoveries

- `transfer-export-toolbar.tsx:38` — the hidden regression the ticket would have shipped.
- `toggle-stat-buttons.tsx:48,62` — why removing the store costs nothing on screen.
- `raporty/page.tsx:75-81` — `FinancialStats` is **not** v1-only, so `HeaderFieldT` stays live.
- `use-invoice-zip.ts:5,117` — why `lib/export/download.ts` must survive.
- `invoice-download-button.tsx:9,29` — why `lib/actions/export.ts` must survive.

## What We're NOT Doing

- Not touching invoice download's behavior, its ZIP path, or `fetchFilteredTransfers`' auth/pagination.
- Not adding invoice download to the manager dashboard (its `where` has no anchor — the ZIP would
  contain every invoice in the system).
- Not building a PDF replacement — explicitly not owed (owner, 2026-08-12).
- Not deleting `HeaderFieldT` / `FinancialFieldT`, and not flattening `FinancialFieldT` (a separate
  judgment call once `calculateBalance` is gone).
- Not touching `ToggleStatButtons` or the v1/v2 `?widok` axis — that is EX-673.
- Not collecting the investment page's `statsWhere` perf win — also EX-673's.

## Implementation Approach

Four phases, ordered so the tree never passes through a state where invoice download is missing:
**lift the survivor first**, then delete, then strip the now-dead producers, then reconcile docs.

## Critical Implementation Details

**Ordering.** Phase 1 must land before Phase 2. Deleting `transfer-export-toolbar.tsx` while it is
still `InvoiceDownloadButton`'s only mount point drops the feature from four pages.

**The compiler will not help in Phase 3.** Every field being removed is optional, so a stranded
producer type-checks fine and simply computes into the void. Gate that phase on grep +
`dead-code-scanner`, not on `tsc`.

---

## Phase 1: Lift invoice download out of the export toolbar

### Overview

Give invoice download its own explicit visibility flag and mount it directly in the data table, so
it no longer depends on the toolbar or on print's data. Behavior-preserving: same four pages, still
absent from the dashboard.

### Changes Required:

#### 1. Config type

**File**: `src/types/export.ts`

**Intent**: Add an explicit opt-in for the invoice-download button so its visibility stops being a
side effect of `headerFields`.

**Contract**: `TransferTableConfigT` gains `invoiceDownload?: boolean`. Doc-comment it as
"the table's current filter is a meaningful invoice scope" — that is the real precondition.

#### 2. Data table

**File**: `src/components/transfers/transfer-data-table.tsx`

**Intent**: Mount `InvoiceDownloadButton` directly in the toolbar `div`, gated on the new flag,
alongside the existing `TransferExportToolbar` mount (which Phase 2 removes).

**Contract**: destructure `invoiceDownload` from `config`; render
`{invoiceDownload && <InvoiceDownloadButton where={config.query.where} />}` inside the `div` at
`:66`, positioned where the toolbar renders it today (after the cancelled-filter buttons).

#### 3. Toolbar

**File**: `src/components/transfers/transfer-export-toolbar.tsx`

**Intent**: Drop its `InvoiceDownloadButton` render and import so the button has exactly one mount
point again.

**Contract**: `TransferExportToolbar` returns only `PrintButton` + `CsvButton`.

#### 4. The four pages

**Files**: `src/app/(frontend)/inwestycje/[id]/page.tsx`, `src/app/(frontend)/kasa/[id]/page.tsx`,
`src/app/(frontend)/pracownicy/[id]/page.tsx`, `src/app/(frontend)/raporty/page.tsx`

**Intent**: Set `invoiceDownload: true` on the `TransferTableConfigT` each page passes, preserving
today's visibility exactly. `manager-dashboard.tsx` is deliberately left alone.

**Contract**: one added config property per page, at the config literal that already carries
`headerFields`.

### Success Criteria:

#### Automated Verification:

- `pnpm exec tsc --noEmit` accepts the new optional field and its four write sites

#### Manual Verification:

- „Pobierz faktury" still appears on `inwestycje/[id]`, `kasa/[id]`, `pracownicy/[id]` and `/raporty`
- It is still absent from the manager dashboard
- Downloading a ZIP from one of those tables still returns the filtered invoices

---

## Phase 2: Delete print, CSV, the toolbar and the store

### Overview

Remove the pair and everything under it that has no consumer outside it, and rehome the one function
a surviving spec borrowed.

### Changes Required:

#### 1. Delete the modules

**Files** (delete outright):

- `src/components/transfers/print-button.tsx`
- `src/components/transfers/csv-button.tsx`
- `src/components/transfers/transfer-export-toolbar.tsx` (takes `getVisibleColumnIds` with it)
- `src/lib/export/print.tsx`
- `src/lib/export/print-iframe.ts`
- `src/lib/export/csv.ts`
- `src/lib/export/sort-rows.ts`
- `src/lib/export/transfer-columns.ts`
- `src/lib/export/header-fields.ts`
- `src/stores/header-fields-store.ts`
- `src/__tests__/build-print-html.test.ts`

**Intent**: The whole print/CSV subtree. Every one of these has consumers only inside the pair.

**Contract**: `src/lib/export/` retains exactly `download.ts`, `invoice-zip.ts` and its other
invoice-path members. `src/lib/actions/export.ts` is untouched.

#### 2. Unmount the toolbar

**File**: `src/components/transfers/transfer-data-table.tsx`

**Intent**: Remove the `TransferExportToolbar` mount, its import, the `headerFields` destructure and
the `headerFields &&` gate. The render prop's `sorting` argument becomes unused (`cv` is still
needed by `ColumnToggle`).

**Contract**: `toolbar={(table, cv) => …}` renders audit button, cancelled filter, the
`invoiceDownload`-gated button, and `ColumnToggle`.

#### 3. Unwire the store

**File**: `src/components/investments/financial-stats.tsx`

**Intent**: Drop the store wiring only — the tiles keep their own local toggle state and stay
clickable, dimming and recomputing the bilans exactly as before.

**Contract**: remove the `useHeaderFieldsStore` import (`:4`), the `toggle`/`reset` selectors
(`:84-85`), the mount-time `reset` effect (`:87-89`) and the `onToggle` prop passed to
`ToggleStatButtons` (`:124`). `ToggleStatButtons`' `onToggle` prop stays optional — two dashboard
consumers already omit it.

#### 4. Rehome the parity spec's sum

**File**: `src/__tests__/investment-render-parity-db.test.ts`

**Intent**: Inline the sum the spec borrowed from the deleted module, and record that the parity
comparison now spans two surfaces instead of three so the narrowed scope reads as deliberate.

**Contract**: the `sumVisibleFields` import (`:15`) becomes a local helper with the same signature
`(fields, visibility) => number` (skip the `Bilans` label, skip `amount === undefined`, skip
`visibility[label] === false`); its call site (`:122`) is unchanged. Add a short comment naming the
dropped third surface (the print header) and EX-672.

#### 5. Stale comment

**File**: `src/components/transfers/invoice-download-button.tsx`

**Intent**: The comment at `:27` references "Print/CSV exports" as a peer; that peer is gone.

**Contract**: comment text only — the unpaginated-fetch rationale it carries must survive the edit.

### Success Criteria:

#### Automated Verification:

- Parity golden master passes with the inlined sum: `pnpm test:parity`
- No references remain: `rg -n 'header-fields-store|TransferExportToolbar|PrintButton|CsvButton|lib/export/(print|csv|sort-rows|transfer-columns|header-fields)' src e2e` returns nothing
- `pnpm exec tsc --noEmit`

#### Manual Verification:

- The transfer tables show no „Drukuj" or „CSV" button on any of the four pages
- v1 stat tiles (`?widok=v1` on `inwestycje/[id]`) still toggle, still dim, and the bilans still
  recomputes on click
- Dashboard register tiles and the register balance chart still toggle

---

## Phase 3: Strip the dead producers and dead config fields

### Overview

Remove the four `headerFields` computations that now feed nothing, plus the three config fields the
research found already dead in the same type and the same call sites.

### Changes Required:

#### 1. Config type

**File**: `src/types/export.ts`

**Intent**: Delete `headerFields?`, and the three fields with zero readers repo-wide.

**Contract**: remove `headerFields?`, `totalPayouts?`, `context?`, `contextId?` and the now-unused
`ExportContextT` alias (`:4`). `HeaderFieldT`, `FinancialFieldT`, `totalFilteredAmount?`,
`listsCancelled?`, `showTotalAmount?`, `cancelledTransactionAudit?` and the new `invoiceDownload?`
all stay.

#### 2. The four producer pages

**Files**:

| Page                       | Remove                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `inwestycje/[id]/page.tsx` | `headerFields` block `:73-76` + its pass `:132`; `context` `:130`, `contextId` `:131`, `totalPayouts` `:133`; `HeaderFieldT` import `:26` |
| `kasa/[id]/page.tsx`       | block `:62-66` + pass `:82`; `context` `:79`, `contextId` `:80`; imports `HeaderFieldT` `:16` **and `formatPLN` `:8`**                    |
| `pracownicy/[id]/page.tsx` | block `:56-59` + pass `:72`; imports `HeaderFieldT` `:15` **and `formatPLN`**                                                             |
| `raporty/page.tsx`         | block `:59-62` + pass `:88`; `totalPayouts` `:89`; `HeaderFieldT` import `:17`                                                            |

**Intent**: These computations now feed nothing.

**Contract**: `financialFields` stays on `inwestycje` and `raporty` (feeds `FinancialStats`);
`ownerName` (kasa `:57`) and `saldo` (kasa `:49`, pracownicy `:54`) stay (feed `InfoList` /
`SaldoDisplay`). Do not remove the `statsWhere` aggregate fetch — `financialFields` still needs it
under v1; that cleanup belongs to EX-673.

### Success Criteria:

#### Automated Verification:

- `rg -n 'headerFields|ExportContextT|contextId|totalPayouts' src` returns only `FinancialStats`'
  own `totalPayouts` prop path, nothing on `TransferTableConfigT`
- `dead-code-scanner` over `src/lib/export`, `src/stores`, `src/components/transfers` reports no
  orphan left by this change
- `pnpm exec tsc --noEmit`

#### Manual Verification:

- All four pages still render their transfer table, filters, sums and stat panels unchanged

---

## Phase 4: Reconcile the docs the deletion invalidates

### Overview

Three living docs make claims that this change falsifies. Per the doc-lifecycle rule they are part
of the change, not a follow-up.

### Changes Required:

#### 1. Lessons

**File**: `context/foundation/lessons.md`

**Intent**: The lesson at `:223-228` ("A print header that falls back to 'all fields' degrades
silently when its selector is removed") is _about_ the machinery being deleted. Retire it, keeping
the transferable rule — a silent-fallback consumer of shared state hides its own death — if it reads
as general; otherwise strike it and note EX-672 removed its subject.

**Contract**: also revisit `:19-24` — deleting print retires one of the two `calculateBalance`
implementations that entry names as standing drift; the remaining drift statement must still be true.

#### 2. Manual checks

**File**: `context/foundation/manual-checks.md`

**Intent**: Two ticked checks at `:726` and `:748` assert „eksport CSV/druk działają bez zmian" and
are now unverifiable.

**Contract**: strike both with an EX-672 note rather than deleting the rows.

#### 3. Roadmap

**File**: `context/foundation/roadmap.md`

**Intent**: Slice S-14 `kosztorys-export` (deferred) claims at `:509` it "reuses the existing export
infrastructure (transfers already CSV-export)". That reuse target no longer exists.

**Contract**: a note on that line only — do not change S-14's status or scope.

### Success Criteria:

#### Automated Verification:

- No phase-scoped automated check applies — this phase edits prose only.

#### Manual Verification:

- `rg -n 'drukuj|eksport CSV|print' context/foundation` surfaces no claim that still asserts the
  feature exists

---

## Testing Strategy

### Unit Tests:

- `investment-render-parity-db.test.ts` — the only spec that changes; the inlined sum must produce
  identical results, verified by the golden master passing unchanged (`pnpm test:parity`).
- `build-print-html.test.ts` (6 cases) is deleted with its subject — no replacement is owed.

### Integration Tests:

- None new. `pnpm test:integration` must stay green (it runs the DB-backed specs against 5435).

### E2E:

**None owed.** Grep across `e2e/` for drukuj/csv/print/eksport/faktur returns zero functional hits —
print and CSV never had browser coverage, so there is nothing to update and no regression window a
new spec would close. This is a removal, not a behavior addition.

### Manual Testing Steps:

1. `inwestycje/[id]` — no „Drukuj"/„CSV"; „Pobierz faktury" present; ZIP downloads.
2. `?widok=v1` on the same page — stat tiles toggle, dim, and the bilans recomputes.
3. `kasa/[id]`, `pracownicy/[id]`, `/raporty` — same button state as (1).
4. Manager dashboard — still no invoice-download button.
5. Dashboard register tiles + balance chart — toggling still works (they never used the store).

## Migration Notes

None — no schema, no data, no persisted state. `useHeaderFieldsStore` is in-memory Zustand with no
persistence.

## Whole-tree Gate

- Type checking passes: `pnpm exec tsc --noEmit`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`
- Integration suite passes: `pnpm test:integration`
- Build succeeds: `pnpm build`

## References

- Research: `context/changes/2026-08-12-ex-672-remove-print-csv-export/research.md`
- Owner pre-authorization: `context/archive/2026-07-26-investment-summary-panel/change.md:36-40`
- Aggregate-fetch cost analysis: `context/archive/2026-08-08-summary-panel-filter-blind/review-gate.md:11`
- Blocks: EX-673 (v1 sunset on the investment card)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Lift invoice download out of the export toolbar

#### Automated

- [x] 1.1 `pnpm exec tsc --noEmit` accepts the new optional field and its four write sites — d252498c

### Phase 2: Delete print, CSV, the toolbar and the store

#### Automated

- [x] 2.1 Parity golden master passes with the inlined sum: `pnpm test:parity`
- [x] 2.2 No references remain to the deleted modules (rg sweep)
- [x] 2.3 `pnpm exec tsc --noEmit`

### Phase 3: Strip the dead producers and dead config fields

#### Automated

- [ ] 3.1 rg sweep for `headerFields|ExportContextT|contextId|totalPayouts` is clean on `TransferTableConfigT`
- [ ] 3.2 `dead-code-scanner` reports no orphan left by this change
- [ ] 3.3 `pnpm exec tsc --noEmit`

### Phase 4: Reconcile the docs the deletion invalidates

#### Automated

- [ ] 4.1 No phase-scoped automated check applies (prose-only phase)
