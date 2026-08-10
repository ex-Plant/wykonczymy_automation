import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Unit test for the sweep core shared by the „Pobierz zgłoszenia" action and the daily
// cron. The Graph fetch and store seams are mocked; lead-schema + normalize-lead stay
// real so the parse/normalize path is exercised.
const { update } = vi.hoisted(() => ({ update: vi.fn() }))

vi.mock('@/lib/leads/fetch-recent-leads', () => ({
  listLeadForms: vi.fn(),
  fetchRecentLeads: vi.fn(),
}))
vi.mock('@/lib/leads/fetch-form-questions', () => ({ fetchFormQuestions: vi.fn() }))
vi.mock('@/lib/leads/store-lead', () => ({ storeLead: vi.fn() }))

import { runLeadReconcileSweep } from '@/lib/leads/reconcile-sweep'
import { listLeadForms, fetchRecentLeads } from '@/lib/leads/fetch-recent-leads'
import { fetchFormQuestions } from '@/lib/leads/fetch-form-questions'
import { storeLead } from '@/lib/leads/store-lead'
import type { Payload } from 'payload'

// Fabricated, PII-free. 'adres_e-mail' key → email via normalizeLead's heuristic.
const rawLead = (id: string) => ({
  id,
  created_time: '2026-07-08T07:09:14+0000',
  field_data: [{ name: 'adres_e-mail', values: [`${id}@example.com`] }],
})

const form = (id: string, leadsCount: number) => ({ id, name: `form-${id}`, leadsCount })

const payload = { update } as unknown as Payload

const clean = { failedForms: [], saturatedForms: [] }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchFormQuestions).mockResolvedValue([])
  update.mockResolvedValue(undefined)
})

