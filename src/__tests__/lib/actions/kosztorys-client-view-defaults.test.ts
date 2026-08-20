import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'

// „Zapisz jako domyślne" writes FIRM-WIDE state: the global it touches decides what every investment
// without a row of its own serves to its client link. So this asserts the PERSISTED global, not the
// action's return value — a write that also carried `mode` across would flip live client links for
// the whole firm from a button whose confirm speaks about one investment.
vi.mock('server-only', () => ({}))

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    success: true,
    user: { id: 0, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))

const { saveClientViewDefaultsAction } = await import('@/lib/actions/kosztorys-client-view')
const { sanitizeClientViewConfig } = await import('@/lib/kosztorys/client-view-settings')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const SETTLEMENT_VARIANT = { hiddenColumns: ['plannedGross'], hideEmptyRows: true }
const OFFER_VARIANT = { hiddenColumns: ['discountValue'], hideEmptyRows: false }

const configWith = (variants: Partial<Record<'OFFER' | 'SETTLEMENT', unknown>>) => ({
  ...sanitizeClientViewConfig({ variants }),
})

describe.skipIf(!ENV_READY)('saveClientViewDefaultsAction (DB)', () => {
  let payload: Payload

  const readGlobal = () =>
    payload.findGlobal({ slug: 'kosztorys-client-view-defaults', depth: 0 }) as Promise<{
      mode: string
      variants: Record<string, unknown>
    }>

  const resetGlobal = () =>
    payload.updateGlobal({
      slug: 'kosztorys-client-view-defaults',
      data: { mode: 'OFFER', variants: {} },
    })

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    await resetGlobal()
  })

  // The global is firm-wide state, not this spec's own row: left mutated it decides what a later
  // spec's investment serves.
  afterAll(async () => {
    await resetGlobal()
  })

  it('leaves the firm-wide mode alone when saving the settlement variant', async () => {
    const res = await saveClientViewDefaultsAction(
      configWith({ SETTLEMENT: SETTLEMENT_VARIANT }),
      'SETTLEMENT',
    )

    expect(res.success).toBe(true)
    const stored = await readGlobal()
    expect(stored.mode).toBe('OFFER')
    expect(stored.variants.SETTLEMENT).toEqual(SETTLEMENT_VARIANT)
  })

  it('writes only the named variant, leaving the other absent rather than frozen', async () => {
    await resetGlobal()
    await saveClientViewDefaultsAction(configWith({ OFFER: OFFER_VARIANT }), 'OFFER')

    const stored = await readGlobal()
    expect(stored.variants.OFFER).toEqual(OFFER_VARIANT)
    // Not `{}`-defaulted into the row: an untouched variant must keep resolving to whatever the code
    // default says today, not to a copy of what it said the day someone pressed the button.
    expect(stored.variants.SETTLEMENT).toBeUndefined()
  })

  it('keeps the variant saved earlier when the other one is saved', async () => {
    await resetGlobal()
    await saveClientViewDefaultsAction(configWith({ OFFER: OFFER_VARIANT }), 'OFFER')
    await saveClientViewDefaultsAction(configWith({ SETTLEMENT: SETTLEMENT_VARIANT }), 'SETTLEMENT')

    const stored = await readGlobal()
    expect(stored.variants.OFFER).toEqual(OFFER_VARIANT)
    expect(stored.variants.SETTLEMENT).toEqual(SETTLEMENT_VARIANT)
  })
})
