// `invoiceNote` is free text, but the AI receipt scan writes it in a known shape — numer faktury on
// line 1, then one line per pozycja (the prompt in `src/lib/ai/openrouter.ts`). That makes line 1 the
// part worth showing in a table cell; on a hand-typed note it is just the note's opening line.
export function firstNoteLine(note: string | null | undefined): string | null {
  if (!note) return null
  return note.split('\n').find((line) => line.trim().length > 0)?.trim() ?? null
}
