# Notatka column and per-row invoice preview in the kosztorys Wydatki list

## Overview

Extend EX-569's Wydatki list with the two things its bulk-ZIP slice deliberately left out: a „Notatka"
column surfacing the AI-extracted numer faktury, and a per-row invoice preview. Both are client-facing
— the share view is the primary audience.

## Current State Analysis

The Wydatki list (`src/components/kosztorys/summary/tables/materials-transactions-table.tsx`) renders
four columns — Data, Kategoria, Opis, Kwota brutto — plus a dataset toggle and the bulk „Faktury" ZIP
button. Rows arrive as props from `fetchMaterialTransactionsForInvestment`
(`src/lib/queries/reference-data.ts:290-329`), which already resolves the media doc per row for
`invoiceUrl` / `invoiceFilename`.

**Where the FV data lives.** The AI receipt scan persists nothing of its own
(`src/lib/actions/extract-receipt.ts:16`). Its four extracted fields
(`src/lib/ai/receipt-extraction-schema.ts:10-15`) land as: `description` → `transactions.description`
(supplier + date flattened into one string), `amount` → `transactions.amount`, `invoiceNote` →
`transactions.invoiceNote` (`src/collections/transfers.ts:229`, a textarea — **line 1 is the numer
faktury, the pozycje follow newline-separated**), and `otherCategoryName` → discarded on purpose
(`use-receipt-generation.ts:81`). NIP is never extracted. Issue date is never written to
`transactions.date` — that column is the user-entered batch date.

`invoiceNote` is already surfaced on every other transfer surface — the CSV „Notatka"
(`lib/export/transfer-columns.ts:42`), the Google tab (`lib/google/tab-rows.ts:70,109`),
`transfer-mapping.ts:88` — but `MaterialTransactionRowT` (`src/types/reference-data.ts:77-87`) never
picked it up. The kosztorys Wydatki list is the one place the FV data is invisible.

## Desired End State

The Wydatki list carries six columns. „Notatka" shows the numer faktury on one truncated line with the
full note on hover; „Faktura" opens the attached PDF or image in the existing preview dialog. Both
render identically in the owner view and the client share view. Verify by opening a kosztorys
Podsumowanie → Wydatki with scanned invoices attached: the FV number is readable per row, hovering
reveals the pozycje, and clicking the invoice icon opens the document.

### Key Discoveries

- **Both new fields are free.** `reference-data.ts:311-327` already maps `doc` and has `media` in
  hand — `invoiceNote` is `doc.invoiceNote`, `invoiceMimeType` is `media?.mimeType`. No new query.
- **`InvoicePreviewTrigger` (`src/components/ui/invoice-preview-trigger.tsx:15`) is `h-9 w-full`
  bordered** — a form-field control built for `line-item-invoice-field`. This is why `InvoiceCell`
  (`src/components/transfers/invoice-cell.tsx:49-58`) hand-rolls its own ghost icon `Button` instead
  of using it. Two shapes for one concept, and this change would make it three.
- **`TooltipContent` already sets `whitespace-pre-line`** (`src/components/ui/tooltip.tsx:41`), so a
  newline-separated note renders correctly with no new styling. `HintTooltip` (:86) is the read-only
  flavour with the `cursor-help` affordance.
- **Row links already tolerate in-cell buttons.** `data-table-row.tsx:40` skips clicks that land on
  `a, button`, and the client view passes no `getRowHref` at all.
- **`DataTable` has no column-sizing API.** No `getSize`, no width in `ColumnMeta`
  (`src/components/tables/column-meta.ts:5-12` carries only `label` / `canHide` / `align`). Column
  width can only be constrained from inside the cell.

## What We're NOT Doing

- No new query, no schema change, no migration — every field already exists in the DB.
- Not extracting NIP, supplier, or issue date into structured columns. The AI never captures NIP, and
  splitting `description` back into supplier + date is a separate concern.
- Not parsing the note body. Line 1 is taken as the numer faktury by position, which is the contract
  the extraction prompt writes; the rest stays opaque text.
- Not touching upload or delete on the kosztorys side. `InvoicePreviewButton` is read-only by
  construction; `InvoiceCell` keeps sole ownership of those.
- No E2E. The `(share)` route's zero coverage is already owed by EX-569's `e2e-backlog` issue.

## Implementation Approach

Three phases, bottom-up: row data first (nothing renders), then the shared compact trigger (touches an
existing authenticated surface, so it lands isolated), then the two columns that consume both.

## Critical Implementation Details

