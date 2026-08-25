---
change_id: invoice-attach-and-pdf-preview
title: Attach invoice pages straight from the picker in the transfers table
status: archived
created: 2026-08-10
updated: 2026-08-11
archived_at: 2026-08-11T16:08:56Z
branch: konradantonik/ex-662-invoice-attach-from-picker
worktree: null
---

## Notes

EX-662, raised during EX-659's manual checks.

The transfers table's „+" opens `InvoiceUploadDialog` — a modal whose only content is a file input
and a „Zapisz" button. Drop it: the click opens the OS picker directly (`multiple`), the pages
upload on change, and the row shows progress while they do — the way `LineItemInvoiceField` already
works in the expense form. The modal adds a step without adding information: after picking a file it
shows a filename and nothing else — no preview — and still demands a „Zapisz" click (owner,
2026-08-11). That path also has to start running `processUploadFile`, which the table
currently skips (so a raw iPhone HEIC uploaded from the table can fail where the same photo works
from the form).

**Deliberate narrowing:** routing the table through `processUploadFile` also applies the 4 MB
client guard there. Images are compressed first, so only a PDF can trip it — a >4 MB invoice PDF
that used to attach raw from the table is now rejected with the same Polish toast the wydatek form
gives. That is the point (the raw path could hit Vercel's uncatchable 4.5 MB 413), but it is a
user-visible change on the one surface where PDFs are common.

**Dropped by the owner (2026-08-11):** unifying the PDF preview with the photo preview. It would
need `pdfjs-dist` plus a pager remodelled from files to (file, page) pairs, touching print and
download too — too much machinery for the payoff. The folder name still carries `pdf-preview` from
before that call.

Archived with `plan.md` deleted — its two load-bearing facts already live elsewhere: the dropped
PDF-preview scope and the 4 MB narrowing are in the paragraphs above, and the lost-update reason for
batching the append into one action call is in commit `3f6c6c8a`'s message. Open manual checks moved
to `context/foundation/manual-checks.md`.
