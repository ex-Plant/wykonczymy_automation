# Notatka column and per-row invoice preview — Plan Brief

> Full plan: `context/changes/2026-07-26-kosztorys-invoice-note-and-preview/plan.md`
> Parent change: `context/changes/2026-07-25-kosztorys-client-invoices/` (EX-569, still `in review`)

## What & Why

The AI receipt scan's extracted invoice data lands in exactly one place — `transactions.invoiceNote`,
line 1 being the numer faktury. That note is surfaced on every transfer surface in the app except one:
the kosztorys Wydatki list, whose row type never picked it up. This adds it, plus a per-row invoice
preview so a client can open a document instead of downloading the whole ZIP.

## Starting Point

EX-569 landed the Wydatki list on the client share path with a bulk „Faktury" ZIP button and four
columns. Its rows carry `invoiceUrl` / `invoiceFilename` but neither the note nor the mime type, and
it explicitly logged „bulk ZIP only, no per-row preview" as a decision — scoped that way to avoid
pulling in `InvoiceCell`, which also owns upload and delete.

## Desired End State

Six columns in the Wydatki list. „Notatka" shows the numer faktury truncated on one line with the full
note on hover; „Faktura" opens the PDF or image in the existing preview dialog. Identical in the owner
view and the logged-out client share view.

## Key Decisions Made

| Decision                              | Choice                                                | Why                                                                                                       | Source            |
| ------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------- |
| Reverse EX-569's „no per-row preview" | Reversed                                              | `InvoicePreviewButton` is the read-only pair — no upload, no delete, so the original reason doesn't apply | Plan              |
| Client exposure gate                  | No new gate                                           | The attached PDF _is_ the supplier invoice; ZIP and preview already leak strictly more than the note      | Owner, 2026-07-26 |
| Notatka cell content                  | Line 1 only                                           | The numer faktury is the part a client uses; pozycje live in the tooltip                                  | Owner, 2026-07-26 |
| Overlay type                          | `HintTooltip`, hover-only                             | Matches every other hint in the app, zero new wiring — touch limitation accepted                          | Owner, 2026-07-26 |
| Preview trigger shape                 | Compact variant on the shared `InvoicePreviewTrigger` | Retires `InvoiceCell`'s hand-rolled duplicate instead of adding a third copy                              | Plan              |
| Column layout                         | Six columns, Notatka width-capped                     | Opis (supplier + date) and Notatka (FV number) are related but not the same figure                        | Plan              |
| Regression guard                      | Unit on the line-1 helper only                        | The note's shape is the only branching logic; share-route E2E already owed by EX-569                      | Plan              |

## Scope

**In scope:** `invoiceNote` + `invoiceMimeType` on `MaterialTransactionRowT` and the shared fetcher; a
compact variant of `InvoicePreviewTrigger` with `InvoiceCell` retired onto it; „Notatka" and „Faktura"
columns; a pure line-1 helper and its spec.

**Out of scope:** any new query or schema change (every field exists); extracting NIP / supplier /
issue date into structured columns; parsing the note body; upload or delete on the kosztorys side;
E2E for the `(share)` route.

## Architecture / Approach

`fetchMaterialTransactionsForInvestment` already resolves the media doc per row, so both new fields are
one mapper line each — the owner page and the client read stay identical by construction. Rendering
reuses `HintTooltip` (whose `TooltipContent` already sets `whitespace-pre-line`) and
`InvoicePreviewButton` → `InvoicePreviewDialog`, which has three existing consumers. The only new
component work is the compact trigger variant.

## Phases at a Glance

| Phase                      | What it delivers                                        | Key risk                                                                            |
| -------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1. Row data                | Two fields on the row type + fetcher                    | None — nothing renders                                                              |
| 2. Compact preview trigger | Shared icon-only variant, `InvoiceCell` retired onto it | Touches the live authenticated transfers table                                      |
| 3. The two columns         | Notatka + Faktura, helper and spec                      | `DataTable` has no column-sizing API; a taller control desyncs the 36px virtualizer |

**Prerequisites:** the unmerged `feat/ex-569-kosztorys-client-invoices` branch; a local investment with
scanned invoices attached to its materiały transfers.
**Estimated effort:** one session across three phases.

## Open Risks & Assumptions

- Hover-only tooltip means the pozycje are unreachable on a phone — accepted deliberately after a
  popover was offered and declined.
- „Line 1 = numer faktury" is a prompt convention, not a validated guarantee; a hand-typed note can put
  anything there.

## Success Criteria (Summary)

- A client opening the share link can read each row's numer faktury and open its faktura.
- Hovering a note reveals the pozycje on separate lines; a row with no note reads „—".
- The transfers table and the expense form's invoice field behave exactly as before.
