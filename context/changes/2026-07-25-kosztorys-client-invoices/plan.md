# Client-facing „Pobierz faktury" in the kosztorys Wydatki tab — Implementation Plan

## Overview

Give the client a bulk invoice download from the kosztorys Podsumowanie → Wydatki list, on the
unauthenticated share path (`/k/<token>`) as well as in the owner's app view. The archive follows the
list's active dataset toggle, and the whole thing runs without a server action.

## Current State Analysis

The prerequisite landed as commit `0675e8d2` (see `change.md`): the Wydatki list now renders on the
client share path, both settled states, fed by the shared
`fetchMaterialTransactionsForInvestment` in `src/lib/queries/reference-data.ts`.

What exists for invoice downloads today, all on the authenticated transfers side:

- `src/components/transfers/invoice-download-button.tsx` — the „Faktury" button. It does **two** jobs
  in one component: fetches the rows via the `fetchFilteredTransfers` server action, then batch-fetches
  each `invoiceUrl`, names the files, zips, and drives a single in-place toast.
- `src/lib/export/invoice-zip.ts` — `buildUniqueFilename`, `sanitizeForFilename`, `getExtension`,
  `pluralizeInvoice`. Pure, already unit-tested in `src/__tests__/invoice-zip.test.ts` (152 lines).
- `src/lib/export/download.ts` — `triggerDownload`.
- `src/lib/queries/media.ts` — `fetchMediaByIds` (id → `{url, filename, mimeType}`), used by
  `fetch-transfer-rows.ts` together with `extractInvoiceIds` from `transfer-mapping.ts`.

### Key Discoveries

- **No server action is needed.** `src/collections/media.ts` sets `read: () => true`, and uploads go
  to Vercel Blob (`payload.config.ts:83`), so invoice URLs are public. The browser-side
  `fetch` → JSZip loop works with no session. Only job 1 (getting the rows) ever needed auth, and in
  the kosztorys tab the rows are already server-rendered into props.
- **`fetchFilteredTransfers` must stay authenticated.** It takes a caller-supplied `Where` with no
  investment scoping (`src/lib/actions/export.ts`), so relaxing its `requireAuth` would expose every
  transfer in the database. This is the reason the plan routes around it rather than reusing it.
- `MaterialTransactionRowT` (`src/types/reference-data.ts:75`) carries no invoice fields yet.
- At `depth: 0` a transfer doc's `invoice` is a raw media id — the same shape `extractInvoiceIds`
  already handles.
- The `(share)` route group has **no E2E coverage at all** (`ls e2e/`) — a regression there is
  currently invisible.
- `MaterialsTransactionsTable` returns `null` when `rows.length === 0`, so an investment with no
  materiały transactions renders nothing and needs no empty-state handling.

## Desired End State

In the Wydatki tab — owner's app view and client share link alike — a „Faktury" button sits next to
the dataset toggle. Clicking it packs the invoices attached to the **currently visible** dataset into
`faktury-<inwestycja>-<zestaw>-<data>.zip` and reports honestly how many of the visible rows actually
had a downloadable invoice.

Verified by: opening `/k/<token>` in a logged-out browser, toggling between „Wydatki inwestycyjne"
and „Materiały wliczone w robociznę", downloading in each, and confirming the archive contents match
the visible rows.

## What We're NOT Doing

- **No per-row invoice preview** in the Wydatki list. `InvoiceCell` also carries upload and delete, so
  reusing it on a public surface would mean decomposing it first — out of scope.
- **No change to `fetchFilteredTransfers`** or to how the transfers toolbar obtains its rows.
- **No cross-dataset archive.** One download = one dataset, matching what's on screen.
- **No E2E spec in this change** — filed to the backlog instead (see Phase 3).
- No new server action, route handler, or signed-URL scheme. Blob URLs are already public; adding a
  proxy would be a separate security decision, not part of this feature.

## Implementation Approach

Three phases, each independently shippable:

1. Put invoice data on the material rows, so both entry points carry it.
2. Extract the zip/batch/toast loop out of `InvoiceDownloadButton` into a `useInvoiceZip` hook, so the
   behavior has one home. The transfers toolbar keeps its existing rows-via-action path.
3. Mount the button in the Wydatki list and cover the new pure logic with unit tests.

**Consequence worth naming up front**: the honest „pobrano 12 z 15" reporting lives in the shared
hook, so the transfers export inherits it too. That is deliberate — the alternative is two variants of
the same message drifting apart. It is a visible change to an existing authenticated surface, so it
belongs in the manual checks.

## Critical Implementation Details

**Payload weight and cache.** `fetchMaterialTransactionsForInvestment` feeds
`buildClientKosztorysEditorData`, which sits inside an `unstable_cache` entry. Adding invoice fields
grows that entry by two strings per materiały row. Invalidation already works for the normal flow:
the entry is tagged `CACHE_TAGS.transfers`, `recalcAfterChange` is an `afterChange` hook (create *and*
update), and attaching or detaching an invoice writes the transfer. No new tag is needed.

