import { PLANE_LABELS } from '@/lib/kosztorys/constants'
import { measureDiscrepancy, rowTotalQtyDone } from '@/lib/kosztorys/settlement-rows'
import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

export type RowConditionCtxT = { stages: KosztorysStageT[] }

// 'client' is a third kind, not a third mechanism: it hides like a filter, but it is engaged by the
// investment's stored client-view settings rather than by a reading gesture, so the „Filtry" menu
// (which lists `kind === 'filter'`) cannot show it and the owner cannot untick it for themselves.
export type RowConditionKindT = 'filter' | 'diagnostic' | 'client'

export type RowConditionT = {
  id: string
  // A bare noun phrase describing the row, so it reads after „Pozycje " (the menu) and „Brak pozycji "
  // (the empty state).
  label: string
  // How it reads when it lifts to whole sekcje in the „Filtry" menu; null = it does not lift, which
  // is every kind but 'filter' — the menu is the only thing that folds sections.
  sectionLabel: string | null
  // 'filter' = a visibility toggle in the „Filtry" menu, ticked by default: the tick means „widoczne",
  // exactly like the column and section pickers, and UNticking it hides what it matches. That is why
  // filters come in complementary pairs („bez przedmiaru" / „z przedmiarem") — a picker with only one
  // half of an axis cannot express „pokaż mi tylko te drugie".
  // 'diagnostic' = a defect to close: it lives in the toolbar with a count, vanishes at zero, and when
  // engaged keeps ONLY what it matches. It is not a picker row — it answers „pokaż mi wyłącznie to, co
  // jest zepsute" — so it stays off by default and out of the menu.
  kind: RowConditionKindT
  // How a diagnostic reads, which is not the same question as what it matches. 'defect' = something is
  // wrong and someone has to fix it. 'worklist' = nothing is broken; the count is work still to do and
  // typing it away is the normal course of the job, not the clearing of a fault. Ignored by filters.
  tone?: 'defect' | 'worklist'
  matches: (row: KosztorysV2RowT, ctx: RowConditionCtxT) => boolean
}

// Named because the grid reads it too: the „Pozostało do rozliczenia" column exists only while this
// diagnostic is pressed, so the id is shared between the registry and the column assembly.
export const MEASURE_DIVERGED_CONDITION_ID = 'measure-diverged'

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
    sectionLabel: 'Sekcje bez przedmiaru',
    kind: 'filter',
    matches: (row) => !(row.plannedQty > 0),
  },
  {
    id: 'has-planned-qty',
    label: 'z przedmiarem',
    sectionLabel: 'Sekcje z przedmiarem',
    kind: 'filter',
    matches: (row) => row.plannedQty > 0,
  },
  {
    id: 'no-measured-qty',
    // Not „bez pomiaru z natury": the sheet has such a column, the grid does not — here the pomiar is
    // the sum of the ten etap columns, so the name has to point at something the user can see.
    label: 'bez wykonanej pracy',
    sectionLabel: 'Sekcje bez wykonanej pracy',
    kind: 'filter',
    // The pomiar IS Σ etapów (EX-494), at the client plane like every other whole-row reading.
    matches: (row, ctx) => !(rowTotalQtyDone(row, ctx.stages, 'client') > 0),
  },
  {
    id: 'has-measured-qty',
    label: 'z wykonaną pracą',
    sectionLabel: 'Sekcje z wykonaną pracą',
    kind: 'filter',
    matches: (row, ctx) => rowTotalQtyDone(row, ctx.stages, 'client') > 0,
  },
  {
    id: 'client-empty',
    label: 'bez przedmiaru i bez wykonanej pracy',
    // Never lifts to sekcje: „Zwiń puste sekcje" is a reading gesture in a menu the client view does
    // not render, so a label here would only buy a per-render pass over the whole dataset for a set
    // nothing reads.
    sectionLabel: null,
    kind: 'client',
    // One rule rather than the two filters above, because each of those is safe for only one of the
    // two figures a client reads: hiding no-work rows drops a priced-but-unstarted pozycja while the
    // przedmiar total still counts it, and hiding no-przedmiar rows drops a pozycja carrying etap work
    // while the executed total still counts it. A row empty on BOTH axes adds zero to both totals, so
    // hiding it moves no figure and needs no warning.
    matches: (row, ctx) =>
      !(row.plannedQty > 0) && !(rowTotalQtyDone(row, ctx.stages, 'client') > 0),
  },
  {
    id: 'no-client-price',
    label: 'bez ceny j.m.',
    // A defect, not a state: a section fully executed but unpriced is exactly what must not be folded
    // away — that is the bug „Zwiń puste sekcje" had.
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'defect',
    // The only hand-typed price; the subcontractor planes derive from it through the coefficients.
    matches: (row) => !(row.clientPrice > 0),
  },
  {
    id: MEASURE_DIVERGED_CONDITION_ID,
    // „do rozpisania", not „z rozjazdem": the reference figure exists only where an old sheet was
    // imported, and the gap it names is work not yet entered — not a fault. Same wording as the
    // „Pozostało do rozliczenia" column it points at.
    label: 'z pomiarem do rozpisania na etapy',
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'worklist',
    matches: (row, ctx) => measureDiscrepancy(row, ctx.stages) != null,
  },
  // One entry per plane rather than one asking about the active view: a price exists on both planes for
  // every row, so a problem on the plane you are not looking at is still a problem — and in the client
  // view, where no subcontractor price renders at all, neither would ever surface.
  // „nieprawidłową", not „zawyżoną": the same guard also refuses a negative price.
  {
    id: 'overpriced-w-tools',
    label: `z nieprawidłową ceną wykonawcy — ${PLANE_LABELS.w_tools.toLowerCase()}`,
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'defect',
    // The guard, not a restatement of the 80% rule: the filter and the red cell must never disagree.
    matches: (row) => checkSubcontractorPrice(row, 'w_tools') != null,
  },
  {
    id: 'overpriced-own-tools',
    label: `z nieprawidłową ceną wykonawcy — ${PLANE_LABELS.own_tools.toLowerCase()}`,
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'defect',
    matches: (row) => checkSubcontractorPrice(row, 'own_tools') != null,
  },
]

