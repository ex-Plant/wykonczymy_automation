import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { getClientViewSettings } from '@/lib/queries/kosztorys-client-view'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

// The resolution chain decides what a client is served, so it runs against the REAL DB: a `where`
// clause that matched everything, or a global read that swallowed its own absence, would pass any
// stub while serving one investment's settings to another.

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

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
        hiddenColumns: ['discountValue'],
        hideEmptyRows: false,
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
      data: { hiddenColumns: [], hideEmptyRows: true },
    })
  })

  it('serves the investment’s own row when it has one', async () => {
    const settings = await getClientViewSettings(investmentWithRow)
    expect(settings).toEqual({ hiddenColumns: ['discountValue'], hideEmptyRows: false })
  })

  it('drops a stored key outside the allowlist — the ceiling is not a stored decision', async () => {
    await payload.update({
      collection: 'kosztorys-client-view',
      where: { investment: { equals: investmentWithRow } },
      data: { hiddenColumns: ['discountValue', 'note', 'priceMode'] },
    })

    const settings = await getClientViewSettings(investmentWithRow)
    expect(settings.hiddenColumns).toEqual(['discountValue'])
  })

  it('falls back to the firm-wide default for an investment with no row', async () => {
    await payload.updateGlobal({
      slug: 'kosztorys-client-view-defaults',
      data: { hiddenColumns: ['plannedGross'], hideEmptyRows: false },
    })

    const settings = await getClientViewSettings(investmentWithoutRow)
    expect(settings).toEqual({ hiddenColumns: ['plannedGross'], hideEmptyRows: false })
  })

  it('falls back to the code default when the global holds nothing', async () => {
    await payload.updateGlobal({
      slug: 'kosztorys-client-view-defaults',
      data: { hiddenColumns: [], hideEmptyRows: true },
    })

    const settings = await getClientViewSettings(investmentWithoutRow)
    expect(settings).toEqual({ hiddenColumns: [], hideEmptyRows: true })
  })
})
