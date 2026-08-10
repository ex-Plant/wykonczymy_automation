# AI receipt scan: extract the netto amount (EX-577) — Implementation Plan

## Overview

The receipt scan reads the brutto total and leaves Netto blank. `INVESTMENT_EXPENSE_NET` bills the
investor at `netAmount`, so the one transfer type that most needs the assist is the one where the
scan currently helps least — every netto figure is typed by hand even though the invoice prints it
next to the brutto total.

This change teaches the extraction to read a **printed** netto and writes it into the line item's
Netto field on scan. Nothing downstream changes: `mapLineItem` already decides whether a
`netAmount` is persisted, and `getNetAmountError` already validates it.

## Current State Analysis

The pipeline, end to end:

```
LineItemsField (picker / drop)          src/components/forms/form-fields/line-items-field.tsx
  → useInvoiceIngest                    HEIC-convert / compress, File custody keyed by row id
  → useReceiptGeneration                per-row, concurrency 4
      → extractReceiptAction            src/lib/actions/extract-receipt.ts  (post-processes: derives `filename`)
          → extractReceipt              src/lib/ai/openrouter.ts  (generateObject + receiptExtractionSchema)
      ← form.setFieldValue              description / amount / invoiceNote  ← netAmount is missing here
  → submit → mapLineItem(item, type)    drops netAmount on any type that doesn't bill netto
```

What already exists and does **not** need touching:

- `mapLineItem` (`src/components/forms/expense-form/map-line-item.ts:33`) writes `netAmount` only
  when `billsNetAmount(type)` — a value sitting in a brutto-typed row is dropped at submit.
- `getNetAmountError` (`src/lib/utils/validation.ts:21`) rejects a missing / non-positive netto and
  `netto > brutto`. Notably it **permits `netto === brutto`**.
- The form value exists on every row regardless of type
  (`bulk-expense-form.ts:19`); the Netto input is merely hidden behind
  `showsNetAmount = billsNetAmount(transferType)` (`line-items-field.tsx:152`).

What's missing: `receiptExtractionSchema` has no `netAmount` field, the prompt never mentions netto,
and `use-receipt-generation.ts:78-83` writes three fields and not a fourth.

## Desired End State

Scanning an invoice that prints a netto total fills the row's Netto field alongside Kwota. Scanning
a paragon that prints only a brutto total leaves Netto blank for the user. Switching the transfer
type to „Wydatek inwestycyjny netto" after a scan reveals the already-extracted netto rather than an
empty column.

Verify: `pnpm exec vitest run` on the three specs below, plus a manual scan of a real netto invoice
and a real brutto-only paragon.

### Key Discoveries:

- **The transfer type is a form-level field the user often picks _after_ scanning**, and a filled
  row is permanently ineligible for re-scan (`use-receipt-generation.ts:47` filters on
  `!row.description && !row.amount`). Gating the write on `billsNetAmount(type)` at scan time
  therefore produces an unrecoverable empty Netto column. Hence: write unconditionally.
- `extractReceiptAction` already post-processes the model's object (it derives `filename` at
  `extract-receipt.ts:39-42`), so it is the established home for a "clean up what the model
  returned" step.
- `getNetAmountError` is **type-aware** — it returns „Kwota netto jest wymagana" when the type bills
  netto — and the action has no transfer type. The server guard therefore cannot reuse it; it is a
  plain range check that must stay consistent with it by comment, not by shared code.
- `getNetAmountError` permits `netAmount === amount`, so a VAT-exempt / reverse-charge invoice
  (netto == brutto, genuinely printed that way) must be written, not discarded as a suspected echo.
- The schema's existing `amount: z.number().nullable()` with its "null is expressible" comment
  (`receipt-extraction-schema.ts:8-9`) is the pattern `netAmount` follows verbatim.

## What We're NOT Doing

- **No wydatek-form adjustments** (owner, 2026-08-10) — the Netto column's visibility rules, the
  scan-eligibility filter, any VAT-rate helper, and column layout are a later change.
- Not deriving netto from a VAT rate. Ever. See "Critical Implementation Details".
- Not making a filled row re-scannable, even though that is the natural companion fix — it changes
  scan behaviour for every field, not just netto, and belongs to the form change.
- Not touching `mapLineItem`, `getNetAmountError`, `expense-schema.ts`, or the persistence path.
- No E2E spec — the risk here is model output shape and a field write, both unit-reachable.

## Implementation Approach

