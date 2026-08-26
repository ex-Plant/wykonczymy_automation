import type { ColumnDef } from '@tanstack/react-table'

// TanStack resolves a string accessorKey into the column id; a function accessor has no key and must
// carry an explicit id. Reading the DEFS rather than the table is what makes this the declared order:
// the table's own leaf list comes back already permuted by `columnOrder`, and both the order state
// and the reorder dialog's base ranks have to be scaled against the unpermuted list.
export function leafColumnIds<TData>(columns: ColumnDef<TData, unknown>[]): string[] {
  return columns.map(
    (column) => column.id ?? ('accessorKey' in column ? String(column.accessorKey) : ''),
  )
}
