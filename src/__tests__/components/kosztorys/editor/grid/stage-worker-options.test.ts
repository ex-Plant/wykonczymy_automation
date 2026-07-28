import { describe, expect, it } from 'vitest'
import { stageWorkerOptions } from '@/components/kosztorys/editor/grid/stage-worker-options'
import type { WorkerRefT } from '@/types/reference-data'

const worker = (id: number, name: string, active?: boolean): WorkerRefT => ({
  id,
  name,
  role: 'EMPLOYEE',
  email: `${name.toLowerCase()}@t.com`,
  ...(active === undefined ? {} : { active }),
})

const anna = worker(1, 'Anna')
const bartek = worker(2, 'Bartek', false)

describe('stageWorkerOptions', () => {
  it('offers only active workers as new choices', () => {
    const { options } = stageWorkerOptions([anna, bartek], null)
    expect(options.map((option) => option.id)).toEqual([1])
  })

  it('treats a missing active flag as active', () => {
    const { options } = stageWorkerOptions([anna], null)
    expect(options.map((option) => option.id)).toEqual([1])
  })

  // EX-613 regression: the current holder used to be resolved INSIDE the active-only filter, so
  // deactivating an assignee made their etap read as unassigned — no checkbox ticked, and the
  // reassignment confirm quoting „nieznana osoba" instead of the name it exists to state. Meanwhile
  // the podwykonawcy panel reads the unfiltered list and still named them, so the two surfaces
  // disagreed about who holds the etap.
  it('still names the current holder after they are deactivated', () => {
    const { currentWorkerName } = stageWorkerOptions([anna, bartek], 2)
    expect(currentWorkerName).toBe('Bartek')
  })

  it('keeps a deactivated current holder visible in the menu so their assignment is tickable', () => {
    const { options } = stageWorkerOptions([anna, bartek], 2)
    expect(options.map((option) => option.id)).toEqual([1, 2])
  })

  it('does not resurrect other deactivated workers alongside the current holder', () => {
    const celina = worker(3, 'Celina', false)
    const { options } = stageWorkerOptions([anna, bartek, celina], 2)
    expect(options.map((option) => option.id)).toEqual([1, 2])
  })

  it('has no current holder name when the etap is unassigned', () => {
    expect(stageWorkerOptions([anna, bartek], null).currentWorkerName).toBeUndefined()
  })

  it('has no current holder name when the assignee is gone from the roster entirely', () => {
    expect(stageWorkerOptions([anna], 99).currentWorkerName).toBeUndefined()
  })

  // The confirm names the target as well as the holder, and a reassignment target is always one of
  // the offered options — so it resolves off the same list rather than a second, differently-filtered one.
  it('names a reassignment target from the offered options', () => {
    const { nameOf } = stageWorkerOptions([anna, bartek], 2)
    expect(nameOf(1)).toBe('Anna')
    expect(nameOf(2)).toBe('Bartek')
    expect(nameOf(null)).toBeUndefined()
  })
})
