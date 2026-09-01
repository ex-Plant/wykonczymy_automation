import { useStore } from '@/components/forms/hooks/form-hooks'

// Reads one field straight off the form store instead of through `form.AppField`'s render prop, for
// a caller that has to know a value BEFORE (or outside) the field that owns it renders — one that
// swaps the whole control out on an empty option list, or one that decides whether a sibling field
// exists at all.
//
// `name` is assumed to be a flat key — a nested path ('a.b') would index `values` literally and
// return undefined, silently dropping the selection. Keep call sites on top-level names, or teach
// this helper to walk the path.
export function useFieldValue<ValueT = string>(
  form: { store: unknown },
  name: string,
): ValueT | undefined {
  return useStore(
    form.store as Parameters<typeof useStore>[0],
    (state: unknown) => (state as { values: Record<string, ValueT> }).values[name],
  )
}
