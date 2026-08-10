# AI receipt scan: extract the netto amount (EX-577) — Plan Brief

> Full plan: `context/changes/2026-08-10-receipt-scan-netto-extraction/plan.md`

## What & Why

`INVESTMENT_EXPENSE_NET` bills the investor at `netAmount`, but the AI receipt scan reads only the
brutto total — so the one transfer type that most needs the assist is the one where the scan helps
least, and every netto figure is typed by hand even though the invoice prints it right next to the
brutto. This change teaches the scan to read a printed netto and fill the row's Netto field.

## Starting Point

The scan pipeline (`LineItemsField → useInvoiceIngest → useReceiptGeneration → extractReceiptAction
→ extractReceipt`) writes three fields back into the row: description, amount, invoiceNote.
`receiptExtractionSchema` has no netto field and the prompt never mentions one. Everything
downstream already handles netto: `mapLineItem` gates persistence on `billsNetAmount(type)`, and
`getNetAmountError` validates the figure. Only the intake is manual.

## Desired End State

Scanning an invoice that prints a netto total fills Netto alongside Kwota. Scanning a paragon that
prints only a brutto total leaves Netto blank for the user to type. Switching the transfer type to
„Wydatek inwestycyjny netto" after a scan reveals an already-filled Netto column instead of an empty
one.

## Key Decisions Made

| Decision                              | Choice                                                                      | Why                                                                                                                                                                                                                                  | Source |
| ------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Write gate                            | Write `netAmount` into the row **unconditionally**, not only on netto types | The type is a form-level field the user often picks _after_ scanning, and a filled row can never be re-scanned — gating at scan time leaves an unrecoverable empty column. `mapLineItem` already blocks persistence on brutto types. | Plan   |
| Guard site                            | Sanity-check in `extractReceiptAction` (server)                             | It already post-processes the model's object (it derives `filename` there), and the existing action spec gives a ready test seam; the client hook stays a pure writer.                                                               | Plan   |
| No printed netto                      | Return `null` — never derive `brutto − VAT`                                 | A blank field costs one typed number; a derived-wrong netto silently under- or over-bills the investor and nothing downstream catches it.                                                                                            | Plan   |
| netto == brutto                       | Write it                                                                    | `getNetAmountError` already permits equality, and VAT-exempt / reverse-charge invoices genuinely print it — discarding it would contradict the form's own rule.                                                                      | Plan   |
| Guard can't reuse `getNetAmountError` | Plain range check + a comment naming the invariant                          | `getNetAmountError` is type-aware and the action has no transfer type.                                                                                                                                                               | Plan   |

## Scope

**In scope:**

- `netAmount: z.number().nullable()` in `receiptExtractionSchema`
- A prompt bullet that copies a printed netto and forbids computing one
- A server-side guard nulling a netto the form would reject
- The `setFieldValue` write in `use-receipt-generation`
- Unit specs for all three

**Out of scope:**

- All wydatek-form adjustments (owner, 2026-08-10) — Netto column visibility, the scan-eligibility
  filter, a VAT-rate helper, layout. A later change.
- Making a filled row re-scannable (changes scan behaviour for every field, not just netto)
- `mapLineItem`, `getNetAmountError`, `expense-schema.ts`, the persistence path
- E2E — the risk is model output shape and a field write, both unit-reachable

## Architecture / Approach

Four small edits along one existing path. The model gains a nullable `netAmount`; the action cleans
it up in the same place it already cleans up `filename`; the hook writes it into form state next to
`amount`. Nothing new is persisted and no boundary moves — the persistence decision stays where it
already lives, in `mapLineItem`.

## Phases at a Glance

| Phase                           | What it delivers                                                        | Key risk                                                                                                                                                                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Netto extraction, end to end | Schema field, prompt bullet, server guard, the form write + three specs | The model derives a netto from a VAT rate instead of copying a printed one — a confident wrong number that mis-bills the client. Secondary: the unconditional write reads as a missing `billsNetAmount` check to a later reader, so the comment has to carry the reasoning |

**Prerequisites:** a clean branch — the working tree currently carries the kosztorys note-cell-overlay
change, which must land or be stashed first. Manual verification needs a real netto invoice PDF and a
brutto-only paragon.
**Estimated effort:** one session, ~40 lines plus three specs — one phase, one commit.

## Open Risks & Assumptions

- The prompt is the whole safety mechanism against a derived netto — there is no downstream detector
  for a plausible-but-wrong figure. Manual verification against a brutto-only paragon is the check
  that matters most.
- The scan model is the cheap on-trial `google/gemini-3.1-flash-lite`; reading a VAT summary table is
  a harder task than reading the total-due line, so netto extraction may prove less reliable than
  brutto. If it does, the fallback is a prompt tightening, not a schema change.
- An extracted netto sits in hidden form state on brutto types. Harmless (dropped at submit) but it
  means the form holds a value the user never sees.

## Success Criteria (Summary)

- Scanning a netto invoice fills Netto with the document's printed figure — no hand-typing.
- Scanning a brutto-only paragon leaves Netto blank rather than guessing.
- Choosing the netto type after a scan reveals a filled Netto column.