One phase, four edits along one existing path: schema field → prompt bullet → server guard → form
write. It's ~40 lines; splitting the write-through into its own phase would buy a second commit and
nothing else.

## Critical Implementation Details

**A derived netto is worse than a blank one.** The model must copy a netto figure the document
prints (a „wartość netto" / „netto razem" total, or the netto column of a VAT summary table). It
must **not** compute `brutto − VAT` from a printed rate. A paragon that shows only a brutto total
and a „w tym VAT 23%" stamp returns `null`. The reason is asymmetric cost: a blank field costs the
user one typed number, whereas a wrong netto silently under- or over-bills the investor and nothing
downstream — not `getNetAmountError`, not the „Wydatki inwestycyjne" list, not the sheet sync —
detects it. Write the prompt bullet as an instruction to _copy_, with an explicit "do not calculate"
clause; a bullet phrased as "brutto − VAT" is itself an invitation to compute.

---

## Phase 1: Netto extraction, end to end

### Overview

Add `netAmount` to the extraction schema, teach the prompt to copy a printed netto, null out a
model-returned netto that can't be true, and write it into the row.

### Changes Required:

#### 1. Extraction schema

**File**: `src/lib/ai/receipt-extraction-schema.ts`

**Intent**: Make netto expressible in the model's structured output, with "the document prints no
netto" as a first-class value rather than a zero or an absent key.

**Contract**: `receiptExtractionSchema` gains `netAmount: z.number().nullable()`. Extend the
existing `amount` comment above the object rather than adding a second one — the two fields share
the same nullability rationale. `ReceiptExtractionT` widens by inference; no other type changes.

#### 2. Extraction prompt

**File**: `src/lib/ai/openrouter.ts`

**Intent**: Tell the model to copy a printed netto total and to return `null` when the document
prints none — never to calculate one.

**Contract**: One new bullet in `promptText` (`openrouter.ts:66-86`), placed directly after the
`- amount:` bullet so the two totals read together. It must state: the netto total as printed on the
document („wartość netto", „netto razem", or the netto column of the VAT summary); `null` if the
document prints no netto figure; and explicitly that it must not be calculated from a VAT rate or
from the brutto total. The `UNREADABLE_RECEIPT` branch at the top of the prompt also gains
`netAmount` to its "set these to null/empty" list, so an illegible image doesn't leave the field
unspecified.

#### 3. Server-side sanity guard

**File**: `src/lib/actions/extract-receipt.ts`

**Intent**: Discard a netto the form would reject anyway, so the user gets a blank field instead of
a red validation error on a value they never typed.

**Contract**: In `extractReceiptAction`, before the return, null a non-null `data.netAmount` when it
is `<= 0`, or when `data.amount` is non-null and `netAmount > data.amount`. Equality is **kept** —
`getNetAmountError` permits it and VAT-exempt invoices print it. A netto surviving alongside a
`null` brutto is also kept (the user types the brutto). Carry a comment naming
`getNetAmountError` as the invariant this mirrors, since the action can't call it (it has no
transfer type). The returned `ReceiptFillResultT` shape is unchanged apart from the inherited field.

#### 4. Receipt generation hook

**File**: `src/components/forms/expense-form/use-receipt-generation.ts`

**Intent**: Write the extracted netto into the row so it is there whichever type the user has picked
— or picks later.

**Contract**: Alongside the existing `amount` write (`use-receipt-generation.ts:79-82`), set
`lineItems[${index}].netAmount` to `String(data.netAmount)`, or `''` when null — the same
null→blank-string mapping `amount` uses. **Unconditional**: no `billsNetAmount` check here. A
comment must record why, because the omission looks like a bug to a later reader: the type is a
form-level field picked independently of the scan, a filled row can never be re-scanned
(`use-receipt-generation.ts:47`), and `mapLineItem` already prevents a brutto-typed row from
persisting the value.

### Deviation from plan (recorded during implementation):

The hook lives at `src/components/forms/expense-form/use-receipt-generation.ts`, not under
`forms/hooks/`. More importantly, the repo has **no React hook-testing infrastructure** (no
`@testing-library/react`, no jsdom), and installing it was out of bounds — on this machine a
`pnpm install` also risks the lightningcss/arm64 breakage. So instead of a `renderHook` spec, the
four `setFieldValue` writes were extracted into a pure `applyReceiptToRow(setFieldValue, index, data)`
(`src/components/forms/expense-form/apply-receipt-to-row.ts`) and specced directly with a stub
setter. Same behaviour under test — the unconditional netto write — with the existing runner, and
the "why no `billsNetAmount` gate" comment now sits on the function itself where a later reader
meets it.

