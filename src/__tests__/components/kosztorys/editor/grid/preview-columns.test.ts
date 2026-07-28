import { describe, expect, it } from 'vitest'
import {
  buildV2Columns,
  buildV2Grid,
} from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

// The client-facing preview: which columns it renders, and what pins the price plane they compute at.
// Asserted on rendered ids rather than on the constant, because the ids are the document a client
// reads — a constant can be right while the selection still drops half of it.

const STAGES: KosztorysStageT[] = [
  { id: 7, ordinal: 1, label: 'Etap 1', plane: null },
  { id: 9, ordinal: 2, label: 'Etap 2', plane: null },
]

function previewIds(extra: Partial<BuildV2ColumnsOptsT> = {}): string[] {
  return buildV2Columns({ view: 'client', previewVisible: true, stages: STAGES, ...extra })
    .map((column) => column.id)
    .filter((id): id is string => id != null)
}

describe('preview columns', () => {
  // The core of EX-591: each of these is ONE person's reading preference — the owner's picker, his
  // money axis, layer, progress display — and none may shape a client's document. Each could
  // individually take something away: 'progress' stripped the whole offer, the axis stripped the
  // stage amounts, the picker hides stageValueGross by default. Here none of them changes anything.
  it('is not narrowed by any owner reading preference', () => {
    const baseline = previewIds()
    const narrowed: Partial<BuildV2ColumnsOptsT>[] = [
      { moneyAxis: 'net' },
      { moneyAxis: 'gross' },
      { layer: 'progress' },
      { layer: 'work' },
      { progressDisplay: 'values' },
      { progressDisplay: 'percent' },
      { progressDisplay: 'none' },
      { isHidden: () => true },
    ]
    for (const opts of narrowed) expect(previewIds(opts)).toEqual(baseline)
  })

  // The one gate a preview still answers to, because it is not a preference: `globalDiscount` belongs
  // to the investment, and while it is on the per-item rabat is bypassed, not cleared. Left in, the
  // offer would print a „Rabat" that no figure on the page reflects.
  it('drops the per-item rabat columns while a global discount overrides them', () => {
    const visible = previewIds({ globalDiscountActive: true })
    for (const id of ['discountType', 'discountValue', 'discountAmount', 'discountAmountGross']) {
      expect(previewIds()).toContain(id)
      expect(visible).not.toContain(id)
    }
  })

  it('carries the offer and the progress together', () => {
    const visible = previewIds()
    for (const id of [
      'description',
      'plannedQty',
      'unit',
      'price',
      'net',
      'stageQtySum',
      'stage_7',
    ]) {
      expect(visible).toContain(id)
    }
    expect(visible).toContain('stageValueNet_7')
    expect(visible).toContain('stageValuePercent_7')
    // Netto and brutto side by side — the preview is not pinned to the investment's settlement mode.
    expect(visible).toContain('stageValueGross_7')
  })

  it('withholds the owner-authored komentarz', () => {
    expect(previewIds()).not.toContain('note')
  })

  // The picker is the preference selectV2Columns just stopped honouring, so a preview must not carry
  // one — an allowlist-filtered list would describe a grid whose columns no longer answer to it.
  it('offers no column picker', () => {
    const { columnToggleItems } = buildV2Grid({
      view: 'client',
      previewVisible: true,
      stages: STAGES,
    })
    expect(columnToggleItems).toEqual([])
  })
})

// The allowlist alone is not a lock: `price`/`net`/`gross` are on it and would compute at a
// subcontractor's cost basis, under client column names. No column looks foreign, so the leak does not
// announce itself — which is why the pair is enforced by an exception rather than a comment.
describe('the pair: allowlist + price plane', () => {
  const unpinned = (view: 'w_tools' | 'own_tools') => () =>
    buildV2Columns({ view, previewVisible: true, stages: STAGES })

  it('throws on previewVisible without view=client', () => {
    expect(unpinned('w_tools')).toThrow(/previewVisible requires view='client'/)
    expect(unpinned('own_tools')).toThrow()
  })

  it('accepts the correct pair', () => {
    expect(() => previewIds()).not.toThrow()
  })

  // Held by the PLANE, not the allowlist: `priceMode`/`priceCoeff` are only assembled at
  // `view !== 'client'`, so a preview can never reach them. Their absence from the allowlist is
  // defence in depth.
  it('cannot reach the subcontractor-only columns', () => {
    const visible = previewIds()
    expect(visible).not.toContain('priceMode')
    expect(visible).not.toContain('priceCoeff')
    // The editor at a subcontractor plane still gets them — proof the assertion above has teeth.
    expect(buildV2Columns({ view: 'w_tools', stages: STAGES }).map((c) => c.id)).toContain(
      'priceMode',
    )
  })

  // The subcontractor plane without the allowlist is just the owner's own view — the pair binds one
  // way only, otherwise the assertion would lock the editor out.
  it('does not throw on the subcontractor plane alone', () => {
    expect(() => buildV2Columns({ view: 'w_tools', stages: STAGES })).not.toThrow()
  })
})
