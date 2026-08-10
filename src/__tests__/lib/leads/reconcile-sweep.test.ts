import { describe, it, expect, vi, beforeEach } from 'vitest'

// Unit test for the sweep core shared by the „Pobierz zgłoszenia" action and the daily
// cron. The Graph fetch and store seams are mocked; lead-schema + normalize-lead stay
// real so the parse/normalize path is exercised. Contract under test: backfill is SILENT
// (stamps both statuses skipped, never emails), counts only rows it actually created,
// sweeps every non-empty form, and surfaces a Graph failure by throwing.
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

    expect(result).toEqual({ added: 1, scanned: 1 })
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
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'leads',
        id: 11,
        data: { notifyStatus: 'skipped', autoReplyStatus: 'skipped' },
        context: { skipRevalidation: true },
      }),
    )
  })

  it('leaves an already-stored lead untouched and out of the added count', async () => {
    vi.mocked(listLeadForms).mockResolvedValue([form('A', 1)])
    vi.mocked(fetchRecentLeads).mockResolvedValue([rawLead('1')])
    vi.mocked(storeLead).mockResolvedValue({ lead: { id: 11 }, created: false } as never)

    const result = await runLeadReconcileSweep(payload)

    expect(result).toEqual({ added: 0, scanned: 1 })
    expect(update).not.toHaveBeenCalled()
  })

  it('sweeps every non-empty form and skips forms with zero leads', async () => {
    vi.mocked(listLeadForms).mockResolvedValue([form('A', 2), form('B', 0), form('C', 5)])
    vi.mocked(fetchRecentLeads).mockImplementation(async (formId: string) =>
      formId === 'A' ? [rawLead('a1'), rawLead('a2')] : formId === 'C' ? [rawLead('c1')] : [],
    )
    vi.mocked(storeLead).mockResolvedValue({ lead: { id: 99 }, created: true } as never)

    const result = await runLeadReconcileSweep(payload)

    expect(result).toEqual({ added: 3, scanned: 3 })
    expect(fetchRecentLeads).toHaveBeenCalledTimes(2)
    expect(fetchRecentLeads).toHaveBeenCalledWith('A', 30)
    expect(fetchRecentLeads).toHaveBeenCalledWith('C', 30)
    expect(fetchRecentLeads).not.toHaveBeenCalledWith('B', 30)
  })

  it('skips a lead that fails schema validation (not scanned, not stored)', async () => {
    vi.mocked(listLeadForms).mockResolvedValue([form('A', 1)])
    vi.mocked(fetchRecentLeads).mockResolvedValue([{ garbage: true }])

    const result = await runLeadReconcileSweep(payload)

    expect(result).toEqual({ added: 0, scanned: 0 })
    expect(storeLead).not.toHaveBeenCalled()
  })

  // The core deliberately does not swallow a Graph failure — an auth error must reach
  // the caller as a failure, not look like "no leads to recover".
  it('propagates a Graph failure to the caller', async () => {
    vi.mocked(listLeadForms).mockRejectedValue(new Error('Graph request failed'))

    await expect(runLeadReconcileSweep(payload)).rejects.toThrow('Graph request failed')
  })
})
