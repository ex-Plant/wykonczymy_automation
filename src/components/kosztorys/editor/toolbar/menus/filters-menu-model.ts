import { ROW_CONDITIONS } from '@/lib/kosztorys/row-conditions'
import { STAGE_CONDITIONS } from '@/lib/kosztorys/stage-conditions'

export type ProblemToggleT = {
  id: string
  label: string
  active: boolean
}

type ArgsT = {
  engagedIds: ReadonlySet<string>
  // Per condition id, how many pozycje / etapy are in that state across the whole dataset.
  counts: ReadonlyMap<string, number>
  collapsedSectionCount: number
  // How many „Prace" filters are currently unticked — the menu's own half of the trigger count.
  untickedFilterCount: number
}

/**
 * The „Problemy" arithmetic, away from the component: which problem rows the menu offers, what the
 * trigger counts, and whether it warns. Extracted because this is the part worth testing and the
 * markup around it is not.
 *
 * Both registries feed one list. They stay separate registries because rows and etapy are different
 * subjects, but to the reader they are one question — „co jest tu zepsute" — so they read as one group
 * distinguished only by the noun each row names.
 */
export function filtersMenuModel({
  engagedIds,
  counts,
  collapsedSectionCount,
  untickedFilterCount,
}: ArgsT): {
  problemToggles: ProblemToggleT[]
  triggerCount: number
  hasProblems: boolean
} {
  const rowProblems = ROW_CONDITIONS.filter((condition) => condition.kind === 'diagnostic').map(
    (condition) => ({ id: condition.id, noun: 'pozycje', label: condition.label }),
  )
  const stageProblems = STAGE_CONDITIONS.map((condition) => ({
    id: condition.id,
    noun: 'etapy',
    label: condition.label,
  }))

  const problems = [...rowProblems, ...stageProblems].map((problem) => ({
    ...problem,
    count: counts.get(problem.id) ?? 0,
  }))

  return {
    // Imperative („Pokaż pozycje …"), because the tick means the opposite of what it means in „Prace":
    // there a tick keeps something visible, here it narrows the grid down to the row's own matches.
    // A row with nothing to report is absent rather than shown at zero — a problem list is read for
    // what is on it, and six permanently-zero rows would bury the one that isn't.
    problemToggles: problems
      .filter((problem) => problem.count > 0)
      .map((problem) => ({
        id: problem.id,
        label: `Pokaż ${problem.noun} ${problem.label} (${problem.count})`,
        active: engagedIds.has(problem.id),
      })),
    // Engaged problems count too: once the diagnostics moved off the toolbar, nothing outside this
    // menu says a problem filter is on, and a narrowed grid with an unremarkable trigger reads as a
    // kosztorys that lost rows.
    triggerCount:
      untickedFilterCount +
      collapsedSectionCount +
      problems.filter((problem) => engagedIds.has(problem.id)).length,
    // Reports the DATA, not the gesture: the triangle answers „czy coś jest tu zepsute", which is true
    // before anyone clicks anything. Every problem counts toward it, „z pomiarem do rozpisania na
    // etapy" included (owner) — work not yet entered is still something the kosztorys is waiting on.
    hasProblems: problems.some((problem) => problem.count > 0),
  }
}
