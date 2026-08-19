import { describe, expect, it } from 'vitest'
import {
  clientViewSettingsForMode,
  sameClientViewConfig,
  sanitizeClientViewConfig,
  type ClientViewConfigT,
} from '@/lib/kosztorys/client-view-settings'
import { PREVIEW_VISIBLE_COLUMNS } from '@/lib/kosztorys/column-config'

const visibleColumns = (config: ClientViewConfigT, mode: 'OFFER' | 'SETTLEMENT') => {
  const hidden = new Set(config.variants[mode].hiddenColumns)
  return [...PREVIEW_VISIBLE_COLUMNS].filter((key) => !hidden.has(key))
}

describe('sanitizeClientViewConfig', () => {
  it('answers an empty source with both code defaults in offer mode', () => {
    const config = sanitizeClientViewConfig({})

    expect(config.mode).toBe('OFFER')
    expect(visibleColumns(config, 'OFFER')).toEqual(
      expect.arrayContaining([
        'description',
        'plannedQty',
        'unit',
        'price',
        'plannedNet',
        'remaining',
      ]),
    )
    expect(visibleColumns(config, 'OFFER')).toHaveLength(6)
    expect(config.variants.OFFER.hideEmptyRows).toBe(true)
    expect(config.variants.SETTLEMENT.hideEmptyRows).toBe(true)
  })

  it('makes settlement a superset of the offer', () => {
    const config = sanitizeClientViewConfig({})
    const settlement = new Set(visibleColumns(config, 'SETTLEMENT'))

    for (const key of visibleColumns(config, 'OFFER')) expect(settlement.has(key)).toBe(true)
    expect(settlement.has('donePercent')).toBe(true)
    expect(settlement.size).toBeGreaterThan(visibleColumns(config, 'OFFER').length)
  })

  it('falls back to offer on an unknown mode', () => {
    expect(sanitizeClientViewConfig({ mode: 'INVOICE' }).mode).toBe('OFFER')
    expect(sanitizeClientViewConfig({ mode: 'SETTLEMENT' }).mode).toBe('SETTLEMENT')
  })

  it('fills only the missing variant, leaving the stored one alone', () => {
    const config = sanitizeClientViewConfig({
      mode: 'SETTLEMENT',
      variants: { OFFER: { hiddenColumns: ['price'], hideEmptyRows: false } },
    })

    expect(config.variants.OFFER).toEqual({ hiddenColumns: ['price'], hideEmptyRows: false })
    expect(config.variants.SETTLEMENT.hiddenColumns).toEqual(
      sanitizeClientViewConfig({}).variants.SETTLEMENT.hiddenColumns,
    )
  })

  it('drops a stored key that is outside the disclosure ceiling', () => {
    const config = sanitizeClientViewConfig({
      variants: { OFFER: { hiddenColumns: ['price', 'subcontractorPrice'], hideEmptyRows: true } },
    })

    expect(config.variants.OFFER.hiddenColumns).toEqual(['price'])
  })
})

describe('clientViewSettingsForMode', () => {
  it('serves the variant the mode names, not the first one', () => {
    const config = sanitizeClientViewConfig({ mode: 'SETTLEMENT' })

    expect(clientViewSettingsForMode(config)).toBe(config.variants.SETTLEMENT)
    expect(clientViewSettingsForMode({ ...config, mode: 'OFFER' })).toBe(config.variants.OFFER)
  })
})

describe('sameClientViewConfig', () => {
  it('reports a mode change even when both variants are identical', () => {
    const config = sanitizeClientViewConfig({})

    expect(sameClientViewConfig(config, { ...config, mode: 'SETTLEMENT' })).toBe(false)
    expect(sameClientViewConfig(config, sanitizeClientViewConfig({}))).toBe(true)
  })

  it('ignores the order of the hidden set', () => {
    const config = sanitizeClientViewConfig({})
    const reordered: ClientViewConfigT = {
      ...config,
      variants: {
        ...config.variants,
        OFFER: {
          ...config.variants.OFFER,
          hiddenColumns: [...config.variants.OFFER.hiddenColumns].reverse(),
        },
      },
    }

    expect(sameClientViewConfig(config, reordered)).toBe(true)
  })
})
