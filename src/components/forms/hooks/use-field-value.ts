import { useStore } from '@/components/forms/hooks/form-hooks'

// Reads one field straight off the form store instead of through `form.AppField`'s render prop,
// because a caller that filters an option list has to know the current selection *before* the field
// renders — an empty list swaps the whole control out, so there is no field to read from.
//
// Both casts are the price of not naming the form's value shape: the store carries it, and this
// helper is deliberately blind to it so one field component can serve several forms. The name is
// assumed to be a flat key — a nested path ('a.b') would index `values` literally and return
// undefined, silently dropping the selection. Every call site passes a top-level field name; keep it
// that way, or teach this helper to walk the path.
export function useFieldValue(form: { store: unknown }, name: string): string | undefined {
  return useStore(
    form.store as Parameters<typeof useStore>[0],
    (state: unknown) => (state as { values: Record<string, string> }).values[name],
  )
}
