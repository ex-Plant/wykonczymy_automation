import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import {
  findClientViewRow,
  getClientViewConfig,
  getClientViewSettings,
} from '@/lib/queries/kosztorys-client-view'
import { sanitizeClientViewConfig } from '@/lib/kosztorys/client-view-settings'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

// The resolution chain decides what a client is served, so it runs against the REAL DB: a `where`
// clause that matched everything, or a global read that swallowed its own absence, would pass any
// stub while serving one investment's settings to another.

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const CODE_DEFAULTS = sanitizeClientViewConfig({})

const OFFER_VARIANT = { hiddenColumns: ['discountValue'], hideEmptyRows: false }
const SETTLEMENT_VARIANT = { hiddenColumns: ['plannedGross'], hideEmptyRows: true }

describe.skipIf(!ENV_READY)('getClientViewSettings (DB)', () => {
  let payload: Payload
  let investmentWithRow: number
  let investmentWithoutRow: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })

    investmentWithRow = await createTestInvestment(payload, 'EX-695 client view spec (row)')
    investmentWithoutRow = await createTestInvestment(payload, 'EX-695 client view spec (fallback)')
    // The row is a fixture, not the first test's side effect — the specs below share one DB and
    // must not depend on each other's order to find it.
    await payload.create({
      collection: 'kosztorys-client-view',
      data: {
        investment: investmentWithRow,
        mode: 'SETTLEMENT',
        variants: { OFFER: OFFER_VARIANT, SETTLEMENT: SETTLEMENT_VARIANT },
      },
    })
  })

  afterAll(async () => {
    if (investmentWithRow) await deleteTestInvestment(payload, investmentWithRow)
    if (investmentWithoutRow) await deleteTestInvestment(payload, investmentWithoutRow)
    // The global is firm-wide state, not this spec's own row: left mutated, it would decide what a
    // later spec's investment serves.
    await payload.updateGlobal({
      slug: 'kosztorys-client-view-defaults',
      data: { mode: 'OFFER', variants: {} },
    })
  })

  // The save action calls this with no session on the payload client — its own gate already ran, and
  // the collection's access control answers „no user, no row". A lookup that quietly evaluates that
  // access instead of bypassing it fails the save with a generic „Nie możesz wykonać tej akcji".
  it('finds the row without a session', async () => {
    const row = await findClientViewRow(payload, investmentWithRow)
    expect(row).not.toBeNull()
  })

  it('serves the variant the stored mode names, not the first one', async () => {
    const settings = await getClientViewSettings(investmentWithRow)
    expect(settings).toEqual(SETTLEMENT_VARIANT)
  })

  it('keeps the inactive variant readable for the dialog', async () => {
    const config = await getClientViewConfig(investmentWithRow)
    expect(config.mode).toBe('SETTLEMENT')
    expect(config.variants.OFFER).toEqual(OFFER_VARIANT)
  })

  it('drops a stored key outside the allowlist — the ceiling is not a stored decision', async () => {
    await payload.update({
      collection: 'kosztorys-client-view',
      where: { investment: { equals: investmentWithRow } },
      data: {
        variants: {
          OFFER: OFFER_VARIANT,
          SETTLEMENT: { hiddenColumns: ['plannedGross', 'note', 'priceMode'], hideEmptyRows: true },
        },
      },
    })

    const settings = await getClientViewSettings(investmentWithRow)
    expect(settings.hiddenColumns).toEqual(['plannedGross'])
  })

  it('falls back to the firm-wide default for an investment with no row', async () => {
    await payload.updateGlobal({
      slug: 'kosztorys-client-view-defaults',
      data: { mode: 'SETTLEMENT', variants: { SETTLEMENT: SETTLEMENT_VARIANT } },
    })

    const settings = await getClientViewSettings(investmentWithoutRow)
    expect(settings).toEqual(SETTLEMENT_VARIANT)
  })

  it('falls back to the code default when the global holds nothing', async () => {
    await payload.updateGlobal({
      slug: 'kosztorys-client-view-defaults',
      data: { mode: 'OFFER', variants: {} },
    })

    const config = await getClientViewConfig(investmentWithoutRow)
    expect(config).toEqual(CODE_DEFAULTS)
  })
})