### Success Criteria:

#### Automated Verification:

- Schema spec covers the new field: `pnpm exec vitest run src/__tests__/receipt-extraction-schema.test.ts` — a populated `netAmount` parses, `null` parses, an absent key is rejected, a string is rejected (mirroring the existing `amount` cases)
- Action spec covers the guard: `pnpm exec vitest run src/__tests__/extract-receipt-action.test.ts` — netto > brutto is nulled, netto <= 0 is nulled, netto == brutto survives, netto with a null brutto survives, `null` passes through untouched
- New spec `src/__tests__/components/forms/hooks/use-receipt-generation.test.ts` (mirroring the source path per AGENTS.md) asserts: a successful scan writes `netAmount` onto the row; it writes it on a brutto-typed form too; a `null` netto writes `''`
- Existing specs still pass: `pnpm exec vitest run src/__tests__/openrouter-fallback.test.ts src/__tests__/map-line-item.test.ts`

#### Manual Verification:

- Scanning a real netto invoice (Stimulsoft/Quartz PDF) on „Wydatek inwestycyjny netto" fills Kwota and Netto, and submits without a validation error
- Scanning a brutto-only paragon that shows „w tym VAT 23%" leaves Netto blank — the model does not compute one
- Scan first, then switch the type to „Wydatek inwestycyjny netto" → the Netto column appears already filled
- Scan on a brutto type, submit → the saved transfer carries no `netAmount`
- An illegible image still returns the `UNREADABLE_RECEIPT` sentinel with no netto

---

## Testing Strategy

### Unit Tests:

- `receipt-extraction-schema.test.ts` — the new field's parse contract, mirroring the four existing `amount` cases.
- `extract-receipt-action.test.ts` — the guard's five branches (over-brutto, non-positive, equality, null-brutto, null-netto). The spec already mocks `extractReceipt`, so a bogus netto is injectable directly.
- `use-receipt-generation.test.ts` (new) — the field write, including the unconditional-on-type case, which is the decision most likely to be "corrected" by a future reader.

### Integration Tests:

None. The change adds no DB or cross-boundary behaviour; `mapLineItem`'s persistence gate is already covered.

### Manual Testing Steps:

1. Scan a real netto invoice on „Wydatek inwestycyjny netto" — Netto matches the printed „wartość netto".
2. Scan a brutto-only paragon — Netto stays blank; confirm the model did not compute it.
3. Scan on a brutto type, then switch to the netto type — Netto is already filled.
4. Submit a brutto-typed scanned row and confirm no `netAmount` was persisted.

## Performance Considerations

One extra numeric field in the structured output; negligible against the vision call itself. The
prompt grows by one bullet, well inside `RECEIPT_TIMEOUT_MS` (30 s) and the existing token profile.

## Migration Notes

None. Nothing is persisted differently and no schema/DB change is involved — a scan writes to form
state only.

## Whole-tree Gate

Run once, after the phase lands.

- Type checking passes: `pnpm typecheck`
- Full unit suite passes: `pnpm test`

## References

- Linear: EX-577 — https://linear.app/ex-plant/issue/EX-577/ai-receipt-scan-also-extract-the-netto-amount
- Related: EX-567 / EX-573 (created `INVESTMENT_EXPENSE_NET` and the type spec table) — `context/archive/2026-07-24-netto-expense-type/`, `context/archive/2026-07-25-transfer-type-spec-table/`
- Prior receipt-scan work: `context/archive/2026-07-11-receipt-scan-line-items/`, `context/archive/2026-07-12-receipt-scan-heic-and-filesize/`
- Persistence gate: `src/components/forms/expense-form/map-line-item.ts:33`
- Validation invariant the server guard mirrors: `src/lib/utils/validation.ts:21`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Netto extraction, end to end

#### Automated

- [x] 1.1 Schema spec covers the new field (populated / null / absent / string) — e15c111f
- [x] 1.2 Action spec covers the guard (over-brutto, non-positive, equality, null-brutto, null-netto) — e15c111f
- [x] 1.3 New use-receipt-generation spec asserts the netAmount write, incl. unconditional-on-type — e15c111f
- [x] 1.4 Existing model-fallback + map-line-item specs still pass — e15c111f
