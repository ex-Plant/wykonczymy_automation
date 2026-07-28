import { describe, it, expect, vi, beforeEach } from 'vitest'
import { subcontractorDueByPlane } from '@/lib/kosztorys/settlement'
import { computeSubcontractorSummary } from '@/lib/kosztorys/subcontractor-summary'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { baseItem, makeTree } from '@/__tests__/helpers/kosztorys-tree'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'
import type { WorkerRefT } from '@/types/reference-data'
import type { PayoutByWorkerT } from '@/types/transfers'

// The whole point of this module is that it is NOT a second derivation — the wypłata dialog and
// „Podsumowanie podwykonawców" must never quote a different amount for the same money. So the spec
// runs the query's dependencies through the panel's own functions and asserts the two agree, rather
// than asserting hand-written numbers (which would pass just as happily if both sides were wrong).
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    success: true,
    user: { id: 1, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))

const buildKosztorysTree = vi.fn<() => Promise<KosztorysTreeT>>()
const fetchPayoutsByWorkerForInvestment = vi.fn<() => Promise<PayoutByWorkerT[]>>()
const fetchReferenceData = vi.fn<() => Promise<{ workers: WorkerRefT[] }>>()

vi.mock('@/lib/queries/kosztorys', () => ({ buildKosztorysTree }))
vi.mock('@/lib/queries/investment-transactions', () => ({ fetchPayoutsByWorkerForInvestment }))
vi.mock('@/lib/queries/reference-data', () => ({ fetchReferenceData }))

const { getSubcontractorRoster } = await import('@/lib/queries/subcontractor-roster')

const worker = (id: number, name: string): WorkerRefT => ({
  id,
  name,
  role: 'EMPLOYEE',
  email: `${name.toLowerCase()}@t.com`,
})

// One section, two items, three etapy: two assigned to different people, one to nobody. Work is
// executed on all three, so the unassigned one really does hold money.
const fixtureTree = (): KosztorysTreeT =>
  makeTree({
    sections: [
      {
        id: 10,
        name: 'Sekcja A',
        displayOrder: 0,
        color: null,
        items: [
          { ...baseItem, id: 1, description: 'A', plannedQty: 5, clientPrice: 20 },
          { ...baseItem, id: 2, description: 'B', plannedQty: 4, clientPrice: 10 },
        ],
      },
    ],
    stages: [
      { id: 100, ordinal: 1, label: 'E1', plane: 'w_tools', workerId: 1 },
      { id: 101, ordinal: 2, label: 'E2', plane: 'own_tools', workerId: 2 },
      { id: 102, ordinal: 3, label: 'E3', plane: 'w_tools', workerId: null },
    ],
    progress: [
      { itemId: 1, stageId: 100, qtyDone: 2 },
      { itemId: 1, stageId: 101, qtyDone: 1 },
      { itemId: 1, stageId: 102, qtyDone: 1 },
      { itemId: 2, stageId: 100, qtyDone: 4 },
    ],
  })

const WORKERS = [worker(1, 'Anna'), worker(2, 'Bartek')]

describe('getSubcontractorRoster', () => {
  beforeEach(() => {
    buildKosztorysTree.mockReset()
    fetchPayoutsByWorkerForInvestment.mockReset()
    fetchReferenceData.mockReset()
    fetchReferenceData.mockResolvedValue({ workers: WORKERS })
  })

  it('quotes the same per-worker figures the panel derives from the same tree', async () => {
    const tree = fixtureTree()
    const payouts: PayoutByWorkerT[] = [{ workerId: 1, total: 120 }]
    buildKosztorysTree.mockResolvedValue(tree)
    fetchPayoutsByWorkerForInvestment.mockResolvedValue(payouts)

    const { rows } = await getSubcontractorRoster(7)

    // The panel's path, spelled out independently: rows → settlement → summary.
    const due = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    const expected = computeSubcontractorSummary(
      due.combined,
      payouts.map((row) => ({ ...row, name: 'ignored' })),
      { byWorker: due.byWorker, stages: tree.stages, workers: WORKERS },
    )

    expect(rows.map((row) => [row.workerId, row.due, row.paid, row.remaining])).toEqual(
      expected.rows.map((row) => [row.workerId, row.due, row.paid, row.remaining]),
    )
    // And the figures are non-trivial — a roster of zeros would satisfy the equality above.
    expect(rows.some((row) => row.due > 0)).toBe(true)
  })

  it('counts only the unassigned etapy that actually hold executed work', async () => {
    const tree = fixtureTree()
    buildKosztorysTree.mockResolvedValue(tree)
    fetchPayoutsByWorkerForInvestment.mockResolvedValue([])

    // Etap 102 is unassigned WITH work on it; a fourth unassigned etap with nothing done on it must
    // not raise the warning — it takes nothing away from anybody.
    tree.stages.push({ id: 103, ordinal: 4, label: 'E4', plane: 'w_tools', workerId: null })

    const { unassignedStageCount } = await getSubcontractorRoster(7)

    expect(unassignedStageCount).toBe(1)
  })

  it('returns payout-only rows when the investment has no etapy at all', async () => {
    buildKosztorysTree.mockResolvedValue({
      ...fixtureTree(),
      sections: [],
      stages: [],
      progress: [],
    })
    fetchPayoutsByWorkerForInvestment.mockResolvedValue([{ workerId: 2, total: 300 }])

    const { rows, unassignedStageCount } = await getSubcontractorRoster(7)

    expect(unassignedStageCount).toBe(0)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ workerId: 2, due: 0, paid: 300, remaining: -300 })
    // „Nikt ci nie przypisał etapów" — not „przepłaciłeś". The dialog leans on this to pick its badge.
    expect(rows[0].state).toBe('no_stages')
  })
})
