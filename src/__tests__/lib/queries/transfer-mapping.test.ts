import { describe, it, expect } from 'vitest'

import {
  mapTransferRow,
  type TransferDocT,
  type TransferLookupsT,
} from '@/lib/queries/transfer-mapping'
import type { MediaInfoT } from '@/lib/queries/media'

const media = (id: number): [number, MediaInfoT] => [
  id,
  { url: `/api/media/file/p${id}.jpg`, filename: `p${id}.jpg`, mimeType: 'image/jpeg' },
]

const mediaMap = new Map<number, MediaInfoT>([media(11), media(22), media(33)])

const emptyLookups = (): TransferLookupsT => ({
  cashRegisters: new Map(),
  investments: new Map(),
  users: new Map(),
  expenseCategories: new Map(),
  otherCategories: new Map(),
  media: mediaMap,
})

const doc = (invoice: TransferDocT['invoice']): TransferDocT => ({
  id: 1,
  amount: 100,
  type: 'INVESTMENT_EXPENSE',
  paymentMethod: 'CASH',
  date: '2026-08-10',
  createdAt: '2026-08-10',
  invoice,
})

describe('mapTransferRow', () => {
  it('carries every page onto the row', () => {
    const row = mapTransferRow(doc([11, 22]), emptyLookups())

    expect(row.invoices).toEqual([
      { id: 11, url: '/api/media/file/p11.jpg', filename: 'p11.jpg', mimeType: 'image/jpeg' },
      { id: 22, url: '/api/media/file/p22.jpg', filename: 'p22.jpg', mimeType: 'image/jpeg' },
    ])
  })

  it('leaves the list empty when no invoice is attached', () => {
    expect(mapTransferRow(doc(null), emptyLookups()).invoices).toEqual([])
  })
})
