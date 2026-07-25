import { describe, expect, it } from 'vitest'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import {
  executedWorkNetPreRabat,
  sectionSubtotalsForView,
  subcontractorDueByPlane,
} from '@/lib/kosztorys/settlement'
import type { KosztorysStageT, KosztorysTreeT } from '@/lib/kosztorys/types'

const baseItem = {
  sectionId: 10,
  displayOrder: 0,
  unit: 'm2',
  discountType: null,
  discountValue: 0,
  wToolsOverrideType: 'amount' as const,
  wToolsOverrideValue: 12,
  ownToolsOverrideType: 'amount' as const,
  ownToolsOverrideValue: 10,
  costVariant: null,
  hiddenInExport: false,
  note: null,
}

// Row 1 executes 2 (stage 100) + 3 (stage 101) of planned 5, client price 20.
// Row 2 executes 4 (stage 100) of planned 4, client price 10, with a flat 'amount' rabat of 8.
// Subcontractor prices are flat overrides: z narzędziami = 12, bez narzędzi = 10.
const makeTree = (stages: KosztorysStageT[], extra?: Partial<KosztorysTreeT>): KosztorysTreeT => ({
  sections: [
    {
      id: 10,
      name: 'Sekcja A',
      displayOrder: 0,
      defaultCostVariant: 'w_tools',
      items: [
        { ...baseItem, id: 1, description: 'A', plannedQty: 5, clientPrice: 20 },
        {
          ...baseItem,
          id: 2,
          description: 'B',
          plannedQty: 4,
          clientPrice: 10,
          discountType: 'amount' as const,
          discountValue: 8,
        },
      ],
    },
  ],
  stages,
  progress: [
    { itemId: 1, stageId: 100, qtyDone: 2 },
    { itemId: 1, stageId: 101, qtyDone: 3 },
    { itemId: 2, stageId: 100, qtyDone: 4 },
  ],
  globalCoeffs: { wTools: 0.65, ownTools: 0.55 },
  vatRate: 0.08,
  globalDiscount: { type: null, value: 0 },
  revision: '2026-01-01T00:00:00.000Z',
  ...extra,
})

const allWTools: KosztorysStageT[] = [
  { id: 100, ordinal: 1, label: null, plane: 'w_tools' },
  { id: 101, ordinal: 2, label: null, plane: 'w_tools' },
]
const mixed: KosztorysStageT[] = [
  { id: 100, ordinal: 1, label: null, plane: 'w_tools' },
  { id: 101, ordinal: 2, label: null, plane: 'own_tools' },
]
const allNull: KosztorysStageT[] = [
  { id: 100, ordinal: 1, label: null, plane: null },
  { id: 101, ordinal: 2, label: null, plane: null },
]

describe('subcontractorDueByPlane', () => {
  it('single-plane investment matches executedWorkNetPreRabat at that view', () => {
    const tree = makeTree(allWTools)
    const rows = treeToRows(tree)
    const due = subcontractorDueByPlane(rows, tree.stages)
    const parity = executedWorkNetPreRabat(sectionSubtotalsForView(rows, tree.stages, 'w_tools'))
    // Row 1: 5 qty @ 12 = 60; row 2: 4 qty @ 12 = 48 → 108, all z narzędziami.
    expect(due.wTools).toBeCloseTo(108)
    expect(due.ownTools).toBeCloseTo(0)
    expect(due.combined).toBeCloseTo(parity)
    expect(due.hasUnconfirmedPlane).toBe(false)
  })

  it('mixed planes sum each side at its own price', () => {
    const tree = makeTree(mixed)
    const due = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    // Stage 100 (z narzędziami @ 12): row1 2·12 + row2 4·12 = 72.
    // Stage 101 (bez narzędzi @ 10): row1 3·10 = 30.
    expect(due.wTools).toBeCloseTo(72)
    expect(due.ownTools).toBeCloseTo(30)
    expect(due.combined).toBeCloseTo(102)
    expect(due.hasUnconfirmedPlane).toBe(false)
  })

  it('null plane counts as z narzędziami and raises the unconfirmed flag', () => {
    const tree = makeTree(allNull)
    const due = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    expect(due.wTools).toBeCloseTo(108)
    expect(due.ownTools).toBeCloseTo(0)
    expect(due.hasUnconfirmedPlane).toBe(true)
  })

  it('flags unconfirmed when any single stage is null', () => {
    const tree = makeTree([
      { id: 100, ordinal: 1, label: null, plane: 'w_tools' },
      { id: 101, ordinal: 2, label: null, plane: null },
    ])
    const due = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    expect(due.hasUnconfirmedPlane).toBe(true)
  })

  it('is unchanged by per-item rabat (pre-rabat: rabat never reaches subcontractors)', () => {
    // Item 2 carries a flat-8 rabat; the combined figure ignores it.
    const tree = makeTree(mixed)
    const due = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    expect(due.combined).toBeCloseTo(102)
  })

  it('is unchanged by an active global discount', () => {
    const plain = makeTree(mixed)
    const discounted = makeTree(mixed, { globalDiscount: { type: 'amount', value: 10 } })
    const a = subcontractorDueByPlane(treeToRows(plain), plain.stages)
    const b = subcontractorDueByPlane(treeToRows(discounted), discounted.stages)
    expect(b.combined).toBeCloseTo(a.combined)
    expect(b.wTools).toBeCloseTo(a.wTools)
    expect(b.ownTools).toBeCloseTo(a.ownTools)
  })

  it('respects per-row price overrides per plane', () => {
    // Row 1 gets a coeff override on the own_tools plane; the bez-narzędzi bucket must use it.
    const tree = makeTree(mixed)
    tree.sections[0].items[0].ownToolsOverrideType = 'coeff'
    tree.sections[0].items[0].ownToolsOverrideValue = 0.5 // 20 · 0.5 = 10 per unit (same as flat here)
    const due = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    // Stage 101 (own_tools) still only holds row1's 3 qty → 3 · (20·0.5) = 30.
    expect(due.ownTools).toBeCloseTo(30)
  })

  it('no stages → zeros and no warning', () => {
    const tree = makeTree([])
    const due = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    expect(due).toEqual({ wTools: 0, ownTools: 0, combined: 0, hasUnconfirmedPlane: false })
  })
})