**Known gap, accepted, not fixed here**: `media` has no cache tag (`lib/cache/tags.ts`) and no
revalidation hook (`collections/media.ts` carries only a filename-sanitizing `beforeChange`). Swapping
the file on an *existing* media doc therefore writes no transfer, busts nothing, and leaves the cached
entry serving a URL that Blob has already replaced — a silently missing file in the archive. Closing
it means a `media` tag plus a hook, which is its own change.

**Bundle weight on the public page.** After Phase 3 the import chain is
`materials-transactions-table.tsx` → `use-invoice-zip.ts` → `jszip`, inside the `KosztorysEditorBody`
tree that `/k/<token>` also mounts. A static import would ship ~28 kB gzip of ZIP machinery to a client
who may never click. The hook therefore loads JSZip with a dynamic `import()` inside the handler.

**Media join placement.** The join belongs inside `fetchMaterialTransactionsForInvestment`, not at
either page — that function is the single source both surfaces read, and splitting the join would let
the owner view and the client view disagree about which rows have an invoice.

## Phase 1: Invoice fields on the material rows

### Overview

Both entry points already share one fetcher; teach it to resolve invoice media.

### Changes Required:

#### 1. Row type

**File**: `src/types/reference-data.ts`

**Intent**: `MaterialTransactionRowT` gains the two fields the zip loop consumes. `mimeType` is not
added — nothing in this feature branches on it.

**Contract**: `invoiceUrl: string | null`, `invoiceFilename: string | null`.

#### 2. Shared fetcher

**File**: `src/lib/queries/reference-data.ts`

**Intent**: `fetchMaterialTransactionsForInvestment` resolves each doc's invoice media and populates
the new fields, so the owner page and the client share read stay identical.

**Contract**: Reuse `extractInvoiceIds` (`src/lib/queries/transfer-mapping.ts`) and `fetchMediaByIds`
(`src/lib/queries/media.ts`) — the same pair `fetch-transfer-rows.ts` uses. Return shape is unchanged
apart from the two new fields.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm exec eslint <touched files>`
- Existing unit suite passes: `pnpm exec vitest run`

#### Manual Verification:

- A materiały transaction with an attached invoice reaches the Wydatki list with a non-null
  `invoiceUrl` on both `/inwestycje/<id>/kosztorys_v2` and `/k/<token>`

---

## Phase 2: Extract the zip loop into `useInvoiceZip`

### Overview

Separate „get the rows" from „pack the rows", so a caller that already has rows can skip the fetch.

### Changes Required:

#### 1. The hook

**File**: `src/components/transfers/use-invoice-zip.ts` (new)

**Intent**: Owns everything after the rows are known — filtering to rows with an invoice, the
batched blob fetch, unique naming, zip generation, download trigger, and the single in-place toast.
Callers supply rows and an archive name.

**Contract**: `useInvoiceZip()` returns `{ download, isPending }` where
`download(rows: InvoiceZipRowT[], archiveName: string): void`, and
`InvoiceZipRowT = { date: string; description: string | null; invoiceUrl: string | null; invoiceFilename: string | null }`
— the structural subset both `TransferRowT` and `MaterialTransactionRowT` satisfy. `description` is
**nullable**: `TransferRowT.description` is `string` but `MaterialTransactionRowT.description` is
`string | null`, so the widened field is what makes both assignable; the hook coalesces to `''` before
`buildUniqueFilename`, which takes a plain `string`. `BATCH_SIZE = 6` carries over unchanged (browser
connection cap). JSZip is loaded via a dynamic `import()` inside the handler, not a module-level
import — see "Bundle weight on the public page" above.

Reporting changes per the decision: the final toast distinguishes rows that had no invoice attached
from files that failed to download, rather than reporting only the success count. A dedicated pure
helper (Phase 3) produces the message so it can be unit-tested without a browser.

#### 2. Transfers button

**File**: `src/components/transfers/invoice-download-button.tsx`

**Intent**: Shrinks to job 1 — call `fetchFilteredTransfers(where)`, hand the rows to the hook. No
behavior change beyond the improved final message.

**Contract**: Props unchanged (`{ where: Where }`), so `transfer-export-toolbar.tsx` needs no edit.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm exec eslint <touched files>`
- Existing unit suite passes: `pnpm exec vitest run`

#### Manual Verification:

- The transfers table's „Faktury" button still downloads a working archive with correct filenames
- Its final toast reports missing invoices honestly on a filter set where some rows have none

---

## Phase 3: Mount the button in the Wydatki list

### Overview

Wire the hook into the materiały list, name the archive after the investment and dataset, and cover
the new pure logic.

### Changes Required:

#### 1. Archive naming + reporting helpers

**File**: `src/lib/export/invoice-zip.ts`

**Intent**: Two new pure functions — one composing the archive name, one composing the final toast
message — so both are testable without a browser and shared by the two buttons.

