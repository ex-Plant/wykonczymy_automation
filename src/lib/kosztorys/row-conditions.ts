import { subcontractorPrice } from '@/lib/kosztorys/calc'
import { PLANE_LABELS } from '@/lib/kosztorys/constants'
import { measureDiscrepancy, rowTotalQtyDone } from '@/lib/kosztorys/settlement-rows'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import type { KosztorysStageT, KosztorysV2RowT, ToolPlaneT } from '@/lib/kosztorys/types'

export type RowConditionCtxT = {
  stages: KosztorysStageT[]
  // Whether the INVESTMENT has any material folded into robocizna (a „wliczony w robociznę" wydatek).
  // The one fact here that the kosztorys itself cannot answer — it lives on the wydatki side, with no
  // per-pozycja link — and the gate the overpaid-crew guard below hangs on. Required rather than
  // optional on purpose: a money guard that silently never fires because a host forgot to pass it is
  // worth less than no guard at all.
  hasSettledMaterial: boolean
}

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
  // Which price plane the condition judges, for the rows that judge one at all. The id rather than a
  // glyph, so the menu can mark the row with the same icon the view switcher uses without this module
  // — or the model above it — importing React.
  plane?: ToolPlaneT
  // Columns the condition is ABOUT. While it is engaged the grid shows them even if the column picker
  // has them unticked, because narrowing to „pozycje bez ceny j.m." with „Cena j.m." hidden is the
  // right rows with the missing thing still missing. It rides the gesture, so nothing here reaches the
  // stored visibility map. Lives on the condition rather than in a lookup beside the grid: a second
  // table is exactly how the header/picker drift that column-config.ts exists to prevent comes back.
  revealsColumns?: readonly string[]
  // A whole sentence for the „Problemy" row, replacing the „Pozycje … (n)" phrasing built from
  // `label`. Opens by naming the thing like every other row, then says WHY — a problem caused by an
  // investment-wide fact is unreadable as a bare noun phrase. Takes the count because it owns the
  // whole row: the plane rides in the same parentheses, and a second pair after it read as a typo.
  problemLabel?: (count: number) => string
  matches: (row: KosztorysV2RowT, ctx: RowConditionCtxT) => boolean
}

// Both the symptom and the two cells that compute it: the price is what is wrong, „Źródło ceny
// wykonawcy" and „Mnożnik" are the only way to make it right, so revealing the first alone shows a
// number nobody can act on (owner, explicit). The latter two only assemble in a subcontractor view, so
// naming them from the client view is a harmless no-op and needs no view check.
//
// Every price problem gets all three, „bez ceny j.m." included: the subcontractor stawki derive from
// the client price, so a pozycja missing that price is missing them too, and the fix is made in the
// same three cells whichever of the two the reader noticed first.
const PRICE_COLUMNS = ['price', 'priceMode', 'priceCoeff'] as const

// Named because the grid reads it too: the „Pozostało do rozliczenia" column exists only while this
// diagnostic is pressed, so the id is shared between the registry and the column assembly.
export const MEASURE_DIVERGED_CONDITION_ID = 'measure-diverged'

/**
 * The overpaid-crew guard (EX-708): on this plane, is the pozycja's executed work being settled at a
 * stawka that is a PERCENTAGE of the cena j.m.?
 *
 * Where material is priced into the cena j.m., a percentage hands the crew a cut of material they
 * never buy — the sheet-side incident this exists to stop. Only a flat 'amount' escapes: an inherited
 * multiplier and a hand-typed one are the same fault, so the test is „not 'amount'" rather than „no
 * override". The convention it enforces is the owner's — on such pozycje the stawka is typed as a
 * fixed kwota.
 *
 * Gated on work actually executed, and read through the etap that carries it: a pozycja holds a
 * stawka on both planes at once, and the etap is what says which one will really be paid. An etap
 * with no crew assigned counts toward BOTH — whichever crew turns out to have done it gets a cut of
 * the material, and undecided is the state most kosztorysy sit in while the work is happening, so
 * treating it as „nobody is paid" would silence the guard exactly when it still could be acted on.
 */