describe('runLeadReconcileSweep', () => {
  it('stores a missing lead and stamps both statuses skipped', async () => {
    vi.mocked(listLeadForms).mockResolvedValue([form('A', 1)])
    vi.mocked(fetchRecentLeads).mockResolvedValue([rawLead('1')])
    vi.mocked(storeLead).mockResolvedValue({ lead: { id: 11 }, created: true } as never)

    const result = await runLeadReconcileSweep(payload)

    expect(result).toEqual({ added: 1, scanned: 1, ...clean })
    expect(storeLead).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({
        source: 'facebook_lead_ads',
        externalId: '1',
        email: '1@example.com',
        formId: 'A',
        formName: 'form-A',
      }),
      { skipRevalidation: true },
    )
    // `overrideAccess` is load-bearing: the cron has no req.user, so without it the
    // leads collection's update rule rejects the stamp, the row stays `pending`, and a
    // later webhook redelivery mails the customer a days-late „Dziękujemy za kontakt".
    expect(update).toHaveBeenCalledWith({
      collection: 'leads',
      id: 11,
      data: { notifyStatus: 'skipped', autoReplyStatus: 'skipped' },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
  })

  it('leaves an already-stored lead untouched and out of the added count', async () => {
    vi.mocked(listLeadForms).mockResolvedValue([form('A', 1)])
    vi.mocked(fetchRecentLeads).mockResolvedValue([rawLead('1')])
    vi.mocked(storeLead).mockResolvedValue({ lead: { id: 11 }, created: false } as never)

    const result = await runLeadReconcileSweep(payload)

    expect(result).toEqual({ added: 0, scanned: 1, ...clean })
    expect(update).not.toHaveBeenCalled()
  })

  it('sweeps every non-empty form and skips forms with zero leads', async () => {
    vi.mocked(listLeadForms).mockResolvedValue([form('A', 2), form('B', 0), form('C', 5)])
    vi.mocked(fetchRecentLeads).mockImplementation(async (formId: string) =>
      formId === 'A' ? [rawLead('a1'), rawLead('a2')] : formId === 'C' ? [rawLead('c1')] : [],
    )
    vi.mocked(storeLead).mockResolvedValue({ lead: { id: 99 }, created: true } as never)

    const result = await runLeadReconcileSweep(payload)

    expect(result).toEqual({ added: 3, scanned: 3, ...clean })
    expect(fetchRecentLeads).toHaveBeenCalledTimes(2)
    expect(fetchRecentLeads).toHaveBeenCalledWith('A', 30)
    expect(fetchRecentLeads).toHaveBeenCalledWith('C', 30)
    expect(fetchRecentLeads).not.toHaveBeenCalledWith('B', 30)
  })

  it('skips a lead that fails schema validation (not scanned, not stored)', async () => {
    vi.mocked(listLeadForms).mockResolvedValue([form('A', 1)])
    vi.mocked(fetchRecentLeads).mockResolvedValue([{ garbage: true }])

    const result = await runLeadReconcileSweep(payload)

    expect(result).toEqual({ added: 0, scanned: 0, ...clean })
    expect(storeLead).not.toHaveBeenCalled()
  })

  it('propagates a failure to list the forms — nothing could be swept at all', async () => {
    vi.mocked(listLeadForms).mockRejectedValue(new Error('Graph request failed'))

    await expect(runLeadReconcileSweep(payload)).rejects.toThrow('Graph request failed')
  })

  describe('partial failure', () => {
    let consoleError: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleError.mockRestore()
    })

    // Form order is stable, so a throw would mean the forms after the broken one are
    // never swept on any day — and the leads already stored would lose their alert.
    it('keeps sweeping after a form fails and reports it instead of throwing', async () => {
      vi.mocked(listLeadForms).mockResolvedValue([form('A', 1), form('B', 1), form('C', 1)])
      vi.mocked(fetchRecentLeads).mockImplementation(async (formId: string) => {
        if (formId === 'B') throw new Error('rate limited')
        return [rawLead(formId)]
      })
      vi.mocked(storeLead).mockResolvedValue({ lead: { id: 11 }, created: true } as never)

      const result = await runLeadReconcileSweep(payload)

      expect(result).toEqual({
        added: 2,
        scanned: 2,
        failedForms: ['B'],
        saturatedForms: [],
      })
      expect(fetchRecentLeads).toHaveBeenCalledWith('C', 30)
    })

    it('reports a form that failed on its questions fetch, after the leads came back', async () => {
      vi.mocked(listLeadForms).mockResolvedValue([form('A', 1)])
      vi.mocked(fetchRecentLeads).mockResolvedValue([rawLead('1')])
      vi.mocked(fetchFormQuestions).mockRejectedValue(new Error('rate limited'))

      const result = await runLeadReconcileSweep(payload)

      expect(result).toEqual({ added: 0, scanned: 0, failedForms: ['A'], saturatedForms: [] })
      expect(storeLead).not.toHaveBeenCalled()
    })
  })

  // A full page means the window decided where we stopped, not the backlog. Tomorrow's
  // page is a newer set, so anything past the limit is lost unless somebody is told.
  it('flags a form that filled a whole page as saturated', async () => {
    const fullPage = Array.from({ length: 30 }, (_, index) => rawLead(`a${index}`))
    vi.mocked(listLeadForms).mockResolvedValue([form('A', 45)])
    vi.mocked(fetchRecentLeads).mockResolvedValue(fullPage)
    vi.mocked(storeLead).mockResolvedValue({ lead: { id: 11 }, created: true } as never)

    const result = await runLeadReconcileSweep(payload)

    expect(result).toEqual({ added: 30, scanned: 30, failedForms: [], saturatedForms: ['A'] })
  })

  it('does not flag a form whose page came back short of the limit', async () => {
    vi.mocked(listLeadForms).mockResolvedValue([form('A', 1)])
    vi.mocked(fetchRecentLeads).mockResolvedValue([rawLead('1')])
    vi.mocked(storeLead).mockResolvedValue({ lead: { id: 11 }, created: true } as never)

    const result = await runLeadReconcileSweep(payload)

    expect(result.saturatedForms).toEqual([])
  })
})