**Contract**: `buildInvoiceArchiveName(parts: string[], date: string): string` returns
`faktury-<sanitized parts joined by ->-<date>.zip`, running each part through the existing
`sanitizeForFilename` (an investment name can contain `/` or `:`). The transfers button passes no
parts and keeps `faktury-<date>.zip`. The reporting helper takes `{ withInvoice, downloaded, total }`
and returns the message, reusing `pluralizeInvoice`.

#### 2. The list

**File**: `src/components/kosztorys/summary/tables/materials-transactions-table.tsx`

**Intent**: A „Faktury" button next to the existing `ToggleGroup`, packing `visibleRows` — so it
follows the active dataset for free. Rendered in every view, the client's included; unlike
`getRowHref`, it is not gated on `clientView`.

**Contract**: The component needs the investment name for the archive; it currently receives only
`investmentId`, and `KosztorysTotalsPanel` has no `investmentName` prop either — so the thread starts
one hop higher, at `kosztorys-editor-body.tsx` (which already holds it), and runs
`KosztorysEditorBody` → `KosztorysTotalsPanel` → `SummaryExpensesTab` → the table. Four files, not
three. Rejected alternative: reading it off the editor context that `kosztorys-editor-body.tsx`
already builds — it would save the threading but turn a context-free leaf table into a
provider-dependent one for the sake of one string.

The button is **hidden when the active dataset has no invoice at all**. The transfers variant shows it
unconditionally and toasts „Brak faktur do pobrania" only because its rows aren't known until after the
fetch; here they're already in props, so an affordance that provably does nothing is not rendered.

Dataset label comes from the existing `DATASET_OPTIONS`.

#### 3. Unit tests

**File**: `src/__tests__/invoice-zip.test.ts`

**Intent**: Extend the existing suite with the two new helpers.

**Contract**: Cover archive naming (illegal characters in an investment name, empty parts →
generic name) and the reporting helper (all present, some rows without an invoice, some downloads
failed, nothing downloadable). Assert returned values, not internals.

#### 4. E2E backlog issue

**Intent**: The `(share)` group has no browser coverage; this change adds a user-visible capability
there. Per `AGENTS.md`, a browser-level slice owes its E2E or an explicit deferral.

**Contract**: A Linear issue in project „Wykonczymy" labelled `e2e-backlog`, covering: logged-out
`/k/<token>` renders the Wydatki list, both dataset tabs work, and the „Faktury" button produces an
archive. Reality-check the Linear MCP first — if it is unreachable, say so rather than claim a filing.

### Success Criteria:

#### Automated Verification:

- New unit tests pass: `pnpm exec vitest run src/__tests__/invoice-zip.test.ts`
- Full unit suite passes: `pnpm exec vitest run`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm exec eslint <touched files>`

#### Manual Verification:

- Logged out on `/k/<token>`, the „Faktury" button downloads an archive of the visible dataset
- Switching to „Materiały wliczone w robociznę" and downloading yields that dataset's invoices, not
  the other one's
- The archive name carries the investment name and the dataset; two investments downloaded the same
  day do not collide in the Downloads folder
- A dataset where some rows have no invoice reports the shortfall rather than implying a complete set
- An investment with zero materiały transactions still renders no list and no button
- A dataset whose rows all lack an invoice renders the list but no „Faktury" button

---

## Testing Strategy

### Unit Tests:

- `buildInvoiceArchiveName` — illegal characters in the investment name, empty parts, date suffix
- The reporting helper — complete set, partial (rows without an invoice), partial (failed downloads),
  nothing downloadable

### Manual Testing Steps:

1. Log out entirely, open `/k/<token>` for an investment with materiały invoices
2. Download on „Wydatki inwestycyjne", open the archive, confirm the files match the visible rows
3. Toggle to „Materiały wliczone w robociznę", download, confirm a different, correct set
4. Detach an invoice from one transaction, reload, download, confirm the shortfall is reported
5. Back in the app, run the transfers table's „Faktury" export and confirm no regression

## References

- Prerequisite fix: commit `0675e8d2`
- Existing zip loop: `src/components/transfers/invoice-download-button.tsx`
- Existing pure helpers + their tests: `src/lib/export/invoice-zip.ts`,
  `src/__tests__/invoice-zip.test.ts`
- Media join pattern: `src/lib/queries/fetch-transfer-rows.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Invoice fields on the material rows

#### Automated

- [x] 1.1 Type checking passes — ed724650
- [x] 1.2 Linting passes — ed724650
- [x] 1.3 Existing unit suite passes — ed724650

### Phase 2: Extract the zip loop into `useInvoiceZip`

#### Automated

- [x] 2.1 Type checking passes — 35e18250
- [x] 2.2 Linting passes — 35e18250
- [x] 2.3 Existing unit suite passes — 35e18250

### Phase 3: Mount the button in the Wydatki list

#### Automated

- [x] 3.1 New unit tests pass — 45d9f865
- [x] 3.2 Full unit suite passes — 45d9f865
- [x] 3.3 Type checking passes — 45d9f865
- [x] 3.4 Linting passes — 45d9f865