**Column width has to come from inside the cell.** `DataTable` renders a plain auto-sizing `<table>`
with no sizing hooks, so „Notatka narrow" means a `max-w-*` + `truncate` on a `block`/`inline-block`
element inside the cell — `truncate` alone does nothing in an auto-width `<td>`, which will silently
widen to fit the longest FV number instead.

**Phase 2 changes an authenticated surface.** Retiring `InvoiceCell`'s hand-rolled button onto the
shared compact trigger alters the transfers table, which is live and outside this change's feature
area. It owes its own manual check independent of anything kosztorys.

---

## Phase 1: Row data

### Overview

Carry `invoiceNote` and `invoiceMimeType` down to the Wydatki rows. Nothing renders yet.

### Changes Required:

#### 1. Material transaction row type

**File**: `src/types/reference-data.ts`

**Intent**: The row can't show a note or pick a preview renderer without them. `invoiceMimeType`
completes the invoice triple the branch already carries (`invoiceUrl` / `invoiceFilename`).

**Contract**: `MaterialTransactionRowT` gains `invoiceNote: string | null` and
`invoiceMimeType: string | null`. Both nullable — the note is absent on any row that never went
through a scan, the mime type on any row with no attachment. Extend the existing type comment's last
sentence so it covers the note as well as the invoice pair.

#### 2. Shared fetcher

**File**: `src/lib/queries/reference-data.ts`

**Intent**: Populate the two new fields from data the mapper already holds, so the owner page and the
client share read stay identical by construction.

**Contract**: In `fetchMaterialTransactionsForInvestment`'s `docs.map`, add
`invoiceNote` off `doc` (same `!= null ? String(...) : null` shape as `description` at :317) and
`invoiceMimeType` off the already-resolved `media` (same `?? null` shape as `invoiceUrl` at :325).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- None — nothing user-visible changes in this phase.

---

## Phase 2: Compact preview trigger

### Overview

Give `InvoicePreviewTrigger` an icon-only compact form sized for a table row, and retire
`InvoiceCell`'s hand-rolled duplicate onto it. Lands on its own because it modifies the live
authenticated transfers table.

### Changes Required:

#### 1. Shared trigger

**File**: `src/components/ui/invoice-preview-trigger.tsx`

**Intent**: The existing full-width bordered field breaks a fixed-height virtualized row. A compact
variant makes one component serve both the form field and a table cell, so the next consumer doesn't
hand-roll a fourth shape.

**Contract**: `InvoicePreviewTriggerPropsT` gains an optional variant discriminator (default = today's
field appearance, so existing call sites are untouched). The compact form is icon-only: no border, no
full width, no visible label, `aria-label` carrying the same `Podgląd: <label>` text the field form
uses. Icon selection (`Search` for images, `FileText` otherwise) stays shared across both forms.

#### 2. Transfers invoice cell

**File**: `src/components/transfers/invoice-cell.tsx`

**Intent**: Delete the duplication rather than add to it — the hand-rolled ghost `Button` at :49-58 is
the compact trigger, written twice.

**Contract**: The `hasInvoice` branch renders the compact `InvoicePreviewTrigger` instead of its local
`Button`. The `Plus` upload branch is unrelated and stays as-is. Preserve the current `aria-label`
text (`Podgląd faktury: <filename>` → whatever the shared trigger emits, but it must still name the
file). `FileText` and `Button` imports drop if nothing else in the file uses them.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit tests pass: `pnpm test`

#### Manual Verification:

