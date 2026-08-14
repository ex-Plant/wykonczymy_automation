import { measureDiscrepancy, rowTotalQtyDone } from '@/lib/kosztorys/settlement-rows'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

export type RowConditionCtxT = { stages: KosztorysStageT[] }

export type RowConditionKindT = 'filter' | 'diagnostic'

export type RowConditionT = {
  id: string
  // How the condition reads when it hides pozycje.
  label: string
  // How it reads when it folds sekcje; null = it does not lift to a section.
  sectionLabel: string | null
  // 'filter' = a working narrowing, lives in the „Filtry" menu.
  // 'diagnostic' = a defect to close, lives in the toolbar with a count and vanishes at zero.
  kind: RowConditionKindT
  matches: (row: KosztorysV2RowT, ctx: RowConditionCtxT) => boolean
}

/**
 * Every rule-based way the editor hides a row, in display order. Text search is deliberately not
 * here: it takes an argument, so it is not a named condition anyone can tick.
 *
 * Each predicate is written `!(x > 0)` rather than `x === 0`, so a null, an undefined and a negative
 * all read as „nie ma" — the grid writes null into a cleared cell.
 */
export const ROW_CONDITIONS: RowConditionT[] = [
  {
    id: 'no-planned-qty',
    label: 'bez przedmiaru',
    sectionLabel: 'Zwiń sekcje bez przedmiaru',
    kind: 'filter',
    matches: (row) => !(row.plannedQty > 0),
  },
  {
    id: 'no-measured-qty',
    label: 'bez pomiaru z natury',
    sectionLabel: 'Zwiń sekcje bez wykonanych prac',
    kind: 'filter',
    // The pomiar IS Σ etapów (EX-494), at the client plane like every other whole-row reading.
    matches: (row, ctx) => !(rowTotalQtyDone(row, ctx.stages, 'client') > 0),
  },
  {
    id: 'no-client-price',
    label: 'bez ceny j.m.',
    // A defect, not a state: a section fully executed but unpriced is exactly what must not be folded
    // away — that is the bug „Zwiń puste sekcje" had.
    sectionLabel: null,
    kind: 'diagnostic',
    // The only hand-typed price; the subcontractor planes derive from it through the coefficients.
    matches: (row) => !(row.clientPrice > 0),
  },
  {
    id: 'measure-diverged',
    label: 'rozjazd pomiaru z arkusza',
    sectionLabel: null,
    kind: 'diagnostic',
    matches: (row, ctx) => measureDiscrepancy(row, ctx.stages) != null,
  },
]

const BY_ID = new Map(ROW_CONDITIONS.map((condition) => [condition.id, condition]))

/**
 * The active conditions, combined with AND. An empty set is a no-op, and an id nobody knows is
 * ignored rather than matching nothing — a filter persisted under a condition that has since been
 * removed must not hide the whole kosztorys.
 */
export function rowsMatchingConditions(
  rows: KosztorysV2RowT[],
  activeIds: Iterable<string>,
  ctx: RowConditionCtxT,
): KosztorysV2RowT[] {
  const active = [...activeIds].map((id) => BY_ID.get(id)).filter((c) => c !== undefined)
  if (active.length === 0) return rows
  return rows.filter((row) => active.every((condition) => condition.matches(row, ctx)))
}

// Counts run over the full dataset, never over what survived the filter — a count of the survivors
// would be a count of itself and could never reach zero to say the problem is gone.
export function countMatching(
  rows: KosztorysV2RowT[],
  conditionId: string,
  ctx: RowConditionCtxT,
): number {
  const condition = BY_ID.get(conditionId)
  if (!condition) return 0
  return rows.reduce((count, row) => (condition.matches(row, ctx) ? count + 1 : count), 0)
}

/**
 * Lift a condition to whole sections: those where EVERY pozycja matches (`∀`). Not „suma = 0" — a
 * sum can reach zero by accident, „wszystkie co do jednej" cannot.
 *
 * A section with no rows cannot qualify vacuously; it simply never appears in `rows`.
 */
export function sectionIdsWhereAllMatch(
  rows: KosztorysV2RowT[],
  conditionId: string,
  ctx: RowConditionCtxT,
): Set<number> {
  const condition = BY_ID.get(conditionId)
  const result = new Set<number>()
  if (!condition) return result
  const failed = new Set<number>()
  for (const row of rows) {
    if (condition.matches(row, ctx)) result.add(row.sectionId)
    else failed.add(row.sectionId)
  }
  for (const sectionId of failed) result.delete(sectionId)
  return result
}
