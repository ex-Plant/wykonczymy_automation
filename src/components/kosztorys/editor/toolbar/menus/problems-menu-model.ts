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
}

/**
 * The „Problemy" arithmetic, away from the component: which problems there are to offer and which one
 * is engaged. Extracted because this is the part worth testing and the markup around it is not.
 *
 * Both registries feed one list. They stay separate registries because pozycje and etapy are different
 * subjects, but to the reader they are one question — „co jest tu zepsute" — so they read as one list
 * distinguished only by the noun each row names.
 *
 * One problem at a time, which is why there is no union arithmetic here any more: two engaged at once
 * showed the sum of two unrelated sets with nothing on screen saying which row came from which, and
 * the reveal from phase 4 made that worse — the columns of both problems arrived together.
 */
export function problemsMenuModel({ engagedIds, counts }: ArgsT): {
  problemToggles: ProblemToggleT[]
  hasProblems: boolean
} {
  const rowProblems = ROW_CONDITIONS.filter((condition) => condition.kind === 'diagnostic').map(
    (condition) => ({
      id: condition.id,
      noun: 'pozycje',
      label: condition.label,
    }),
  )
  const stageProblems = STAGE_CONDITIONS.map((condition) => ({
    id: condition.id,
    noun: 'etapy',
    label: condition.label,
  }))

  const problems = [...rowProblems, ...stageProblems].map((problem) => ({
    ...problem,
    // How many pozycje are in that state, not how many the row is currently showing — a count of the
    // survivors would be a count of itself and could never reach zero to say the problem is gone.
    count: counts.get(problem.id) ?? 0,
  }))

  return {
    // Imperative („Pokaż pozycje …"), because picking one narrows the grid to its matches rather than
    // keeping something visible. A problem with nothing to report is absent rather than shown at zero —
    // a problem list is read for what is on it, and six permanently-zero rows would bury the one that
    // isn't.
    problemToggles: problems
      .filter((problem) => problem.count > 0)
      .map((problem) => ({
        id: problem.id,
        label: `Pokaż ${problem.noun} ${problem.label} (${problem.count})`,
        active: engagedIds.has(problem.id),
      })),
    // Reports the DATA, not the gesture: it answers „czy coś jest tu zepsute", which is true before
    // anyone clicks anything — and it is what decides whether the button exists at all. Every problem
    // counts toward it, „z pomiarem do rozpisania na etapy" included (owner): work not yet entered is
    // still something the kosztorys is waiting on.
    hasProblems: problems.some((problem) => problem.count > 0),
  }
}

/** Every problem id, engaged or not — what an exclusive pick has to clear to stay exclusive. */
export function allProblemIds(): string[] {
  return [
    ...ROW_CONDITIONS.filter((condition) => condition.kind === 'diagnostic').map((c) => c.id),
    ...STAGE_CONDITIONS.map((c) => c.id),
  ]
}
