import { describe, it, expect, vi, beforeEach } from 'vitest'

// The sweep's own contract is covered in lib/leads/reconcile-sweep.test.ts; this
// asserts only what the action wraps around it — the auth gate, the `updateTag`-based
// revalidation a Route Handler can't use, and the ActionResultT shaping.
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => ({}) }))
vi.mock('@/lib/auth/require-auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollection: vi.fn() }))
vi.mock('@/lib/leads/reconcile-sweep', () => ({ runLeadReconcileSweep: vi.fn() }))

import { reconcileLeads } from '@/lib/actions/reconcile-leads'
import { requireAuth } from '@/lib/auth/require-auth'
import { revalidateCollection } from '@/lib/cache/revalidate'
import { runLeadReconcileSweep } from '@/lib/leads/reconcile-sweep'

const recoveredLead = (id: number) => ({
  id,
  name: `Lead ${id}`,
  formName: 'Formularz',
  submittedAt: '2026-08-10T02:00:00.000Z',
})

const sweepResult = (added: number) => ({
  recovered: Array.from({ length: added }, (_, index) => recoveredLead(index + 1)),
  scanned: 3,
  failedForms: [],
  saturatedForms: [],
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuth).mockResolvedValue({ success: true, user: { id: 1 } } as never)
})

describe('reconcileLeads', () => {
  it('revalidates the leads cache when the sweep recovered something', async () => {
    vi.mocked(runLeadReconcileSweep).mockResolvedValue(sweepResult(2))

    const result = await reconcileLeads()

    expect(result).toEqual({ success: true, data: sweepResult(2) })
    expect(revalidateCollection).toHaveBeenCalledWith('leads')
  })

  it('does not revalidate when nothing was added', async () => {
    vi.mocked(runLeadReconcileSweep).mockResolvedValue(sweepResult(0))

    const result = await reconcileLeads()

    expect(result).toEqual({ success: true, data: sweepResult(0) })
    expect(revalidateCollection).not.toHaveBeenCalled()
  })

  it('returns the auth failure and never runs the sweep when unauthorized', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ success: false, error: 'Unauthorized' } as never)

    const result = await reconcileLeads()

    expect(result).toEqual({ success: false, error: 'Unauthorized' })
    expect(runLeadReconcileSweep).not.toHaveBeenCalled()
  })

  it('maps a thrown sweep to an error result instead of propagating', async () => {
    vi.mocked(runLeadReconcileSweep).mockRejectedValue(new Error('Graph request failed'))

    const result = await reconcileLeads()

    expect(result).toEqual({ success: false, error: 'Graph request failed' })
    expect(revalidateCollection).not.toHaveBeenCalled()
  })

  // Partial failure still carries real counts, so the action must not turn it into
  // a plain success — the button reads failedForms to warn the user.
  it('passes a partial failure through to the caller', async () => {
    const partial = {
      recovered: [recoveredLead(1)],
      scanned: 4,
      failedForms: ['B'],
      saturatedForms: [],
    }
    vi.mocked(runLeadReconcileSweep).mockResolvedValue(partial)

    const result = await reconcileLeads()

    expect(result).toEqual({ success: true, data: partial })
    expect(revalidateCollection).toHaveBeenCalledWith('leads')
  })
})
