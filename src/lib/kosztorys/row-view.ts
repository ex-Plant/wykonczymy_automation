import type { PriceViewT } from '@/lib/kosztorys/calc'
import { groupBySection } from '@/lib/kosztorys/row-ops'
import { applyRowConditions } from '@/lib/kosztorys/row-conditions'
import { columnSortValue } from '@/lib/kosztorys/sort-value'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

// Parity with v1.
export function filterRows(rows: KosztorysV2RowT[], query: string): KosztorysV2RowT[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter(
    (r) =>
      (r.description ?? '').toLowerCase().includes(q) ||
      r.sectionName.toLowerCase().includes(q) ||
      (r.unit ?? '').toLowerCase().includes(q),
  )
}

export type SortDirT = 'asc' | 'desc'

// Which set of rows one sort orders: each section on its own, or the whole kosztorys as one list.
// Chosen per sort in the column header menu — the two scopes are separate commands, never a mode.
export type SortScopeT = 'section' | 'global'

// Sort by the accessor's value; strings by locale (pl), numbers numerically. Returns a new array.
// Decorate-sort-undecorate: getValue can be an O(stages) reduce (the "remaining" key), and calling
// it inside the comparator would re-evaluate it ~2·n·log(n) times — compute it once per row instead.
//
// A null key renders as "—" (fmtOrDash), so it has no place in the order: sorted numerically it
// would land as 0 and the dash would masquerade as a settled row. Nulls sink to the bottom under
// BOTH directions — `sign` deliberately does not touch that branch, or "desc" would float them up.
export function sortRows(
  rows: KosztorysV2RowT[],
  getValue: (row: KosztorysV2RowT) => string | number | null,
  dir: SortDirT,
): KosztorysV2RowT[] {
  const sign = dir === 'asc' ? 1 : -1
  const decorated = rows.map((row) => ({ row, key: getValue(row) }))
  decorated.sort((a, b) => {
    if (a.key == null || b.key == null) {
      if (a.key == null && b.key == null) return 0
      return a.key == null ? 1 : -1
    }
    if (typeof a.key === 'string' || typeof b.key === 'string') {
      return sign * String(a.key).localeCompare(String(b.key), 'pl')
    }
    return sign * (a.key - b.key)
  })
  return decorated.map((d) => d.row)
}

// The grid's sort, applied per section instead of across the whole sheet. A flat sort scatters a
// section's rows through the list, and a section band presumes its rows are contiguous — which is
// why sorting used to drop the bands (header, subtotal, collapse) entirely. Grouping first keeps
// them: the sections stay in their own order (first-appearance = display_order, as the tree
// delivers them) and only the rows inside each one move.
//
// Delegates to sortRows per group rather than re-implementing the comparator, so null-sinking and
// the `pl` collation cannot drift between the two.
export function sortRowsWithinSections(
  rows: KosztorysV2RowT[],
  getValue: (row: KosztorysV2RowT) => string | number | null,
  dir: SortDirT,
): KosztorysV2RowT[] {
  // groupBySection's Map iterates in insertion order, so the sections come back in the order they
  // first appeared.
  return [...groupBySection(rows).values()].flatMap((group) => sortRows(group, getValue, dir))
}

// The rows the grid shows: search, then the engaged conditions, then the sort. The order is the
// contract — searching after a sort would still yield the same set, but the sort's comparator runs
// over every row instead of the handful that survived, and a condition applied after the sort would
// leave the section blocks it thins in a different order than the fold logic downstream expects.
// Sections themselves are never filtered here: hiding one is a fold, applied later by
// buildSectionBandRows so the band survives its own collapse.
export function buildViewRows(input: {
  rows: KosztorysV2RowT[]
  search: string
  engagedConditionIds: ReadonlySet<string>
  sort: { field: string; dir: SortDirT; scope: SortScopeT } | null
  view: PriceViewT
  stages: KosztorysStageT[]
}): KosztorysV2RowT[] {
  const { rows, search, engagedConditionIds, sort, view, stages } = input
  const filtered = applyRowConditions(filterRows(rows, search), engagedConditionIds, { stages })
  if (!sort) return filtered
  const getValue = (row: KosztorysV2RowT) => columnSortValue(row, sort.field, view, stages)
  return sort.scope === 'global'
    ? sortRows(filtered, getValue, sort.dir)
    : sortRowsWithinSections(filtered, getValue, sort.dir)
}
