import { describe, expect, it } from 'vitest'
import { buildV2Grid } from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { STAGES_COLUMN_GROUP, stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

// What the pure ordering function (lib/kosztorys/column-order) cannot assert on its own: how the
// rank map behaves against the REAL column set — that the anchors keep their slots among ~30
// columns, that a stage group travels as one block, that the trailing gap survives the sort, and
// that a client's document ignores the owner's ranks entirely.

const STAGES: KosztorysStageT[] = [
  { id: 7, ordinal: 1, label: 'Etap 1', plane: 'w_tools', workerId: null },
  { id: 9, ordinal: 2, label: 'Etap 2', plane: 'w_tools', workerId: null },
]

const grid = (opts: Partial<BuildV2ColumnsOptsT> = {}) =>
  buildV2Grid({ view: 'client', stages: STAGES, ...opts })

const columnIds = (opts: Partial<BuildV2ColumnsOptsT> = {}) =>
  grid(opts)
    .columns.map((column) => column.id)
    .filter((id): id is string => id != null)

describe('column ranks in the assembled grid', () => {
  it('leaves the sheet order alone without a rank map', () => {
    expect(columnIds({ columnRanks: {} })).toEqual(columnIds())
  })

  it('lifts a ranked column ahead of the ones it was assembled behind', () => {
    const ids = columnIds({ columnRanks: { price: -1 } })
    expect(ids.indexOf('price')).toBeLessThan(ids.indexOf('plannedQty'))
  })

  it('keeps the anchors on their slots and the trailing gap last', () => {
    const base = columnIds({ onRemoveItem: () => {} })
    const ids = columnIds({ onRemoveItem: () => {}, columnRanks: { price: -1, net: -2 } })
    expect(ids.indexOf('actions')).toBe(base.indexOf('actions'))
    expect(ids.indexOf('description')).toBe(base.indexOf('description'))
    expect(ids.at(-1)).toBe('layerGap')
  })

  it('moves the stage columns as one block', () => {
    const ids = columnIds({ columnRanks: { [STAGES_COLUMN_GROUP]: 99 } })
    expect(ids.indexOf(stageKey(9))).toBe(ids.indexOf(stageKey(7)) + 1)
    // Past „Cena j.m.", which assembles well behind the stage columns.
    expect(ids.indexOf(stageKey(7))).toBeGreaterThan(ids.indexOf('price'))
  })

  it('reorders the picker list with the grid', () => {
    const items = grid({ columnRanks: { price: -1 } }).columnToggleItems.map((item) => item.id)
    expect(items.indexOf('price')).toBeLessThan(items.indexOf('plannedQty'))
  })

  // The order is one owner's reading preference, and a client's localStorage is client-writable —
  // so the preview takes the sheet order whatever the rank map says (ruling 2026-07-28).
  it('is ignored by the client preview', () => {
    const previewOpts = { view: 'client', previewVisible: true } as const
    expect(columnIds({ ...previewOpts, columnRanks: { price: -1 } })).toEqual(
      columnIds(previewOpts),
    )
  })
})

describe('columnBaseRanks', () => {
  // Read off the assembled list, never the ordered one — otherwise the dialog's next drop would
  // compute its midpoint against ranks that already moved.
  it('stays on the sheet order after a column has been reranked', () => {
    expect(grid({ columnRanks: { price: -1 } }).columnBaseRanks).toEqual(grid().columnBaseRanks)
  })

  it('ranks every picker group exactly once, in sheet order', () => {
    const { columnBaseRanks, columnToggleItems } = grid()
    for (const item of columnToggleItems) expect(columnBaseRanks[item.id]).toBeTypeOf('number')
    expect(new Set(Object.values(columnBaseRanks)).size).toBe(Object.keys(columnBaseRanks).length)
  })
})
