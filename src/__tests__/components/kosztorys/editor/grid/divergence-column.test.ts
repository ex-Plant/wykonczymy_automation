import { describe, expect, it } from 'vitest'
import { buildV2Columns } from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { MeasureDiscrepancyT } from '@/lib/kosztorys/settlement-rows'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

// „Pozostało do rozliczenia" is the only column whose EXISTENCE is data-driven — every other one is
// there or hidden by a preference. So what is asserted here is the gate, not the arithmetic
// (measure-discrepancy.test.ts owns that): it appears with an imported pomiar and stays for as long
// as there is one, and it is unreachable from a client's document.

const STAGES: KosztorysStageT[] = [
  { id: 7, ordinal: 1, label: 'Etap 1', plane: null, workerId: null },
  { id: 9, ordinal: 2, label: 'Etap 2', plane: null, workerId: null },
]

const DIVERGED = {
  id: 1,
  sectionId: 10,
  plannedQty: 95,
  sheetMeasuredQty: 95,
  discountType: null,
  discountValue: 0,
  clientPrice: 100,
  globalDiscountActive: false,
  [stageKey(7)]: 55,
  [stageKey(9)]: 0,
} as unknown as KosztorysV2RowT

const ids = (opts: Partial<BuildV2ColumnsOptsT> = {}) =>
  buildV2Columns({ view: 'client', stages: STAGES, ...opts })
    .map((column) => column.id)
    .filter((id): id is string => id != null)

describe('the „Pozostało do rozliczenia" column', () => {
  it('is absent while no pozycja carries a pomiar from the sheet', () => {
    expect(ids()).not.toContain('divergence')
    expect(ids({ hasSheetMeasure: false })).not.toContain('divergence')
  })

  // Right behind „Opis prac" — „ile jeszcze zostało" is not an answer you should have to scroll to,
  // but it is not what identifies the row either.
  it('follows the identity block once a pomiar is imported', () => {
    expect(ids({ hasSheetMeasure: true }).slice(0, 3)).toEqual([
      'sectionName',
      'description',
      'divergence',
    ])
  })

  // The row-actions column is chrome, not a reading of the kosztorys, so it opens the grid by default.
  it('sits behind the row-actions column when editing is enabled', () => {
    expect(ids({ hasSheetMeasure: true, onRemoveItem: () => {} })).toEqual([
      'actions',
      ...ids({ hasSheetMeasure: true }),
    ])
  })

  // The reference figure is the company's own bookkeeping doubt, so the client's document must not
  // carry it — held by the assembly rather than by PREVIEW_VISIBLE_COLUMNS alone, which would also
  // drop it but only after building a column the preview can never want.
  it('never reaches the client preview', () => {
    expect(ids({ hasSheetMeasure: true, previewVisible: true })).not.toContain('divergence')
  })

  // `measureDiscrepancy` is hard-anchored to the whole offered scope, so on a crew's plane its „etapy"
  // is a different number from the one in the stage columns beside it.
  it('is absent on a subcontractor plane', () => {
    expect(ids({ hasSheetMeasure: true, view: 'w_tools' })).not.toContain('divergence')
  })

  it('carries both figures for the cell to render', () => {
    const column = buildV2Columns({ view: 'client', stages: STAGES, hasSheetMeasure: true }).find(
      (candidate) => candidate.id === 'divergence',
    )
    const { divergenceFor } = column?.columnData as {
      divergenceFor: (r: KosztorysV2RowT) => MeasureDiscrepancyT | null
    }
    expect(divergenceFor(DIVERGED)).toMatchObject({ qtyDiff: 40, net: 4000 })
    expect(divergenceFor({ ...DIVERGED, sheetMeasuredQty: 55 })).toBeNull()
  })
})
