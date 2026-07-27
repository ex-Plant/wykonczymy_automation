import { describe, expect, it } from 'vitest'

import { columnTotalsForRows } from '@/lib/kosztorys/column-totals'
import { stageKey, stageValueGrossKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'

const baseItem = {
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

// Two sections so the Σ-of-footers claim is non-trivial, one row with NO przedmiar (id 3) so
// „Pozostało" has something to skip, and a row-level rabat so the discount columns are non-zero.
const tree: KosztorysTreeT = {
  sections: [
    {
      id: 10,
      name: 'Sekcja A',
      displayOrder: 0,
      defaultCostVariant: 'w_tools',
      color: null,
      items: [
        { ...baseItem, sectionId: 10, id: 1, description: 'A', plannedQty: 5, clientPrice: 20 },
        {
          ...baseItem,
          sectionId: 10,
          id: 2,
          description: 'B',
          plannedQty: 4,
          clientPrice: 10,
          discountType: 'amount' as const,
          discountValue: 8,
        },
      ],
    },
    {
      id: 20,
      name: 'Sekcja B',
      displayOrder: 1,
      defaultCostVariant: 'w_tools',
      color: null,
      items: [
        { ...baseItem, sectionId: 20, id: 3, description: 'C', plannedQty: 0, clientPrice: 30 },
        { ...baseItem, sectionId: 20, id: 4, description: 'D', plannedQty: 6, clientPrice: 15 },
      ],
    },
  ],
  stages: [
    { id: 100, ordinal: 1, label: null, plane: 'w_tools' },
    { id: 101, ordinal: 2, label: null, plane: 'own_tools' },
  ],
  progress: [
    { itemId: 1, stageId: 100, qtyDone: 2 },
    { itemId: 1, stageId: 101, qtyDone: 3 },
    { itemId: 2, stageId: 100, qtyDone: 4 },
    { itemId: 3, stageId: 100, qtyDone: 1 },
    { itemId: 4, stageId: 101, qtyDone: 2 },
  ],
  globalCoeffs: { wTools: 0.65, ownTools: 0.55 },
  vatRate: 0.08,
  settlementMode: 'NET',
  materialsNetRate: null,
  globalDiscount: { type: null, value: 0 },
  revision: '2026-01-01T00:00:00.000Z',
}

const rows = treeToRows(tree)
const rowsOf = (sectionId: number) => rows.filter((row) => row.sectionId === sectionId)
const totals = (rowSet = rows, view: 'client' | 'w_tools' = 'client') =>
  columnTotalsForRows(rowSet, tree.stages, view, tree.vatRate)

describe('columnTotalsForRows', () => {
  it('totals the etap axis: per-etap qty, its sum, and per-etap wartość netto/brutto', () => {
    const all = totals()

    expect(all.get(stageKey(100))).toBe(7)
    expect(all.get(stageKey(101))).toBe(5)
    expect(all.get('stageQtySum')).toBe(12)
    // Each etap's wartość is its qty share of the rows it touched, so the two must add back up to the
    // executed total — the reconciliation the sheet's per-etap block exists for.
    const stageNetSum =
      (all.get(stageValueNetKey(100)) ?? 0) + (all.get(stageValueNetKey(101)) ?? 0)
    expect(stageNetSum).toBeCloseTo(all.get('net') ?? 0, 10)
    expect(all.get(stageValueGrossKey(100))).toBeCloseTo(
      (all.get(stageValueNetKey(100)) ?? 0) * 1.08,
      10,
    )
  })

  it('adds up: every column of the section footers equals the same column of „Razem"', () => {
    const all = totals()
    const perSection = [totals(rowsOf(10)), totals(rowsOf(20))]

    expect([...perSection[0].keys()].sort()).toEqual([...all.keys()].sort())
    for (const [columnId, grand] of all) {
      const summed = perSection.reduce((sum, section) => sum + (section.get(columnId) ?? 0), 0)
      expect(summed, columnId).toBeCloseTo(grand, 10)
    }
  })

  it('skips a row with no przedmiar out of „Pozostało" instead of counting it as settled', () => {
    // Section B is row 3 (no przedmiar, work recorded) + row 4 (przedmiar 6, 2 executed).
    const sectionB = totals(rowsOf(20))
    const rowFourOnly = totals(rowsOf(20).filter((row) => row.id === 4))

    expect(sectionB.get('remaining')).toBeCloseTo(rowFourOnly.get('remaining') ?? 0, 10)
    expect(sectionB.get('remaining')).not.toBe(0)
  })

  it('withholds the przedmiar pair outside the client view, where it has no reading', () => {
    const client = totals(rows, 'client')
    const subcontractor = totals(rows, 'w_tools')

    expect(client.get('plannedNet')).toBeGreaterThan(0)
    expect(client.get('plannedGross')).toBeCloseTo((client.get('plannedNet') ?? 0) * 1.08, 10)
    expect(subcontractor.has('plannedNet')).toBe(false)
    expect(subcontractor.has('plannedGross')).toBe(false)
    // The qty is typed, not priced, so it survives the view switch.
    expect(subcontractor.get('plannedQty')).toBe(15)
  })

  it('drops an out-of-view etap from the axis rather than totalling a hidden column', () => {
    const subcontractor = totals(rows, 'w_tools')

    expect(subcontractor.has(stageKey(100))).toBe(true)
    expect(subcontractor.has(stageKey(101))).toBe(false)
    expect(subcontractor.get('stageQtySum')).toBe(7)
  })

  // A rabat globalny is a single subtraction the summary panel makes once, and it suppresses each
  // row's own rabat (calc.ts `globalDiscountActive`). So these columns show the executed value with
  // NEITHER applied — the footers sum to a „Razem" deliberately larger than the do-zapłaty figure.
  // Pinned because both alternatives (subtracting it here, or keeping the per-row rabaty) are
  // defensible designs someone could "fix" this into.
  it('totals the executed value with neither the rabat globalny nor the per-row rabaty applied', () => {
    const discounted: KosztorysTreeT = { ...tree, globalDiscount: { type: 'amount', value: 50 } }
    const net = columnTotalsForRows(treeToRows(discounted), discounted.stages, 'client', 0.08).get(
      'net',
    )

    // 5×20 + 4×10 + 1×30 + 2×15, i.e. row 2's rabat of 8 is back in and the 50 is not taken.
    expect(net).toBe(200)
    expect(net).toBeGreaterThan(totals().get('net') ?? 0)
  })

  it('returns a zeroed set for an empty row set, so a section with no items totals nothing', () => {
    const empty = totals([])

    expect(empty.get('net')).toBe(0)
    expect(empty.get('remaining')).toBe(0)
    expect(empty.get('stageQtySum')).toBe(0)
  })
})
