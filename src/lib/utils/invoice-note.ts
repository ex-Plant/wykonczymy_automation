// The AI receipt scan writes the invoice note as: numer faktury on line 1, then one line per
// pozycja (`src/lib/ai/receipt-extraction-schema.ts`). A table cell shows only that first line —
// the rest is tooltip material.
export function invoiceNumberFromNote(note: string | null | undefined): string | null {
  if (!note) return null
  return note.split('\n').find((line) => line.trim().length > 0)?.trim() ?? null
}
