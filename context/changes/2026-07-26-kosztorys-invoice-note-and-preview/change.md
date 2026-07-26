---
change_id: kosztorys-invoice-note-and-preview
title: Notatka column and per-row invoice preview in the kosztorys Wydatki list
status: implemented
linear: EX-585
created: 2026-07-26
updated: 2026-07-26
archived_at: null
branch: feat/ex-569-kosztorys-client-invoices
worktree: .claude/worktrees/ex-569-invoice-note
---

## Notes

Extends EX-569's Wydatki list (`materials-transactions-table.tsx`) with the two things the bulk-ZIP
slice deliberately left out. Runs on the same unmerged branch — EX-569 is still `In Progress` /
`in review`.

### Why now

The AI receipt scan's extracted invoice data lands in exactly one place — `transactions.invoiceNote`
(`src/collections/transfers.ts:229`, a textarea): **line 1 = numer faktury, then each pozycja,
newline-separated** (`src/lib/ai/receipt-extraction-schema.ts:10-15`, prefilled at
`use-receipt-generation.ts:80`). Supplier and issue date are flattened into `description`
(`"Castorama 05.03.2026"`); NIP is never extracted; the scanned category is extracted then discarded.

That note is already surfaced on every other transfer surface — the CSV („Notatka"), the Google tab,
`transfer-mapping.ts:88` — but `MaterialTransactionRowT` never picked it up, so the kosztorys Wydatki
list is the one place the FV data is invisible.

### The work

1. `MaterialTransactionRowT` gains `invoiceNote` + `invoiceMimeType`. Both come off data the shared
   `fetchMaterialTransactionsForInvestment` already resolves (the transfer row; the media doc it
   already joins for `invoiceUrl` / `invoiceFilename`). No new query.
2. „Notatka" column — the cell shows **line 1 only, the numer faktury**; the pozycje below it live
   solely in the `Tooltip` (`components/ui/tooltip.tsx`). Not a blind one-line flatten: line 1 is the
   part a client uses (matching a row to a paper faktura), and the 36px virtualized row can't carry
   the rest anyway. Empty on hand-entered rows that never went through a scan — those render „—",
   with no tooltip and no trigger.
3. „Faktura" column — per-row preview via the existing `InvoicePreviewButton`
   (`components/dialogs/invoice-preview-button.tsx`), which wraps the already-generic
   `InvoicePreviewDialog` (image → `next/image`, PDF → native `<iframe>`). No new preview code.

### Decisions already settled

- **Reverses EX-569's "bulk ZIP only, no per-row preview".** That decision was scoped to avoid
  pulling in `InvoiceCell`, which also owns upload + delete. `InvoicePreviewButton` is the read-only
  pair and carries neither.
- **Row-link coexistence is free.** `data-table-row.tsx:40` already skips clicks that land on
  `a, button`, and the client view passes no `getRowHref` at all.
- **Client exposure needs no new gate** (owner, 2026-07-26). The note is per-pozycja supplier prices
  in text — but the attached PDF _is_ the supplier invoice, so the ZIP and the preview already leak
  strictly more. EX-569 records the owner's ruling that client invoice access is the point of the
  feature. The note only makes searchable what the attachment already shows.
