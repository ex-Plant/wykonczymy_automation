import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// The sweep itself is covered in lib/leads/reconcile-sweep.test.ts; this asserts only
// what the route adds — the fail-closed auth gate and the rule that a recovery (and
// only a recovery) alerts, because a silent cron patching a dead webhook forever is
// the failure this route exists to prevent.
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({})) }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/lib/leads/reconcile-sweep', () => ({ runLeadReconcileSweep: vi.fn() }))
vi.mock('@/lib/leads/notify', () => ({ notifyReconcileRecovery: vi.fn() }))

import { GET } from '@/app/(payload)/api/cron/leads-reconcile/route'
import { getPayload } from 'payload'
import { runLeadReconcileSweep } from '@/lib/leads/reconcile-sweep'
import { notifyReconcileRecovery } from '@/lib/leads/notify'

describe('cron leads-reconcile route', () => {
  const previous = process.env.CRON_SECRET

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret'
    vi.mocked(notifyReconcileRecovery).mockResolvedValue(undefined)
  })

  afterEach(() => {
    process.env.CRON_SECRET = previous
    vi.clearAllMocks()
  })

  function request(headers: Record<string, string> = {}) {
    return new NextRequest('http://localhost/api/cron/leads-reconcile', { headers })
  }

  const authorized = () => request({ authorization: 'Bearer test-secret' })

  it('rejects a request with no Authorization header', async () => {
    const res = await GET(request())
    expect(res.status).toBe(401)
    expect(getPayload).not.toHaveBeenCalled()
    expect(runLeadReconcileSweep).not.toHaveBeenCalled()
  })

  it('rejects a request with the wrong secret', async () => {
    const res = await GET(request({ authorization: 'Bearer wrong' }))
    expect(res.status).toBe(401)
    expect(runLeadReconcileSweep).not.toHaveBeenCalled()
  })

  it('fails closed when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(authorized())
    expect(res.status).toBe(401)
    expect(runLeadReconcileSweep).not.toHaveBeenCalled()
  })

  it('alerts once when the sweep recovered leads', async () => {
    vi.mocked(runLeadReconcileSweep).mockResolvedValue({ added: 2, scanned: 30 })

    const res = await GET(authorized())

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true, added: 2, scanned: 30 })
    expect(notifyReconcileRecovery).toHaveBeenCalledTimes(1)
    expect(notifyReconcileRecovery).toHaveBeenCalledWith(expect.anything(), {
      added: 2,
      scanned: 30,
    })
  })

  it('stays silent on a clean run', async () => {
    vi.mocked(runLeadReconcileSweep).mockResolvedValue({ added: 0, scanned: 30 })

    const res = await GET(authorized())

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true, added: 0, scanned: 30 })
    expect(notifyReconcileRecovery).not.toHaveBeenCalled()
  })

  it('reports a Graph failure as a 500 instead of a healthy-looking run', async () => {
    vi.mocked(runLeadReconcileSweep).mockRejectedValue(new Error('Graph request failed'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await GET(authorized())

    expect(res.status).toBe(500)
    expect(notifyReconcileRecovery).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('still reports success when the alert email fails to send', async () => {
    vi.mocked(runLeadReconcileSweep).mockResolvedValue({ added: 1, scanned: 5 })
    vi.mocked(notifyReconcileRecovery).mockRejectedValue(new Error('SMTP down'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await GET(authorized())

    expect(res.status).toBe(200)
    consoleError.mockRestore()
  })
})
