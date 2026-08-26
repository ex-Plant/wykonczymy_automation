import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'

// Driven against the REAL DB and asserted on the PERSISTED global: the trap this guards is a write
// that succeeds while emptying the two lists nobody was editing, and a `success: true` cannot tell
// you which lists survived.
//
// Same mock surface as the sibling action specs: requireAuth needs a request/cookie we lack in node,
// and revalidation touches next/cache outside a request context.
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    success: true,
    user: { id: 0, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateNotificationRecipients: vi.fn() }))

const { saveRecipientListAction } = await import('@/lib/actions/notification-recipients')
const { readRecipientLists } = await import('@/lib/email/recipients')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const BASELINE = {
  fleetDigest: [{ email: 'flota@example.com' }],
  newLead: [{ email: 'sprzedaz@example.com' }],
  opsAlerts: [{ email: 'ops@example.com' }],
}

describe.skipIf(!ENV_READY)('saveRecipientListAction (DB)', () => {
  let payload: Payload

  const resetGlobal = () =>
    payload.updateGlobal({ slug: 'notification-recipients', data: BASELINE })

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    await resetGlobal()
  }, 30000)

  // Firm-wide state, not this spec's own row: left mutated it decides who a later spec mails.
  afterAll(async () => {
    await resetGlobal()
  })

  it('rewrites the named list and leaves its two siblings intact', async () => {
    await resetGlobal()
    const result = await saveRecipientListAction('fleetDigest', ['a@example.com', 'b@example.com'])

    expect(result.success).toBe(true)
    expect(await readRecipientLists(payload)).toEqual({
      fleetDigest: ['a@example.com', 'b@example.com'],
      newLead: ['sprzedaz@example.com'],
      opsAlerts: ['ops@example.com'],
    })
  })

  it('refuses an empty list and writes nothing', async () => {
    await resetGlobal()
    const result = await saveRecipientListAction('opsAlerts', [])

    expect(result.success).toBe(false)
    expect((await readRecipientLists(payload)).opsAlerts).toEqual(['ops@example.com'])
  })

  it('refuses a malformed address and writes nothing', async () => {
    await resetGlobal()
    const result = await saveRecipientListAction('newLead', ['ok@example.com', 'not-an-email'])

    expect(result.success).toBe(false)
    expect((await readRecipientLists(payload)).newLead).toEqual(['sprzedaz@example.com'])
  })

  it('trims surrounding whitespace rather than storing an address nobody can mail', async () => {
    await resetGlobal()
    await saveRecipientListAction('newLead', ['  spaced@example.com  '])

    expect((await readRecipientLists(payload)).newLead).toEqual(['spaced@example.com'])
  })
})