const BY_ID = new Map(ROW_CONDITIONS.map((condition) => [condition.id, condition]))

// Frozen module-level instances, so the sets below are referentially stable and the editor's memos
// don't recompute on every render.
const CLIENT_EMPTY_CONDITION_IDS: ReadonlySet<string> = new Set(['client-empty'])
const NO_CONDITION_IDS: ReadonlySet<string> = new Set()

/**
 * What a client's document engages. Every 'filter' and 'diagnostic' here is the company's own
 * bookkeeping question and is suppressed wholesale under the preview — the sole exception is the
 * 'client' condition, which the client did not choose either: it is the owner's stored decision
 * about what this document contains.
 *
 * Lives beside the registry rather than inside the editor hook that reads it, because the mapping is
 * the domain fact „which conditions may reach a client" — invisible to anyone refactoring the hook,
 * and it has been silently dropped by exactly that kind of refactor once already.
 */
export function clientConditionIds(hideEmptyRows: boolean | undefined): ReadonlySet<string> {
  return hideEmptyRows ? CLIENT_EMPTY_CONDITION_IDS : NO_CONDITION_IDS
}

/**
 * The rows left on screen once the engaged conditions apply. „Engaged" is the non-default state, and
 * it means opposite things per kind because the two are asked differently — a filter is a picker row
 * that starts ticked, a diagnostic is a button that starts off:
 *
 *  • 'filter' — engaged = UNticked in the menu, so it removes its matches. They stack (AND): each one
 *    you untick takes more away, exactly like unticking sections or columns.
 *  • 'diagnostic' — engaged = pressed in the toolbar, so it keeps ONLY its matches. Together they show
 *    the UNION (OR). Under AND, „bez ceny j.m. (9)" and „z rozjazdem pomiaru (5)" would ask for
 *    pozycje that are both at once — almost always none — and the grid would go blank while the two
 *    badges promised 14 things to fix. Each badge counts its own condition, so the grid shows the sum.
 *
 * An empty set is a no-op, and an id nobody knows is ignored rather than matching nothing — a filter
 * persisted under a condition that has since been removed must not hide the whole kosztorys.
 */
// Keepers are named explicitly and everything else hides: a fourth kind added later must not fall
// through into „keep only what it matches", which would blank the grid rather than hide a row. The
// empty state asks the same question through `engagedHiders`, so both sides gain that kind at once.
const isHider = (condition: RowConditionT) => condition.kind !== 'diagnostic'

export function applyRowConditions(
  rows: KosztorysV2RowT[],
  engagedIds: Iterable<string>,
  ctx: RowConditionCtxT,
): KosztorysV2RowT[] {
  const active = [...engagedIds].map((id) => BY_ID.get(id)).filter((c) => c !== undefined)
  if (active.length === 0) return rows
  const keepers = active.filter((condition) => !isHider(condition))
  const hiders = active.filter(isHider)

  return rows.filter(
    (row) =>
      !hiders.some((condition) => condition.matches(row, ctx)) &&
      (keepers.length === 0 || keepers.some((condition) => condition.matches(row, ctx))),
  )
}

/**
 * „bez przedmiaru, bez ceny j.m. i z rozjazdem pomiaru" — the labels as one readable Polish list.
 * The conjunction is the caller's because it has to match how the conditions actually combined: „i"
 * for the filters that stack, „ani" after a negation for the diagnostics that union.
 */
export function listLabels(conditions: readonly RowConditionT[], conjunction = 'i'): string {
  const labels = conditions.map((condition) => condition.label)
  if (labels.length < 2) return labels[0] ?? ''
  return `${labels.slice(0, -1).join(', ')} ${conjunction} ${labels[labels.length - 1]}`
}

/** The engaged ids of one kind, in registry order — the menu and the toolbar each own one kind. */
export function engagedConditionsOfKind(
  engagedIds: ReadonlySet<string>,
  kind: RowConditionKindT,
): RowConditionT[] {
  return ROW_CONDITIONS.filter(
    (condition) => condition.kind === kind && engagedIds.has(condition.id),
  )
}

/** The engaged conditions that REMOVE rows — what an empty grid has to explain. */
export function engagedHiders(engagedIds: ReadonlySet<string>): RowConditionT[] {
  return ROW_CONDITIONS.filter((condition) => isHider(condition) && engagedIds.has(condition.id))
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
