---
change_id: ex-672-remove-print-csv-export
title: Remove transfer print + CSV export and the header-fields layer
status: implemented
created: 2026-08-12
updated: 2026-08-12
archived_at: null
branch: konradantonik/ex-672-remove-print-csv-export
worktree: null
---

## Notes

EX-672 — remove transfer print + CSV export and the header-fields layer.

Owner ruled both features unnecessary (2026-08-12). They ship together because they share one
layer: the `headerFields` config field plus `useHeaderFieldsStore`. Print is not a screenshot — it
is a second independent reader that computes its own balance (`calculateBalance` in
`lib/export/header-fields`) and filters fields through the global store, whose state the clickable
v1 `FinancialStats` tiles set.

Scope corrections made on the Linear issue before starting:

- `fetchFilteredTransfers` (`lib/actions/export`) **stays** — `invoice-download-button.tsx:29` calls
  it, and invoice download is explicitly out of scope.
- `HeaderFieldT` **stays** — `FinancialFieldT = HeaderFieldT & { amount: number }`
  (`types/export.ts:12`) feeds `FinancialStats`. Only the `headerFields?` field on
  `TransferTableConfigT` goes now.

Corrected by research (2026-08-12) — see `research.md`:

- The store decision was accepted on a false premise. **The v1 tiles do not stop being clickable.**
  The toggle, the `opacity-40` dimming and the on-screen bilans all run on `ToggleStatButtons`' own
  `useState` (`toggle-stat-buttons.tsx:48,50-58,62,85`); the store is a mirror that exists solely to
  reach print. Removing it costs nothing on screen — and under the default `?widok=v2` the linkage
  has been inert since 2026-07-26 (`lessons.md:226`).
- **`HeaderFieldT` does not die with EX-673 either.** `FinancialStats` is not v1-only —
  `raporty/page.tsx:75-81` renders it unconditionally, with no version param on that page.
- **Deleting the toolbar removes invoice download.** `transfer-export-toolbar.tsx:38` also renders
  `InvoiceDownloadButton`, whose only importer it is. It must be lifted into
  `transfer-data-table.tsx:66` — which also decides whether the manager dashboard gains the button
  it currently lacks (`manager-dashboard.tsx:33`). Open question 1 in `research.md`.

Trap: `headerFields` is optional on `TransferTableConfigT`, so removing a producer lights nothing
up — print would just come out empty. Gate the cleanup on `tsc`, not on grep; run
`dead-code-scanner` after the buttons are gone.

Blocks EX-673 (v1 sunset on the investment card).
