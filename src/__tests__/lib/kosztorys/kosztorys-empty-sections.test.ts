import { describe, expect, it } from 'vitest'
import { sectionSubtotalsForView, emptySectionIds } from '@/lib/kosztorys/settlement'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import type { KosztorysItemT, KosztorysTreeT } from '@/lib/kosztorys/types'

function item(id: number, sectionId: number): KosztorysItemT {
  return {
    id,
    sectionId,
    displayOrder: 0,
    description: `Pozycja ${id}`,
    unit: 'm2',
    plannedQty: 10,
    discountType: null,
    discountValue: 0,
    clientPrice: 100,
    wToolsOverrideType: null,
    wToolsOverrideValue: 0,
    ownToolsOverrideType: null,
    ownToolsOverrideValue: 0,
    costVariant: null,
    hiddenInExport: false,
    note: null,
  }
}

// Three sections, one of them "pusta" — B carries a position but no executed work (no progress row),
// which is the only sense of empty that exists here: a section with no ITEMS is cascade-deleted.
const tree: KosztorysTreeT = {
  sections: [
    {
      id: 10,
      name: 'Sekcja A',
      displayOrder: 0,
      defaultCostVariant: 'w_tools',
      items: [item(1, 10)],
    },
    {
      id: 20,
      name: 'Sekcja B',
      displayOrder: 1,
      defaultCostVariant: 'w_tools',
      items: [item(2, 20)],
    },
    {
      id: 30,
      name: 'Sekcja C',
      displayOrder: 2,
      defaultCostVariant: 'w_tools',
      items: [item(3, 30)],
    },
  ],
  stages: [{ id: 100, ordinal: 1, label: null, plane: null }],
  progress: [
    { itemId: 1, stageId: 100, qtyDone: 4 },
    { itemId: 3, stageId: 100, qtyDone: 2 },
  ],
  globalCoeffs: { wTools: 0.65, ownTools: 0.55 },
  vatRate: 0.23,
  globalDiscount: { type: null, value: 0 },
  revision: '2026-01-01T00:00:00.000Z',
}

const rows = treeToRows(tree)
// Derived, not hand-written: proves "pusta" means net === 0 at the live subtotals, so the test can't
// drift from the definition the toggle's label promises.
const empties = emptySectionIds(sectionSubtotalsForView(rows, tree.stages, 'client'))

// „Ukryj puste sekcje" hides by unticking the picker's selection, so the grid can only ever show
// what the checkmarks say. This guards the one domain fact it rests on — which sections count as
// pusta — plus the deselect itself; the selection is FilterMultiSelect's string encoding.
const deselectEmpty = (current: string[]) => current.filter((v) => !empties.has(Number(v)))

describe('emptySectionIds — a section is pusta when nothing has been executed in it', () => {
  it('picks out only the section with no recorded work', () => {
    expect([...empties]).toEqual([20])
  })

  it('counts positions as irrelevant — B holds one and is still pusta', () => {
    expect(rows.filter((r) => r.sectionId === 20)).toHaveLength(1)
  })
})

describe('„Ukryj puste sekcje" — the bulk deselect it applies to the selection', () => {
  it('drops the pusta section and leaves the rest ticked', () => {
    expect(deselectEmpty(['10', '20', '30'])).toEqual(['10', '30'])
  })

  it('is a no-op on a selection that holds no pusta section', () => {
    expect(deselectEmpty(['10', '30'])).toEqual(['10', '30'])
  })

  it('can empty the selection outright — „pokaż nic", not „pokaż wszystko"', () => {
    expect(deselectEmpty(['20'])).toEqual([])
  })
})
