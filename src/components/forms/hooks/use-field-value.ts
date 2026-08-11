import { useStore } from '@/components/forms/hooks/form-hooks'

// Reads one field straight off the form store instead of through `form.AppField`'s render prop,
// because a caller that filters an option list has to know the current selection *before* the field
// renders — an empty list swaps the whole control out, so there is no field to read from.
//
// The cast is the price of the untyped `form: any` these field components take. It assumes `name` is
// a flat key: a nested path ('a.b') would index `values` literally and return undefined, silently
// dropping the selection. Every call site passes a top-level field name; keep it that way, or teach
// this helper to walk the path.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useFieldValue(form: any, name: string): string | undefined {
  return useStore(
    form.store,
    (state: unknown) => (state as { values: Record<string, string> }).values[name],
  )
}
