import { describe, it, expect, vi } from 'vitest'
import type { Payload } from 'payload'
import type { FleetDigestT } from '@/lib/fleet/reminder-sweep'

vi.mock('@/lib/env', () => ({ FRONTEND_URL: 'https://example.test' }))

const { notifyFleetDigest } = await import('@/lib/fleet/notify')

const EMPTY_DIGEST: FleetDigestT = {
  overdue: [],
  within7: [],
  within30: [],
  odometer: [],
  missing: [],
  stamps: [],
}

const payloadWith = (fleetDigest: { email: string }[]) => {
  const sendEmail = vi.fn(async () => undefined)
  const payload = {
    sendEmail,
    findGlobal: async () => ({ fleetDigest, newLead: [], opsAlerts: [] }),
  } as unknown as Payload
  return { payload, sendEmail }
}

describe('notifyFleetDigest', () => {
  // One message with N addresses, never N messages: the caller stamps the deadlines as announced
  // once, and that stamp has to describe exactly what was sent.
  it('sends a single mail addressed to the whole list', async () => {
    const { payload, sendEmail } = payloadWith([
      { email: 'a@example.com' },
      { email: 'b@example.com' },
    ])

    await notifyFleetDigest(payload, EMPTY_DIGEST)

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['a@example.com', 'b@example.com'] }),
    )
  })

  // Mailing the void looks identical to a healthy run in every log, and the caller must not stamp.
  it('throws without sending when nobody is on the list', async () => {
    const { payload, sendEmail } = payloadWith([])

    await expect(notifyFleetDigest(payload, EMPTY_DIGEST)).rejects.toThrow(/Brak odbiorców/)
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
