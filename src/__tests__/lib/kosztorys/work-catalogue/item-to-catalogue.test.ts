import { describe, expect, it } from 'vitest'
import type { CatalogueSourceItemT } from '@/lib/kosztorys/work-catalogue/types'
import { toCatalogueCandidate } from '@/lib/kosztorys/work-catalogue/item-to-catalogue'

const source = (overrides: Partial<CatalogueSourceItemT> = {}): CatalogueSourceItemT => ({
  description: 'Ułożenie płytek',
  unit: 'm2',
  sectionName: 'Łazienka 1',
  clientPrice: 200,
  wToolsOverrideType: null,
  wToolsOverrideValue: 0,
  ownToolsOverrideType: null,
  ownToolsOverrideValue: 0,
  ...overrides,
})

describe('toCatalogueCandidate', () => {
  it('zamraża kwotę, gdy pozycja ma własne nadpisanie kwotowe', () => {
    const candidate = toCatalogueCandidate(
      source({ wToolsOverrideType: 'amount', wToolsOverrideValue: 90 }),
    )

    expect(candidate.wToolsRate).toBe(90)
  })

  it('zamraża kwotę wynikającą z własnego mnożnika', () => {
    const candidate = toCatalogueCandidate(
      source({ wToolsOverrideType: 'coeff', wToolsOverrideValue: 0.65 }),
    )

    expect(candidate.wToolsRate).toBe(130)
  })

  it('bez nadpisania stawka trafia do cennika jako „auto"', () => {
    const candidate = toCatalogueCandidate(source())

    expect(candidate.wToolsRate).toBeNull()
    expect(candidate.ownToolsRate).toBeNull()
  })

  it('decyduje o każdym planie osobno', () => {
    const candidate = toCatalogueCandidate(
      source({ ownToolsOverrideType: 'amount', ownToolsOverrideValue: 80 }),
    )

    expect(candidate.wToolsRate).toBeNull()
    expect(candidate.ownToolsRate).toBe(80)
  })

  it('bierze cenę sprzed rabatu i kategorię z nazwy sekcji bez numeru', () => {
    const candidate = toCatalogueCandidate(source({ clientPrice: 250 }))

    expect(candidate.clientPrice).toBe(250)
    expect(candidate.category).toBe('Łazienka')
  })
})