- Transfers table: the invoice icon still opens the preview dialog, and Usuń / Zamień inside it still
  work (the cell's remove/replace callbacks are unchanged but now hang off a different trigger).
- Transfers table: rows with no invoice still show the `+` upload button, unchanged.
- The line-item invoice field in the expense form still renders the full-width bordered trigger.

---

## Phase 3: The two columns

### Overview

Add „Notatka" and „Faktura" to the Wydatki list.

### Changes Required:

#### 1. Note first-line helper

**File**: `src/lib/utils/invoice-note.ts` (new)

**Intent**: The cell shows only line 1 — the numer faktury — and the tooltip shows the whole note.
Pulling the line-1 extraction out as a pure function is what makes the null / empty / no-newline /
trailing-newline cases testable without rendering a table.

**Contract**: One exported function taking `string | null | undefined` and returning `string | null` —
the first non-empty line trimmed, or `null` when there is nothing to show. `null`, `''`, and a
whitespace-only note all collapse to `null` so the cell can render a single „—" branch.

#### 2. Wydatki table columns

**File**: `src/components/kosztorys/summary/tables/materials-transactions-table.tsx`

**Intent**: Surface the numer faktury for row-to-paper matching, and let a client open the underlying
document without downloading the whole ZIP.

**Contract**: Two entries appended to `MATERIAL_COLUMNS`, both `enableSorting: false`:

- **„Notatka"** — cell renders the helper's line-1 output inside a `HintTooltip` whose `content` is the
  full `invoiceNote`; falls back to a plain „—" with no tooltip and no trigger when the helper returns
  `null`. The visible line is width-capped and truncated from inside the cell (see Critical
  Implementation Details), matching the muted styling the „Opis" column uses at :50-52.
- **„Faktura"** — `align: 'center'`; renders `InvoicePreviewButton` (compact) when `invoiceUrl` is
  present, otherwise nothing. `InvoicePreviewButton`'s props already match the row's
  `invoiceUrl` / `invoiceFilename` / `invoiceMimeType` triple exactly.

The `ROW_HEIGHT = 36` virtualization constant must still hold — a taller control silently desyncs the
virtualizer's offsets from the rendered rows.

#### 3. Helper spec

**File**: `src/__tests__/lib/utils/invoice-note.test.ts` (new)

**Intent**: The note's shape is the one place this change branches. Every failure mode is silent — a
wrong line, or „—" where a number should be.

**Contract**: Cases: `null` / `undefined` input; empty and whitespace-only strings; a single-line note
with no newline; a multi-line note (line 1 returned, pozycje excluded); a note with a leading blank
line; a note with a trailing newline.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Helper spec passes: `pnpm exec vitest run src/__tests__/lib/utils/invoice-note.test.ts`
- Full unit suite passes: `pnpm test`

#### Manual Verification:

- Kosztorys Podsumowanie → Wydatki (owner view): rows with a scanned invoice show the numer faktury in
  „Notatka"; hovering reveals the full note with the pozycje on separate lines.
- A row whose transfer has no note shows „—" and no hover affordance.
- Clicking the „Faktura" icon opens the preview dialog — a PDF in the native viewer, an image inline.
- Row height is unchanged and the list still scrolls correctly at ~100+ rows (the virtualizer's fixed
  36px assumption).
- Clicking the „Faktura" icon does NOT navigate to the transfer detail page (the row link must not
  fire).
- The client share view (`/k/<token>`, logged out) shows both new columns with the same content, and
  its rows still don't navigate anywhere.
- Both dataset tabs („Wydatki inwestycyjne" / „Materiały wliczone w robociznę") carry the new columns.

---

## Testing Strategy

### Unit Tests:

`src/__tests__/lib/utils/invoice-note.test.ts` — the line-1 extraction, per Phase 3.

### What is deliberately not automated:

The tooltip, the preview dialog, and the column rendering are presentational wiring over components
that are already used and verified elsewhere (`InvoicePreviewDialog` has three existing consumers).
The `(share)` route has zero E2E coverage; that gap is already owed as EX-569's `e2e-backlog` issue
and is not re-filed here.

## References

- Parent change: `context/changes/2026-07-25-kosztorys-client-invoices/plan.md` (EX-569)
- Preview dialog and its three existing consumers: `src/components/dialogs/invoice-preview-dialog.tsx`
- AI extraction contract: `src/lib/ai/receipt-extraction-schema.ts:10-15`

## Open Risks & Assumptions

- **The tooltip is hover-only, so on a phone the pozycje are unreachable** — the cell shows the numer
  faktury and nothing more. Accepted deliberately (owner, 2026-07-26) after a popover was offered and
  declined; recorded so it is not rediscovered as a bug. The client share view is the surface most
  likely to be opened on a phone.
- **Line 1 = numer faktury is a convention, not a guarantee.** It holds because the extraction prompt
  writes it that way (`src/lib/ai/openrouter.ts:66-86`) — a hand-typed note, or a prompt revision, can
  put anything on line 1. The cell shows whatever is there; nothing validates it looks like an invoice
  number.
- **Client exposure needs no new gate.** The note is per-pozycja supplier prices in text, but the
  attached PDF *is* the supplier invoice — the ZIP and the preview already leak strictly more, and
  EX-569 records the owner's ruling that client invoice access is the point of the feature.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Row data

#### Automated

- [x] 1.1 Type checking passes
- [x] 1.2 Linting passes

### Phase 2: Compact preview trigger

#### Automated

- [ ] 2.1 Type checking passes
- [ ] 2.2 Linting passes
- [ ] 2.3 Unit tests pass

### Phase 3: The two columns

#### Automated

- [ ] 3.1 Type checking passes
- [ ] 3.2 Linting passes
- [ ] 3.3 Helper spec passes
- [ ] 3.4 Full unit suite passes