function settledAtPercentRate(
  row: KosztorysV2RowT,
  ctx: RowConditionCtxT,
  plane: ToolPlaneT,
): boolean {
  if (!ctx.hasSettledMaterial) return false
  const overrideType = plane === 'w_tools' ? row.wToolsOverrideType : row.ownToolsOverrideType
  if (overrideType === 'amount') return false
  return ctx.stages.some(
    (stage) =>
      (stage.plane === plane || stage.plane === null) && (row[stageKey(stage.id)] ?? 0) > 0,
  )
}

const percentRateProblemLabel = (plane: ToolPlaneT, count: number) =>
  `Stawki wykonawców liczone według formuły — ta inwestycja ma materiały wliczone w robociznę, ` +
  `więc stawki liczone ze współczynnika będą zawyżone i powinny być wpisane ręcznie ` +
  `(widok ${PLANE_LABELS[plane].toLowerCase()}, ${count})`

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
    revealsColumns: PRICE_COLUMNS,
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
  // Work booked against no offer. „Pozostało do rozliczenia" cannot report it — with a przedmiar of
  // zero the percentage cell renders „—", and reddening a dash is an alarm with no legible cause — so
  // the case surfaces here instead, where the row says in words what is wrong.
  {
    id: 'work-without-planned-qty',
    label: 'z wykonaną pracą bez przedmiaru',
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'defect',
    // The przedmiar alone: it is the missing cell, and it is where the fix is typed.
    revealsColumns: ['plannedQty'],
    matches: (row, ctx) => !(row.plannedQty > 0) && rowTotalQtyDone(row, ctx.stages, 'client') > 0,
  },
  // One entry per plane rather than one asking about the active view: a price exists on both planes for
  // every row, so a problem on the plane you are not looking at is still a problem — and in the client
  // view, where no subcontractor price renders at all, neither would ever surface.
  // „zbyt wysoką", naming the direction the guard actually refuses (owner, 2026-08-17): a stawka above
  // 80% of the client price. The guard's other branch — a negative stawka — is not that, but it is
  // typo-shaped rather than a real state of the kosztorys, so it rides along unnamed instead of
  // costing the label its one clear meaning.
  //
  // „w widoku …", not „— …": the plane IS a view here, and the reader has to switch to it to see the
  // stawka being judged. Engaged from „Inwestor" the row still narrows correctly, but the price on
  // screen is then the client's — the accepted cost of not switching the view out from under a click.
  {
    id: 'overpriced-w-tools',
    label: `ze zbyt wysoką stawką wykonawcy w widoku ${PLANE_LABELS.w_tools.toLowerCase()}`,
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'defect',
    plane: 'w_tools',
    revealsColumns: PRICE_COLUMNS,
    // The guard, not a restatement of the 80% rule: the filter and the red cell must never disagree.
    matches: (row) => checkSubcontractorPrice(row, 'w_tools') != null,
  },
  {
    id: 'overpriced-own-tools',
    label: `ze zbyt wysoką stawką wykonawcy w widoku ${PLANE_LABELS.own_tools.toLowerCase()}`,
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'defect',
    plane: 'own_tools',
    revealsColumns: PRICE_COLUMNS,
    matches: (row) => checkSubcontractorPrice(row, 'own_tools') != null,
  },
  // The other half of the same question, and the one an import creates: a praca whose cenniki
  // disagreed enters with an explicit 0 zł for the crew, and nothing else on screen says so — the cell
  // reads „0,00 zł" exactly like a deliberate one. `> 0` is the whole rule; the guard above judges a
  // price that exists, this one judges its absence.
  //
  // Gated on the client price so it never fires where „bez ceny j.m." already has: with no Cena j.m.
  // an auto row computes 0 zł by arithmetic, and on a fresh kosztorys that would flag every pozycja.
  // Exactly zero rather than „nie dodatnia", so a negative stawka belongs to the guard alone — read as
  // absence too it would be counted twice in the „Problemy" list and chased twice in the grid.
  {
    id: 'no-w-tools-price',
    label: `bez ceny wykonawcy w widoku ${PLANE_LABELS.w_tools.toLowerCase()}`,
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'defect',
    plane: 'w_tools',
    revealsColumns: PRICE_COLUMNS,
    matches: (row) => row.clientPrice > 0 && subcontractorPrice(row, 'w_tools') === 0,
  },
  {
    id: 'no-own-tools-price',
    label: `bez ceny wykonawcy w widoku ${PLANE_LABELS.own_tools.toLowerCase()}`,
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'defect',
    plane: 'own_tools',
    revealsColumns: PRICE_COLUMNS,
    matches: (row) => row.clientPrice > 0 && subcontractorPrice(row, 'own_tools') === 0,
  },
  // Split per plane like the two above, but for a different reason: there the stawka exists on both
  // planes whether you look or not, here the etap decides which stawka is the one being paid. So a
  // pozycja executed only „z narzędziami" appears under that half alone, and the pick switches the grid
  // to the view whose stawka is at fault.
  //
  // Named after the fault rather than the fix („od ceny z materiałem", not „nie kwotowa"): the stawka
  // is fine in itself, what is wrong is the price it is a percentage OF. Only ever counted on an
  // investment that has material folded into robocizna, so the name needs no further qualifier —
  // everywhere else the count is zero and the row never renders.
  {
    id: 'material-percent-rate-w-tools',
    label: `ze stawką wykonawcy od ceny z materiałem w widoku ${PLANE_LABELS.w_tools.toLowerCase()}`,
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'defect',
    plane: 'w_tools',
    revealsColumns: PRICE_COLUMNS,
    problemLabel: (count) => percentRateProblemLabel('w_tools', count),
    matches: (row, ctx) => settledAtPercentRate(row, ctx, 'w_tools'),
  },
  {
    id: 'material-percent-rate-own-tools',
    label: `ze stawką wykonawcy od ceny z materiałem w widoku ${PLANE_LABELS.own_tools.toLowerCase()}`,
    sectionLabel: null,
    kind: 'diagnostic',
    tone: 'defect',
    plane: 'own_tools',
    revealsColumns: PRICE_COLUMNS,
    problemLabel: (count) => percentRateProblemLabel('own_tools', count),
    matches: (row, ctx) => settledAtPercentRate(row, ctx, 'own_tools'),
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
  // Row ids the conditions may no longer remove — see `useConditionRowLatch`, which owns when a row
  // enters this set. Here it is deliberately a blunt bypass rather than a per-condition exemption:
  // the reason a row is held is that the user is working on it, and that reason is indifferent to
  // which of the engaged conditions stopped matching.
  latchedRowIds?: ReadonlySet<number>,
): KosztorysV2RowT[] {
  const active = [...engagedIds].map((id) => BY_ID.get(id)).filter((c) => c !== undefined)
  if (active.length === 0) return rows
  const keepers = active.filter((condition) => !isHider(condition))
  const hiders = active.filter(isHider)

  return rows.filter(
    (row) =>
      latchedRowIds?.has(row.id) ||
      (!hiders.some((condition) => condition.matches(row, ctx)) &&
        (keepers.length === 0 || keepers.some((condition) => condition.matches(row, ctx)))),
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

/**
 * The columns the engaged conditions are about, unioned. The grid shows these regardless of the column
 * picker's stored tick for as long as the gesture lasts; disengaging hands them straight back to
 * whatever the user had chosen, because nothing here is ever written down.
 *
 * It overrides the PICKER only. The money axis, the layer, the przedmiar gate and the client preview
 * answer different questions, and a filter that forced a brutto column onto someone reading netto
 * would be answering one of them on their behalf.
 */
export function columnsRevealedBy(engagedIds: Iterable<string>): ReadonlySet<string> {
  const revealed = new Set<string>()
  for (const id of engagedIds) {
    for (const column of BY_ID.get(id)?.revealsColumns ?? []) revealed.add(column)
  }
  return revealed
}

/**
 * The price view a condition is about, or undefined for the ones that are about no view in particular.
 *
 * Picking a problem switches the grid to it, which only became answerable once the „Problemy" list went
 * single-choice: with two engaged there was no such thing as „the" view. Until then the narrowing was
 * half a gesture — the right pozycje, with the wrong plane's prices in the column it had just revealed.
 */
export function conditionPlane(id: string): ToolPlaneT | undefined {
  return BY_ID.get(id)?.plane
}

/**
 * The plane the engaged set is being read on, or undefined when nothing engaged names one. Answerable
 * only because the „Problemy" list is single-choice; the first match wins rather than the set being
 * asserted to hold one, since a stale id from an older registry must not make the grid unreadable.
 */
export function engagedPlane(engagedIds: Iterable<string>): ToolPlaneT | undefined {
  for (const id of engagedIds) {
    const plane = conditionPlane(id)
    if (plane) return plane
  }
  return undefined
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
